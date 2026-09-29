# 002 — Login: Requirements

**Status:** Approved

## Problem

The app shell (spec 001) is reachable by anyone and shows no shop. Staff need to sign in with the account the owner created for them, only signed-in staff of an enabled profile may see the app, and the sign-in itself must resist common attacks (password guessing, account enumeration, open redirects, session theft, clickjacking).

## Users

All roles (`owner`, `receptionist`, `mechanic`). Accounts, profiles and passwords are created and reset by the project owner in the Supabase dashboard; there is no sign-up.

## User stories

- As a staff member, I want to sign in with my email and password, so that I can use the app.
- As a staff member, I want to land on the page I was trying to open after signing in, so that I don't have to navigate again.
- As a staff member, I want to see my shop's name in the top bar, so that I know which shop I'm working in.
- As a staff member, I want to stay signed in while I keep using the app, so that I don't have to re-enter my password during the work day.
- As the owner, I want a device nobody has used for 24 hours to be signed out automatically, so that a forgotten session on a shared or lost device doesn't stay open.
- As a staff member on a shared computer, I want to sign out, so that the next person can't use my session.
- As the owner, I want a disabled profile to lose access, so that former staff can't get in.
- As the owner, I want sign-in errors to reveal nothing about which emails have accounts, so that attackers can't list our staff.
- As the owner, I want no credentials, tokens or project details to be readable in the browser (cookies, network tab, page source), so that someone with access to the device learns as little as possible.

## Acceptance criteria

Access control

- [ ] Given a visitor without a session, when they request any path other than `/ingresar` (app pages such as `/vehiculos/123`, unknown paths, route handlers), then they are redirected to `/ingresar?next=<path>`. Only the static assets the login page itself needs (Next.js build files, fonts, favicon) are served without a session.
- [ ] Given a signed-in user, when they open `/ingresar`, then they are redirected to `/`.
- [ ] Given a signed-in user whose token has no `shop_id` claim (no profile, or the auth hook is missing), when they open an app page, then their session is ended and they are sent to `/ingresar` with the "account unavailable" message.
- [ ] Given a signed-in user, when an app page renders, then the top bar shows "Torque × <shop name>".

Sign-in form

- [ ] Given `/ingresar`, when it loads, then it shows the "Torque" name, a centered "Iniciar sesión" heading (no subtitle), an email field, a password field, a show/hide password control and an "Iniciar sesión" button, and the email field has focus.
- [ ] Given the form, when inspected, then the email field has `type="email"` and `autocomplete="username"`, and the password field has `autocomplete="current-password"`, so password managers work.
- [ ] Given the password field, when the user activates the show/hide control, then the password toggles between hidden and visible, and the control's accessible name and `aria-pressed` state reflect it.
- [ ] Given an empty or malformed email, or an empty password, when the user submits, then a Spanish message appears under the field, the field is marked `aria-invalid`, and no request reaches Supabase Auth.
- [ ] Given the same invalid input sent directly to the server (bypassing the browser), when the server action runs, then it rejects it with the same validation and does not call Supabase Auth.
- [ ] Given an email longer than 254 characters, when submitted, then it is rejected by validation.
- [ ] Given a non-empty password of any length or content, when submitted, then the form sends it to the server as typed (no length or character rules at sign-in); only Supabase Auth decides whether it's correct. Password rules apply only where passwords are created or changed.
- [ ] Given a submission in progress, when the user looks at the form, then the button is disabled and shows a pending label, so the form can't be submitted twice.
- [ ] Given any enabled clickable element in the app (buttons, links, the show/hide password control, the navigation items), when the mouse is over it, then the pointer is a hand. Disabled buttons show the not-allowed pointer instead.
- [ ] Given a form-level error such as "Email o contraseña incorrectos.", when it is shown inside a container (box), then the container has a translucent tint of the error color as its background, with a matching border, so the message stands out while staying legible. Field errors shown as plain text under a field have no container.

Sign-in outcomes

