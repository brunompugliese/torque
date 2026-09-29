# 002 — Login: Design

**Status:** Approved
**Requirements:** [requirements.md](requirements.md)

## Summary

Email and password sign-in through Supabase Auth, run entirely on the server. A Server Action validates the input with Zod, signs in with `@supabase/ssr`, and stores the session in encrypted `HttpOnly` cookies. `src/proxy.ts` refreshes the session on every request, ends sessions idle for more than 24 hours, and redirects signed-out visitors from every path except `/ingresar`. A server-only data access layer (DAL) verifies the token (`getClaims`) and the `shop_id` claim before any app page renders. The top bar gets the shop name and a "Cerrar sesión" button.

Defense in depth: the proxy redirect is only an optimistic check; the DAL check in every app route is authoritative; RLS in the database remains the final guard for data.

## Database

None.

- Migrations: none. The existing pieces already cover access: `custom_access_token_hook` adds `shop_id` to the JWT, `sync_profile_enabled_to_auth` bans disabled profiles in Supabase Auth, and RLS on `shop` lets a user read only their own shop's name.
- RLS impact: none.

### Supabase dashboard settings (not in migrations)

Added to the checklist in [environments.md](../../docs/environments.md) for every project:

| Setting | Value | Why |
|---|---|---|
| Authentication → Sign In / Providers → Allow new users to sign up | Off | The anon key is public; with sign-up on, anyone could create auth users through the API. |
| Email provider → Confirm email | On | Harmless with sign-up off; stops unconfirmed accounts from signing in. |
| Password → Minimum length | 12 characters | Applies when the owner sets or resets passwords. Existing shorter passwords keep working: sign-in has no length rule. |
| Password → Requirements | None (no character classes) | Decided by the owner. |
| Password → Leaked password protection | Off | Decided by the owner. |
| Sessions → Time-box / inactivity timeout | Off (default) | The app enforces its own 24-hour inactivity timeout (see Session lifetime); the dashboard setting needs a paid plan. |
| Rate limits → Sign-ins/sign-ups | Keep the default (per IP) or lower | Main brute-force protection while there is no CAPTCHA. |
| JWT signing keys | Asymmetric (e.g. ES256) | Lets `getClaims()` verify tokens locally without a network call. With the legacy shared secret it still works, but calls Supabase Auth on every check. |

## Frontend

### Routes

```
src/
  proxy.ts                    # Session refresh + optimistic redirects
  app/
    ingresar/page.tsx         # /ingresar (outside the (app) group: no shell)
    (app)/layout.tsx          # requireSession() + shop name + sign-out
```

### Request flow

