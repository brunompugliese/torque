# Torque — Architecture

Tense convention: **is** describes what exists today; **will** describes what is planned but not built yet. The rules behind these decisions are in [constitution.md](constitution.md).

## Overview

```
Browser ──► Next.js on Vercel (will) ──► Supabase Data API (PostgREST) ──► Postgres + RLS (is)
                                    └──► Supabase Auth ──► custom_access_token_hook adds shop_id to JWT (is)
```

| Layer | Technology | Status |
|---|---|---|
| Database | Supabase Postgres 17 | Exists |
| API | Supabase auto-generated Data API | Exists |
| Auth | Supabase Auth (email/password), server-side sign-in with encrypted session cookies | Exists (spec 002) |
| Frontend | Next.js 16 (App Router, TypeScript) | App shell exists (spec 001); feature screens planned |
| UI | shadcn/ui (Base UI) + Tailwind CSS v4, Phosphor icons | Exists |
| i18n | `next-intl`, Spanish only | Exists |
| Validation | Zod | Planned |
| Tests | pgTAP for RLS, Vitest + Testing Library for unit and component tests | Vitest exists; pgTAP set up in CI |
| Hosting | GitHub (code), Vercel (frontend), Supabase (backend) | Code on GitHub; deployments planned |

## Backend (exists)

There is no custom backend server. The frontend talks to Postgres through the Supabase Data API, and **all authorization lives in the database**.

### Multi-tenancy

1. Every tenant table has `shop_id`.
2. On sign-in and token refresh, `custom_access_token_hook` (a Postgres function registered as the Supabase *Customize Access Token* hook) reads the user's `profile.shop_id` and adds it as a `shop_id` claim to the JWT.
3. Every RLS policy compares the row's `shop_id` with `auth.jwt() ->> 'shop_id'`, and requires `is_current_profile_enabled()`.
4. Composite foreign keys (`(x_id, shop_id) → x(id, shop_id)`) make it impossible for a row to reference another shop's row, even if RLS were bypassed.
5. `job_status_history` has no `shop_id`; its policy reaches the shop through `job_id`.
6. `job_item.shop_id` is filled by a trigger from its parent job and is never sent by clients.

### Access matrix (`authenticated` role)

| Table | Access |
|---|---|
| `shop` | Read own shop |
| `profile` | Read own shop's profiles |
| `client`, `vehicle`, `service`, `appointment`, `job`, `job_item` | Full CRUD within own shop |
| `job_status_history` | Read within own shop; written only by trigger |
| `brand`, `model` | Global: read by anyone (including `anon`), written by any logged-in user; no RLS |

Access is enforced twice: by RLS policies and by table grants. The default privileges in this project do **not** grant table access to `anon`/`authenticated`, so every new table needs explicit grants.

Roles (`owner`, `receptionist`, `mechanic`) do not change data access: every enabled profile has the same access within its shop, by design.

### Users and profiles

- `profile.id` always references an existing `auth.users.id`.
- Shops and profiles are created by the project owner in the Supabase dashboard (`service_role`), never from the app.
- Setting `profile.enabled = false` bans the auth user via a trigger (`auth.users.banned_until`) and makes every RLS check fail for that user.

### Sensitive data

`client.dni` will be encrypted at column level. The design (key management, keeping per-shop uniqueness and search by DNI) is pending its own spec, which must be implemented before the clients feature and before any real client data reaches production.

### Automatic behavior (triggers)

| Trigger | Effect |
|---|---|
| `set_updated_at` | Bumps `updated_at` on update |
| `set_job_item_shop_id` | Copies `shop_id` from the parent job |
| `log_job_status_change` | Appends to `job_status_history` on job insert or status change, recording `auth.uid()` |
| `sync_profile_enabled_to_auth` | Syncs `profile.enabled` to the auth user's ban status |

### Database files

- `supabase/migrations/`: source of truth for the deployed state. Naming: `<timestamp>_<type>[-<subject>].sql`, where type is `ddl` (structure, policies, triggers), `dcl` (grants/revokes) or `data-insert-<table>-<nnn>` (reference data).
- `db_schema.sql`: human-readable, commented description of the full current schema. Not executed; updated alongside every migration.

## Frontend (partly built)

### Principles

