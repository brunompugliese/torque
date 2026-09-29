# Torque — Environments

## Environments

| Environment | Supabase project | Used by | Status |
|---|---|---|---|
| Development | `torque-dev` | Local development, Vercel Preview deployments | Exists |
| Production | To be created | Vercel Production | Planned |

The Supabase CLI applies migrations to whichever project is **linked**. Day-to-day work stays linked to `torque-dev`.

## New Supabase project checklist

Migrations recreate the database, but some settings live in the Supabase platform and must be set by hand. Follow these steps whenever a new project (e.g. production) is created. Never write keys, project refs or passwords into this repo.

### 1. Database

- [ ] Create the project in the Supabase dashboard.
- [ ] Link it: `npx supabase link --project-ref <project-ref>`.
- [ ] Confirm the linked project is the new one: `npx supabase projects list` (the linked project is marked).
- [ ] Apply migrations: `npx supabase db push`.

### 2. Auth hook (required)

Without it, JWTs have no `shop_id` claim and RLS denies every query.

- [ ] Authentication → Hooks → *Customize Access Token*: enable it and select the Postgres function `public.custom_access_token_hook`.

### 3. Auth settings (required)

See [specs/002-login/design.md](../specs/002-login/design.md#supabase-dashboard-settings-not-in-migrations) for the reasons.

- [ ] Authentication → Sign In / Providers → **Allow new users to sign up**: off. Accounts are created only in the dashboard.
- [ ] Email provider → **Confirm email**: on.
- [ ] Password → **Minimum length**: 12. **Requirements**: none. **Leaked password protection**: off.
- [ ] Sessions → time-box and inactivity timeout: off (the app enforces its own 24-hour inactivity limit).
- [ ] Rate limits → sign-ins: keep the default or lower.
- [ ] JWT signing keys: asymmetric (e.g. ES256), recommended so the app can verify tokens without a network call.

### 4. Auth URLs (required)

- [ ] Authentication → URL Configuration → **Site URL**: the app's domain for this environment (e.g. the production Vercel domain).
- [ ] **Redirect URLs**: add the same domain (with `/**`) so auth emails such as password reset link back to the app.

### 5. Vercel (required)

All three variables are server-only; never use the `NEXT_PUBLIC_` prefix for them. See `.env.example`.

- [ ] `SUPABASE_URL`: Project Settings → Data API (Project URL).
- [ ] `SUPABASE_ANON_KEY`: Project Settings → API Keys (publishable key, or the legacy anon key).
- [ ] `SESSION_COOKIE_SECRET`: a new random value for this environment (`openssl rand -base64 32`), marked **Sensitive**. Changing it signs everyone in that environment out.
- [ ] Scope each variable to the right Vercel environment (Production for the prod project). Never commit them.
- [ ] Redeploy so the new values take effect.

### 6. Data

- [ ] Create the shop(s), auth users and their profiles in the dashboard.

### 7. Verify

- [ ] Log in to the app as a user of each shop.
- [ ] Confirm the JWT contains `shop_id` and that each user sees only their own shop's data.

### 8. Relink

- [ ] Link back to `torque-dev` (`npx supabase link --project-ref <dev-project-ref>`) so future `db push` runs don't hit production by accident.