1. **Proxy** (`src/proxy.ts`, every route except static assets): creates a server Supabase client bound to the request/response cookies and calls `getClaims()`, which refreshes an expired access token and writes the new cookies. Then it applies `resolveAuthRedirect`:
   - no session and path is not `/ingresar` → redirect to `/ingresar?next=<path+query>`. This covers app pages, unknown paths (so a signed-out visitor doesn't learn which pages exist) and route handlers;
   - session and path is `/ingresar` → redirect to `/`;
   - otherwise continue.
   The matcher excludes only `/_next/static`, `/_next/image` and `/favicon.ico`, which the login page itself needs. This is an optimistic check (per the Next.js auth guide); it does no database queries.
2. **DAL** (`src/lib/auth/session.ts`, `import "server-only"`): `getSession()` returns `{ userId, shopId }` from verified claims, or `null`. It is wrapped in React `cache()` so one request verifies once. `requireSession()` redirects to `/ingresar` when there is no session, and to the sign-out route with the "account unavailable" reason when the `shop_id` claim is missing.
3. **App layout** calls `requireSession()` and `getShopName()`. Each app page also calls `requireSession()`, because layouts don't re-render on client navigation; future data queries call it too.

### Sign-in (Server Action `signIn`)

In `src/features/auth/actions.ts`, used with `useActionState`:

1. Parse `FormData` with `loginSchema` (same schema as the client). Invalid → return field errors; Supabase is not called.
2. `supabase.auth.signInWithPassword({ email, password })`.
3. On error → `mapAuthError(error)` returns one of `invalidCredentials`, `rateLimited`, `unexpected`. `invalid_credentials`, `user_banned` and `email_not_confirmed` all map to `invalidCredentials` so responses don't reveal which accounts exist or are disabled. For `unexpected`, log `error.code` and `error.status` only.
4. On success → read the claims; if there is no `shop_id`, call `signOut()` and return `accountUnavailable`.
5. `redirect(getSafeRedirectPath(next))`.

The action returns only `{ ok: false, error }` or field-error keys. It never echoes the email or password back; the form keeps the email in its own state and clears the password.

### Sign-out (Server Action `signOut`)

`supabase.auth.signOut({ scope: "local" })` ends the session on this device only, which clears the cookies, then `redirect("/ingresar")`. It is a POST (form + Server Action), so Next.js's Origin check protects it against CSRF. The "account unavailable" path uses a Route Handler `GET /salir?motivo=cuenta` because it is triggered by a redirect during rendering, where cookies can't be written; it only signs out and redirects, so a forged link can do no more than log the user out.

### Safe redirects

`getSafeRedirectPath(value)` returns `value` only if it starts with a single `/`, doesn't start with `//` or `/\`, contains no control characters or backslashes, is at most 2048 characters, and resolves to the app's own origin when parsed with `new URL(value, "http://localhost")`. It also rejects `/ingresar` and `/salir` (returning to `/salir` after signing in would sign the user straight out). Anything else → `/`.

### Session lifetime (24-hour sliding window)

Supabase issues a short-lived access token (1 hour) and a refresh token that doesn't expire on its own. The app adds an inactivity limit on top:

1. **Activity stamp.** The encrypted session cookie also carries `lastSeenAt`, a timestamp the app writes itself. Because the cookie is encrypted and authenticated (AES-GCM), the stamp can't be read or forged in the browser.
2. **On every request**, the proxy reads `lastSeenAt`:
   - more than 24 hours ago → calls `signOut({ scope: "local" })`, which revokes the refresh token in Supabase Auth (a copied cookie is then useless too), clears the cookies and redirects to `/ingresar?motivo=inactividad`;
   - otherwise → continues and rewrites the stamp. To avoid rewriting cookies on every single request, the stamp is only rewritten when it's more than 5 minutes old; the window is therefore 24 hours ± 5 minutes.
3. **Token refresh.** `getClaims()` refreshes an expired access token with the refresh token and writes the new cookies, so a page left open for hours still works as long as it's within the 24-hour window. Server Actions and Route Handlers go through the proxy too.
4. **Cookie lifetime.** Cookies get `maxAge` 24 hours, renewed with each stamp rewrite, so the browser also drops them after a day without use. The server check in step 2 is the authoritative one; the browser expiry is a backup.

Consequence to be aware of: someone who stops using the app on Friday evening signs in again on Monday morning. Refresh token rotation and reuse detection stay on (Supabase default).

### Cookies and what the browser can see

Credentials and project details stay on the server:

| Item | Where it lives | Visible in the browser? |
|---|---|---|
| Supabase URL and anon key | Server env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY` (no `NEXT_PUBLIC_` prefix) | No: never inlined into bundles |
| Access and refresh tokens, user id, email, shop id, last-activity stamp | Session cookie, encrypted with AES-256-GCM using the server secret `SESSION_COOKIE_SECRET` | Only as opaque ciphertext |
| Cookie name | `torque-session.<n>`, written by the encryption adapter; `@supabase/ssr`'s own `sb-<project-ref>-auth-token` cookies never reach the browser | Name only; no project ref |
| Session and user objects | Server only; client components get plain display values (e.g. shop name) | No |
| Password | Sent once in the sign-in request body over HTTPS; never returned, logged or stored by the app | Only in the typing user's own network tab, for that one request |

Cookie options: `httpOnly: true`, `sameSite: "lax"`, `secure: true` except in development, `path: "/"`, `maxAge` 24 hours (renewed with activity).

**Encryption adapter** (`src/lib/auth/session-store.ts`, using `src/lib/crypto/aes-gcm.ts`): the `cookies.getAll`/`setAll` functions given to `@supabase/ssr` decrypt and encrypt values with Web Crypto AES-GCM (random 12-byte IV per write; works in both the proxy and Node runtimes). `@supabase/ssr` splits large sessions into chunks, and encryption adds about 35% to each one, which could exceed the browser's 4 KB cookie limit. The adapter therefore re-splits encrypted values into its own chunks (`torque-session.0`, `.1`, …) under 3.5 KB and reassembles them before decrypting. A cookie that fails to decrypt (tampered with, or the secret changed) is treated as no session.

**Limits:**
- Cookies can't be hidden from the browser that holds them. Someone with access to the device's DevTools can still see that an encrypted cookie exists and could copy it to reuse the session: encryption stops reading, not replaying. Signing out on shared computers remains the defense.
- Rotating `SESSION_COOKIE_SECRET` signs everyone out.

`HttpOnly` also means injected scripts can't read the session. This relies on the app never creating a browser Supabase client; if one is ever needed (e.g. realtime), this decision must be revisited.

Also: `poweredByHeader: false` in `next.config.ts`, and production browser source maps stay off (the Next.js default).

### Security headers

Set in `next.config.ts` `headers()` for all routes:

```
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=63072000; includeSubDomains   (production only)
```

### Login page UI

A single centered card on the sand background, no top bar or floating nav:

- "Torque" wordmark above the card, `h1` "Iniciar sesión" centered in the card header. No subtitle.
- Email field, password field with an icon button (Phosphor `EyeIcon` / `EyeSlashIcon`) to show/hide it.
- Full-width "Iniciar sesión" button; while pending: disabled, label "Iniciando sesión…".
- Form-level errors in a `FormAlert` (see below) above the button; field errors as plain text under each field (shadcn `FieldError`), linked with `aria-describedby`.
- Email field is auto-focused.
- The form uses `react-hook-form` with the Zod resolver for instant client-side feedback, then submits `FormData` to the Server Action, which validates again.

### Shared UI rules (app-wide, not login-only)

- **Hand pointer on clickable elements.** One base rule in `src/app/globals.css` (`@layer base`) sets `cursor: pointer` on enabled `button`, `[role="button"]`, `a[href]`, `summary`, `select`, `label[for]`, checkbox/radio inputs and `input[type="submit"|"button"|"reset"]`, and `cursor: not-allowed` on disabled buttons. Doing it globally means every current and future component (shadcn primitives, `FloatingNav`, `PasswordInput`, `SignOutButton`) gets it without per-component classes. Recorded in `docs/conventions.md`.
- **Error containers are tinted.** A shared `FormAlert` component (`src/components/shared/form-alert.tsx`) wraps shadcn `Alert` for messages about a whole form. The error variant uses theme tokens only: `bg-destructive/10` background, `border-destructive/30` border and `text-destructive` text, with a Phosphor `WarningCircleIcon`. It keeps `role="alert"` so screen readers announce it. Other variants (e.g. success, info) can be added later with their own semantic tokens, per the theming conventions. Field-level errors stay as plain text without a container.

### Top bar

`TopBar` gains an optional `actions` slot (right side). The app layout passes the shop name and a `SignOutButton`: a small ghost button with Phosphor `SignOutIcon` and the label "Cerrar sesión", inside a `<form action={signOut}>`.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `TopBar` | `src/components/shared/top-bar.tsx` | Extended: optional `actions` prop |
| `Button`, `Input`, `Label`, `Card`, `Alert`, `Field` | `src/components/ui/` | `Button` reused; others added with the shadcn CLI and used as-is (`Field`, `FieldLabel`, `FieldError` for every form field) |
| `PasswordInput` | `src/components/shared/password-input.tsx` | New, generic: an `Input` with a show/hide toggle; labels come from props |
| `FormAlert` | `src/components/shared/form-alert.tsx` | New, generic: form-level message box with a tinted background (error variant now); text comes from the caller |
| Pointer cursor rule | `src/app/globals.css` | New base rule for all clickable elements |
| Supabase server client | `src/lib/supabase/server.ts` | New: `createClient()` for Server Components, Actions and Route Handlers, with the cookie options above |
| Supabase proxy client | `src/lib/supabase/proxy.ts` | New: `updateSession(request)` for `proxy.ts` |
| Env | `src/lib/env.ts` | New, `server-only`: reads and validates `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SESSION_COOKIE_SECRET` (32 bytes, base64) with Zod; fails fast with a clear message that never prints the values |
| AES-GCM helpers | `src/lib/crypto/aes-gcm.ts` | New, generic: `importAesKey`, `encrypt`, `decrypt` (reusable for any server-side encryption) |
| Session cookie store | `src/lib/auth/session-store.ts` | New: the encryption and chunking adapter plugged into `@supabase/ssr`, plus the activity stamp |
| DAL | `src/lib/auth/session.ts` | New, `server-only`: `getSession`, `requireSession` |
| `resolveAuthRedirect` | `src/lib/auth/redirects.ts` | New, pure: proxy decisions |
| `isSessionIdle`, `shouldRefreshStamp` | `src/lib/auth/inactivity.ts` | New, pure: the 24-hour and 5-minute rules, testable with a fixed clock |
| `getSafeRedirectPath` | `src/lib/auth/redirects.ts` | New, pure |
| `LOGIN_PATH`, `SIGN_OUT_PATH`, `HOME_PATH`, sign-out reasons | `src/lib/auth/redirects.ts` | New constants |
| `loginSchema` | `src/features/auth/schemas.ts` | New |
| `emailField`, `currentPasswordField`, `newPasswordField`, `toFieldErrors` | `src/lib/validation/fields.ts` | New, reusable: field rules for any form (sign-in uses the first two; `newPasswordField` waits for a registration or password-change form), and a helper that turns Zod errors into message keys |
| `mapAuthError` | `src/features/auth/errors.ts` | New, pure |
| `signIn`, `signOut` | `src/features/auth/actions.ts` | New Server Actions |
| `LoginForm` | `src/features/auth/components/login-form.tsx` | New, client component |
| `SignOutButton` | `src/features/auth/components/sign-out-button.tsx` | New |
| `getShopName` | `src/features/shop/queries.ts` | New: `select name from shop` (RLS returns only the user's shop) |
| Types | `src/types/database.ts` | New, generated with `supabase gen types typescript` by the owner (the command needs the project ref), or deferred with a narrow local type for the one query if generation isn't available yet |

New dependencies: `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `server-only`.

Env var rename: `.env.example`, `docs/architecture.md` and Vercel use `SUPABASE_URL` / `SUPABASE_ANON_KEY` instead of the `NEXT_PUBLIC_` names, plus the new `SESSION_COOKIE_SECRET` (generate with `openssl rand -base64 32`).

## Validation

`loginSchema` (Zod), shared by the form and the Server Action:

| Field | Rules | Error message key |
|---|---|---|
| `email` | trimmed, lowercased; required; valid email; max 254 characters | `validation.emailRequired`, `validation.emailInvalid` |
| `password` | required only; not trimmed (spaces can be part of a password); no length or character rules | `validation.passwordRequired` |
| `next` | optional string; not validated as an error, only sanitized by `getSafeRedirectPath` | — |

Sign-in checks only that a password was entered: an existing user signs in with the password they already have. Password rules belong where passwords are set, so `src/lib/validation/fields.ts` provides two reusable rules:

- `currentPasswordField` (required only), used by `loginSchema`;
- `newPasswordField` (12 to 72 characters, no character-class rules), not used yet; for a future registration or password-change form. It matches the dashboard policy and Supabase Auth's 72-character limit.

Oversized input is still bounded by Next.js's Server Action body limit (1 MB by default).

Schemas return message keys, not text; forms translate them with `next-intl`. Field messages live under `validation.*` because the field rules are shared by every form; messages specific to signing in live under `auth.errors.*`.

## UI text

New `messages/es.json` keys under `validation` (shared) and `auth`:

```json
{
  "validation": {
    "emailRequired": "Ingresá tu email.",
    "emailInvalid": "Ingresá un email válido.",
    "passwordRequired": "Ingresá tu contraseña.",
    "passwordTooShort": "La contraseña debe tener al menos 12 caracteres.",
    "passwordTooLong": "La contraseña es demasiado larga."
  },
  "auth": {
    "login": {
      "title": "Iniciar sesión",
      "email": "Email",
      "password": "Contraseña",
      "showPassword": "Mostrar contraseña",
      "hidePassword": "Ocultar contraseña",
      "submit": "Iniciar sesión",
      "submitting": "Iniciando sesión…"
    },
    "signOut": "Cerrar sesión",
    "errors": {
      "invalidCredentials": "Email o contraseña incorrectos.",
      "rateLimited": "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
      "accountUnavailable": "Tu cuenta no está habilitada. Contactá al responsable del taller.",
      "sessionExpired": "Tu sesión se cerró por inactividad. Iniciá sesión de nuevo.",
      "unexpected": "No se pudo iniciar sesión. Intentá de nuevo."
    }
  }
}
```

## Tests

- RLS (pgTAP): none new (no database changes). Existing policies already restrict `shop`.
- Unit (Vitest):
  - `loginSchema`: valid input; trimming and lowercasing; empty, malformed and too-long email; empty password rejected; 1-character, 11-character and 200-character passwords accepted; password with spaces kept as-is.
  - `newPasswordField`: empty, 11 and 73 characters rejected; 12 and 72 accepted; no character-class rules.
  - `isSessionIdle` / `shouldRefreshStamp` (fixed clock): 23 h 59 m active, 24 h 1 m idle, missing stamp treated as idle, stamp in the future treated as idle, rewrite only after 5 minutes.
  - Proxy inactivity path (Supabase mocked): idle session calls `signOut({ scope: "local" })`, clears cookies and redirects with `motivo=inactividad`.
  - Cookie encryption: round trip; tampered value and wrong secret mean no session; chunking keeps every cookie under 4 KB and reassembles; plaintext never appears in the stored value.
  - Bundle check: after `npm run build`, a script (also run in CI) searches `.next/static` for `supabase.co` and the configured Supabase host, and fails if found.
  - `getSafeRedirectPath`: `/`, `/vehiculos?x=1` kept; `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`, `%2F%2Fevil.example` decoded forms, paths with control characters, overly long paths, `/ingresar`, `/salir`, empty and missing → `/`.
  - `resolveAuthRedirect`: each branch, including query strings preserved in `next`.
  - `mapAuthError`: each Supabase code, unknown codes, and that banned/unconfirmed map to `invalidCredentials`.
  - `signIn` (Supabase client mocked): invalid input never calls Supabase; each error maps to the right message; the password is never returned; a missing `shop_id` claim triggers sign-out; success redirects to the sanitized path; logs contain no email or password.
  - `signOut`: calls `signOut({ scope: "local" })` and redirects.
  - `LoginForm` (Testing Library): labels, `type`/`autocomplete` attributes, show/hide toggle state, field errors with `aria-invalid`/`aria-describedby`, alert for form errors, pending state.
  - `TopBar` with `actions`.
  - `FormAlert`: renders the message with `role="alert"` and the tinted error styles (token classes only, so the theme-token test also covers it).
  - Theme-token test (from spec 001), widened from `src/components` and `src/app` to all of `src`, so feature and lib code are covered too.
  - Env: missing or malformed variables throw a clear error that doesn't contain their values.
- Manual check: sign in and out against `torque-dev`; inspect cookie flags, cookie values (ciphertext only) and response headers in the browser dev tools; search the network tab and page source for the project URL, tokens and ids; try a disabled profile, a wrong password and an unknown email and confirm the same message; hover every button, link, nav item and the password toggle and confirm the hand pointer (and not-allowed on the disabled submit button); check the "Iniciar sesión" title is centered and the error box has the tinted background; leave a page open past token expiry and submit a form; to test the 24-hour limit without waiting, temporarily lower it via a development-only setting and confirm the sign-out and message.

## Risks and alternatives

- **No CAPTCHA and no breached-password check.** Password guessing spread across many IPs isn't stopped by per-IP rate limits, and a reused leaked password would be accepted. Mitigated by the 12-character minimum when passwords are set; both can be added later without changing this design.
- **24 hours is short across weekends.** Users sign in again after any day without use. Accepted by the owner; the limit is one constant.
- **An open tab doesn't count as activity.** Only requests do. A page left open without any navigation or submission for 24 hours will be signed out on its next request.
- **Cookie encryption is custom code** around `@supabase/ssr`'s cookie handling. Mitigated by keeping it small, using Web Crypto AES-GCM (no home-made crypto), and testing round trips, tampering and chunking. If `@supabase/ssr` changes its cookie format, the adapter's tests catch it.
- **No app-side rate limiting yet (backlog).** Sign-in calls reach Supabase Auth from our server, so Supabase's per-IP limit may count the server's IP rather than each visitor's: weaker against attackers, and heavy use could hit the shared limit. To be measured during task 10 and recorded here.
- **`HttpOnly` cookies block a browser Supabase client.** Accepted: the architecture is server-first. Revisit if realtime is needed.
- **Hook not configured in a new project.** Every user would lack `shop_id` and be signed out with "account unavailable" instead of seeing an empty app. That is the safe failure; the environments checklist covers the hook.
- **Disabled profile with a still-valid access token.** The ban stops refreshes and new sign-ins, and RLS checks `is_current_profile_enabled()` on every query, so data access ends at once; the UI may keep showing the shell until the token expires (up to 1 hour by default). Accepted.
- **Pages become dynamic.** Reading cookies makes app pages render per request. Required for auth; no caching of per-user pages is wanted anyway.
- **Alternative: client-side sign-in with the browser client.** Rejected: tokens would be readable by JavaScript, and validation could be bypassed more easily.
- **Alternative: checking auth only in `proxy.ts`.** Rejected: the Next.js guide warns proxy checks are optimistic; the DAL check is authoritative.