- [ ] Given valid credentials of an enabled profile, when the user submits, then they are signed in and sent to the validated `next` path, or `/` if there is none.
- [ ] Given a `next` value that is not a same-site relative path (e.g. `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`), when sign-in succeeds, then the user is sent to `/`.
- [ ] Given a wrong password, an unknown email, a disabled (banned) profile or an unconfirmed email, when the user submits, then the same message is shown: "Email o contraseña incorrectos." The email stays filled in (kept by the browser, not echoed back by the server) and the password is cleared.
- [ ] Given Supabase Auth rate-limits the request, when the user submits, then they see "Demasiados intentos. Esperá unos minutos y volvé a intentar."
- [ ] Given valid credentials of a user with no profile (no `shop_id` claim), when they submit, then their session is ended immediately and they see "Tu cuenta no está habilitada. Contactá al responsable del taller."
- [ ] Given any other failure, when the user submits, then they see a generic "No se pudo iniciar sesión. Intentá de nuevo." and the server logs only the error code, never the email or password.

Sign-out

- [ ] Given a signed-in user, when they activate "Cerrar sesión" in the top bar, then the session on this device is ended, the auth cookies are removed, and they land on `/ingresar`.
- [ ] Given a signed-out user, when they press the browser's back button, then app pages do not show data from the previous session (they redirect to `/ingresar`).

Session lifetime

- [ ] Given a signed-in user whose access token has expired (Supabase's default is 1 hour), when they open a page or submit a form, then the session is refreshed on the server without asking for the password again.
- [ ] Given a signed-in user who used the app less than 24 hours ago, when they open it again (even after closing the browser), then they are still signed in.
- [ ] Given a signed-in user whose last request was more than 24 hours ago, when they open any page, then the session is ended on the server (the refresh token is revoked, not just the cookie deleted) and they are sent to `/ingresar` with "Tu sesión se cerró por inactividad. Iniciá sesión de nuevo."
- [ ] Given a signed-in user, when they make any request, then the 24-hour window starts again from that request.

Session and transport security

- [ ] Given a successful sign-in, when the auth cookies are inspected, then they are `HttpOnly`, `SameSite=Lax`, `Secure` outside local development, named without the Supabase project ref, and their values are encrypted: no token, email, user id or shop id can be read from them.
- [ ] Given any page, when its response headers are inspected, then it forbids framing (`X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`) and sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`.
- [ ] Given the server checks who the user is, when it does so, then it uses a verified token (`getClaims`), never the unverified cookie session (`getSession`).
- [ ] Given the codebase, when searched, then the `service_role` key is not used and no Supabase browser client is created.
- [ ] Given the page source, JavaScript bundles and network responses, when inspected, then they contain no Supabase URL, anon key, access or refresh token, user id or shop id. (The only credential that ever travels is the password the user types, sent once over HTTPS in the sign-in request.)
- [ ] Given any response, when its headers are inspected, then there is no `X-Powered-By` header.

## Out of scope

- Self-service password reset (own spec, after a custom SMTP provider is set up). Until then the owner resets passwords in the dashboard.
- Sign-up. Accounts are created only in the dashboard; public sign-up is turned off there (see design).
- CAPTCHA. Supabase Auth's per-IP rate limits are the brute-force protection for now.
- App-side rate limiting (per IP and per email). In the backlog; decided by the owner.
- Breached-password checks. Decided by the owner: not enabled.
- Two-factor authentication (own spec).
- A full Content Security Policy for scripts and styles (own spec; it needs per-request nonces).
- A "remember me" option. Every session follows the same 24-hour inactivity rule.

## Open questions

- None. Decided with the owner: no self-service reset, no CAPTCHA, MFA later, URL `/ingresar`, passwords of at least 12 characters with no other rules when they are set (dashboard now, a future registration or password-change form later) but no password rules at sign-in, no breached-password checks, encrypted session cookies, 24-hour sliding inactivity timeout, no disposable-email check at login (it belongs to future forms that collect emails), rate limiting in the backlog, hand pointer on every clickable element, tinted background on error containers.