- **Server-first.** Pages will fetch data in Server Components using `@supabase/ssr`, which carries the user's session in cookies. Mutations will go through Server Actions. Client Components only where interactivity requires it.
- **Always as the user.** The frontend will use the anon key plus the user's session, so RLS applies to every query. The `service_role` key will never be used in the app.
- **Typed.** Database types will be generated with `supabase gen types typescript` and committed, never written by hand.
- **One validation, two uses.** Each Zod schema will validate the form on the client and the input in the Server Action.
- **Spanish UI through `next-intl`.** A single `es` locale, no locale prefix in URLs. Dates, numbers and currency will be formatted through `next-intl`/`Intl`, never by hand. DB status values will be mapped to display labels in the message files.

### App shell (exists)

- Every signed-in screen lives in the `src/app/(app)/` route group, whose layout renders the top bar, the page content and the floating bottom navigation. Pages that must not show the shell (e.g. login) will live outside that group.
- URLs are Spanish (`/vehiculos`, `/clientes`, `/turnos`, `/trabajos`). The sections are defined once in `src/lib/navigation.ts`.
- `next-intl` runs without i18n routing: `src/i18n/request.ts` fixes the `es` locale, and `src/global.d.ts` type-checks message keys against `messages/es.json`.
- The theme lives in `src/app/globals.css` (see [conventions.md](conventions.md#colors-and-theming)).

### Authentication (exists)

Designed in [specs/002-login](../specs/002-login/design.md).

- **Sign-in and sign-out run on the server** (Server Actions in `src/features/auth/actions.ts`). No Supabase client exists in the browser.
- **Session cookie:** the tokens `@supabase/ssr` would store, plus a last-activity stamp, are encrypted with AES-256-GCM (`SESSION_COOKIE_SECRET`) and stored in `HttpOnly` `torque-session.<n>` cookies (`src/lib/auth/session-store.ts`). The browser sees only ciphertext.
- **Proxy** (`src/proxy.ts` → `src/lib/supabase/proxy.ts`), on every request except static assets: verifies and refreshes the session (`getClaims`), signs out sessions idle for more than 24 hours (revoking the refresh token), and redirects signed-out visitors from every path except `/ingresar`. This is the optimistic layer.
- **DAL** (`src/lib/auth/session.ts`): `requireSession()` is the authoritative check, called by every app page and before every data access. It verifies the token and requires the `shop_id` claim; users without one are signed out through `GET /salir`.
- **Security headers** are set in `next.config.ts` (framing forbidden, `nosniff`, referrer and permissions policies, HSTS in production). `npm run check:bundle` fails the build in CI if Supabase details appear in browser bundles.

### Structure

Folders marked *(planned)* don't exist yet.

```
src/
  app/                  # Routes (App Router). Thin: compose features, no business logic
    (app)/              # Routes that show the app shell
      _components/      # Components used only by this layout (e.g. MainNav)
  i18n/request.ts       # next-intl config (fixed es locale)
  components/
    ui/                 # shadcn/ui primitives (generated, edited sparingly)
    shared/             # Reusable composed components (data table, calendar, form fields, status badge…)
  features/<domain>/    # Per-domain code (auth and shop exist): vehicle, client, job, appointment, service…
    components/         # Components specific to this domain
    actions.ts          # Server Actions
    queries.ts          # Data access (Supabase queries)
    schemas.ts          # Zod schemas
  lib/
    auth/               # Session store, inactivity rules, redirects, DAL (requireSession)
    supabase/           # Server and proxy Supabase clients (no browser client)
    navigation.ts       # App sections for the navigation
    utils.ts            # cn() and other generic helpers
  types/database.ts     # (planned) Generated Supabase types
messages/es.json        # UI text
supabase/tests/         # pgTAP RLS tests
```

Rule of placement: code starts in `features/<domain>/`. As soon as a second domain needs it, or when it is generic by nature, it moves to `components/shared/` or `lib/`.

### Environments and configuration

- Configuration comes from server-only environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SESSION_COOKIE_SECRET`, validated on first use by `src/lib/env.ts`. None use the `NEXT_PUBLIC_` prefix, so none reach the browser. Values live in `.env.local` locally and in Vercel project settings for deployments. Only `.env.example` is committed.
- There is no local Supabase stack. Local development and Vercel both point to the hosted `torque-dev` project, where the access token hook is registered in the dashboard.
- Migrations are applied by the project owner with `npx supabase db push` to the linked project. Agents write migrations but never apply them.
- A separate production project will be created later. Vercel Production will point to it, while local development and Vercel Preview deployments stay on `torque-dev`. See [environments.md](environments.md) for the setup checklist.
