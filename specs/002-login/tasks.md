# 002 — Login: Tasks

**Status:** Approved
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Dependencies and env**
  - Do: install `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `server-only`. Add `src/lib/env.ts` with tests. Update `.env.example` to `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SESSION_COOKIE_SECRET` with placeholders; the owner updates `.env.local` and Vercel.
  - Verify: `npm test`, `npm run build` pass.
- [x] **2. Supabase clients**
  - Do: cookie encryption adapter with tests; `src/lib/supabase/server.ts` and `src/lib/supabase/proxy.ts` with the cookie name and options from the design.
  - Verify: `npm test` and `npm run build` pass; no browser client exists (`grep createBrowserClient` finds nothing).
- [x] **3. Redirect helpers**
  - Do: `src/lib/auth/redirects.ts` (`getSafeRedirectPath`, `resolveAuthRedirect`, constants) with tests.
  - Verify: `npm test` passes.
- [x] **4. Proxy and DAL**
  - Do: `src/lib/auth/inactivity.ts` with tests; `src/proxy.ts` including the 24-hour inactivity sign-out; `src/lib/auth/session.ts` (`getSession`, `requireSession`); the `GET /salir` route handler.
  - Verify: `npm run build` passes; in `npm run dev` with `.env.local`, an app page redirects to `/ingresar?next=…` when signed out.
- [x] **5. Validation and error mapping**
  - Do: field rules in `src/lib/validation/fields.ts` (`emailField`, `currentPasswordField` for sign-in, `newPasswordField` for future forms), `loginSchema` (password required only), `mapAuthError`, messages in `es.json` (`validation.*` and `auth.*`), with tests.
  - Verify: `npm test` passes.
- [x] **6. Server Actions**
  - Do: `signIn` and `signOut` in `src/features/auth/actions.ts`, with tests using a mocked Supabase client.
  - Verify: `npm test` passes.
- [x] **7. Shared UI rules**
  - Do: the pointer-cursor base rule in `globals.css`; `FormAlert` with tests; `PasswordInput` with tests. Add both rules (pointer cursor, tinted error containers) to `docs/conventions.md`.
  - Verify: `npm test` passes; hovering buttons, links and nav items in `npm run dev` shows the hand pointer.
- [x] **8. Login page**
  - Do: add shadcn `input`, `label`, `card`, `alert`, `field`; `LoginForm` (reusing `Field`, `PasswordInput`, `FormAlert`); `/ingresar` page with the centered title. Tests for `LoginForm`.
  - Verify: `npm test` passes; the page renders at 360px and desktop with the title centered and a tinted error box.
- [x] **9. App shell integration**
  - Do: `TopBar` `actions` prop; `getShopName`; `SignOutButton`; `(app)/layout.tsx` and pages call `requireSession()`.
  - Verify: `npm test` passes; signed in on `torque-dev`, the top bar shows the shop name and "Cerrar sesión" works.
- [x] **10. Security headers**
  - Do: `headers()` and `poweredByHeader: false` in `next.config.ts`; the bundle check script, also run in CI after the build.
  - Verify: response headers in the browser dev tools match the design; the bundle check passes.
- [ ] **11. Manual checks**
  - Do: with the owner, on `torque-dev`: wrong password, unknown email and disabled profile show the same message; `next=https://evil.example` lands on `/`; cookies are `HttpOnly` and their values are ciphertext; no project URL, token or id appears in the network tab or page source; a page left open past token expiry still submits; an idle session (limit lowered for the test) is signed out with the inactivity message; sign-out clears the cookies; back button after sign-out redirects; every path except `/ingresar` redirects when signed out; every clickable element shows the hand pointer; the title is centered and error boxes are tinted; measure how Supabase's per-IP limit counts server-side sign-ins and record it in the design's risks.
  - Verify: every acceptance criterion is checked.
- [x] **12. Docs**
  - Do: dashboard settings and env vars in `docs/environments.md`; auth flow in `docs/architecture.md`; auth conventions (DAL, `requireSession`, no browser client) in `docs/conventions.md`; rate limiting noted as backlog; spec statuses to `Done`.
  - Verify: docs match the implemented behavior.
