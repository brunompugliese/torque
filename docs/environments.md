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

### 3. Auth URLs (required)

- [ ] Authentication → URL Configuration → **Site URL**: the app's domain for this environment (e.g. the production Vercel domain).
- [ ] **Redirect URLs**: add the same domain (with `/**`) so auth emails such as password reset link back to the app.

### 4. Vercel (required)

- [ ] Copy the new project's URL and publishable (anon) key from Project Settings → API.
- [ ] Add them as environment variables in the Vercel project, scoped to the right environment (Production for the prod project). Never commit them.
- [ ] Redeploy so the new values take effect.

### 5. Data

- [ ] Create the shop(s), auth users and their profiles in the dashboard.

### 6. Verify

- [ ] Log in to the app as a user of each shop.
- [ ] Confirm the JWT contains `shop_id` and that each user sees only their own shop's data.

### 7. Relink

- [ ] Link back to `torque-dev` (`npx supabase link --project-ref <dev-project-ref>`) so future `db push` runs don't hit production by accident.
