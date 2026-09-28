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
| Auth | Supabase Auth (email/password) | Exists |
| Frontend | Next.js (App Router, TypeScript) | Planned |
| UI | shadcn/ui + Tailwind CSS | Planned |
| i18n | `next-intl`, Spanish only | Planned |
| Validation | Zod | Planned |
| Tests | pgTAP for RLS, Vitest for unit tests | Planned |
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

## Frontend (planned)

### Principles

- **Server-first.** Pages will fetch data in Server Components using `@supabase/ssr`, which carries the user's session in cookies. Mutations will go through Server Actions. Client Components only where interactivity requires it.
- **Always as the user.** The frontend will use the anon key plus the user's session, so RLS applies to every query. The `service_role` key will never be used in the app.
- **Typed.** Database types will be generated with `supabase gen types typescript` and committed, never written by hand.
- **One validation, two uses.** Each Zod schema will validate the form on the client and the input in the Server Action.
- **Spanish UI through `next-intl`.** A single `es` locale, no locale prefix in URLs. Dates, numbers and currency will be formatted through `next-intl`/`Intl`, never by hand. DB status values will be mapped to display labels in the message files.

### Planned structure

```
src/
  app/                  # Routes (App Router). Thin: compose features, no business logic
  components/
    ui/                 # shadcn/ui primitives (generated, edited sparingly)
    shared/             # Reusable composed components (data table, calendar, form fields, status badge…)
  features/<domain>/    # Per-domain code: vehicle, client, job, appointment, service…
    components/         # Components specific to this domain
    actions.ts          # Server Actions
    queries.ts          # Data access (Supabase queries)
    schemas.ts          # Zod schemas
  lib/
    supabase/           # Supabase client factories (server, browser, middleware)
    utils/              # Generic helpers
  types/database.ts     # Generated Supabase types
messages/es.json        # UI text
supabase/tests/         # pgTAP RLS tests
```

Rule of placement: code starts in `features/<domain>/`. As soon as a second domain needs it, or when it is generic by nature, it moves to `components/shared/` or `lib/`.

### Environments and configuration

- Configuration will come from environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the app. Values live in `.env.local` locally and in Vercel project settings for deployments. Only `.env.example` is committed.
- There is no local Supabase stack. Local development and Vercel both point to the hosted `torque-dev` project, where the access token hook is registered in the dashboard.
- Migrations are applied by the project owner with `npx supabase db push` to the linked project. Agents write migrations but never apply them.
- A separate production project will be created later. Vercel Production will point to it, while local development and Vercel Preview deployments stay on `torque-dev`. See [environments.md](environments.md) for the setup checklist.
