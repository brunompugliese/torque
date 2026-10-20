# Torque — Architecture

Tense convention: **is** describes what exists today; **will** describes what is planned but not built yet. The rules behind these decisions are in [CLAUDE.md](../CLAUDE.md#non-negotiable-rules); how the app looks and behaves is in [design.md](design.md).

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
| `client_decrypted`, `vehicle_decrypted`, `appointment_decrypted`, `job_decrypted` | Read-only views; same rows as their base table's RLS allows |
| `brand`, `model` | Global: read by anyone (including `anon`), written by any logged-in user; no RLS |

Access is enforced twice: by RLS policies and by table grants. The default privileges in this project do **not** grant table access to `anon`/`authenticated`, so every new table needs explicit grants.

Roles (`owner`, `receptionist`, `mechanic`) do not change data access: every enabled profile has the same access within its shop, by design.

### Users and profiles

- `profile.id` always references an existing `auth.users.id`.
- Shops and profiles are created by the project owner in the Supabase dashboard (`service_role`), never from the app.
- Setting `profile.enabled = false` bans the auth user via a trigger (`auth.users.banned_until`) and makes every RLS check fail for that user.

### Sensitive data

Personal and vehicle-identifying data is encrypted at rest:

| Table | Encrypted columns |
|---|---|
| `client` | `name`, `surname`, `dni`, `phone_number`, `email` |
| `vehicle` | `plate`, `vin` |
| `appointment` | `reason` (free text that can contain personal details) |
| `job` | `observations` (same reason) |

- **Keys** live in Supabase Vault (`torque_data_key`, `torque_hash_key`), created by hand per project ([environments.md](environments.md)). They never leave the database and never reach the app or the browser.
- **Writes** send plaintext to the tables as usual. A `BEFORE` trigger per table normalizes (plate uppercase without spaces, DNI digits only), hashes and encrypts the values, so tables hold only ciphertext.
- **Uniqueness:** plate and DNI also get a keyed hash (HMAC-SHA256) of the normalized value, stored in `vehicle.plate_hash` / `client.dni_hash`, with `unique (shop_id, hash)`. Hash columns are set only by the trigger.
- **Reads** go through `security_invoker` views: `client_decrypted`, `vehicle_decrypted`, `appointment_decrypted`, `job_decrypted`. They decrypt only the rows RLS lets the user see. After a write, read the row back through its view.
- **Search, sorting and pagination** run in the database on the views (and on `service`, which isn't encrypted: its `name_key` and `search_text` columns are set by `trg_service_normalize` on every write). `client_decrypted` and `vehicle_decrypted` expose `search_text` (lowercase, no accents, no spaces, dots or dashes; vehicles include brand and model); the app normalizes the search term the same way and filters with `ilike`. `client_decrypted` also exposes sort keys computed from the decrypted values and never stored: `name_key` (normalized name and surname), `dni_number` (numeric, so 7-digit DNIs sort before 8-digit ones), `phone_key` (digits only) and `email_key` (lowercase). `vehicle_decrypted` exposes `brand_name` and `model_name`. Decrypting in queries is fine at a single shop's scale; revisit if a shop grows to many thousands of rows.
- **Never in URLs.** Values of encrypted columns, and search terms on pages that search them (Clientes, Vehículos, Turnos, Trabajos), never go in a URL: not in paths, query params or redirect targets such as `?next=`. URLs outlive the session (browser history, address-bar suggestions on a shared computer) and reach the hosting provider's request logs, outside the shop's access control. Such pages keep the search term in component state and send it in the Server Action's body; non-sensitive list state (sort, page, archived switch) may stay in the URL. Records are addressed by id, never by plate or DNI.
- Helpers (`private.encrypt_text`, `decrypt_text`, `blind_index`, `normalize_search`, `vault_secret`) live in the `private` schema, which the Data API doesn't expose. `authenticated` can only execute `decrypt_text` and `normalize_search`.

### Automatic behavior (triggers)

| Trigger | Effect |
|---|---|
| `set_updated_at` | Bumps `updated_at` on update |
| `set_job_item_shop_id` | Copies `shop_id` from the parent job |
| `log_job_status_change` | Appends to `job_status_history` on job insert or status change, recording `auth.uid()` |
| `sync_profile_enabled_to_auth` | Syncs `profile.enabled` to the auth user's ban status |
| `encrypt_client`, `encrypt_vehicle`, `encrypt_appointment`, `encrypt_job` | Normalize, hash and encrypt sensitive columns on write (see [Sensitive data](#sensitive-data)) |
| `guard_closed_job`, `guard_closed_job_item` | A job in `entregado` or `cancelado` can only be archived/unarchived; its items can't change |
| `check_job_kilometers` | A job's km can't be lower than the vehicle's previous non-archived jobs |
| `normalize_service` | Sets `service.name_key` (normalized name: A–Z sort and the app's "name taken" lookup) and `service.search_text` on every write, overwriting client values |
| `check_appointment_parents_active`, `check_job_parents_active`, `check_job_item_service_active` | No new appointments/jobs on archived vehicles, no archived clients on jobs, no archived services on job items |

Business-rule triggers raise SQLSTATE `23514` with a stable message (`job_closed`, `job_kilometers_below_previous`, `vehicle_archived`, `client_archived`, `service_archived`) that the app maps to UI text.

## Changing the database

The model itself is described in [db_schema.sql](../db_schema.sql).

### Two files, two roles

| File | Role |
|---|---|
| `supabase/migrations/*.sql` | **Source of truth.** What is actually deployed. Executed in order by `db push`. |
| `db_schema.sql` | **Description.** The full current schema in one readable file, with comments explaining business decisions. Never executed. |

Every change touches both, in the same PR.

### Workflow

1. The change is described in an approved spec (`specs/`).
2. Create the migration(s): `npx supabase migration new <type>[-<subject>]`.
3. Update `db_schema.sql` so it reflects the new state, including a comment for any non-obvious decision.
4. Add or update pgTAP tests in `supabase/tests/` for any change to tables, policies, grants or triggers.
5. Open a PR. Tests run in GitHub Actions.
6. The project owner applies the migration to `torque-dev` with `npx supabase db push`.
7. Regenerate the frontend's types and commit them: `npx supabase gen types typescript --linked > src/types/database.ts`. Never write them by hand.

### Migration rules

- **Never edit an applied migration.** Fix or undo it with a new one.
- **Naming:** `<timestamp>_<type>[-<subject>].sql`
  - `ddl`: tables, indexes, functions, triggers, RLS policies, views.
  - `dcl`: grants and revokes.
  - `data-insert-<table>-<nnn>`: reference data (e.g. `brand`, `model`).
- **One concern per file.** A change that needs both structure and grants gets a `ddl-` and a `dcl-` file with the same subject.
- **Re-runnable where possible:** `create or replace` for functions, triggers and views, `drop policy if exists` before `create policy`.
- **Every file starts with a header comment** saying what it does and why.

### Schema conventions

| Item | Convention |
|---|---|
| Tables, columns | Singular, `snake_case` (`job_item`, `phone_number`) |
| Primary key | `id uuid primary key default gen_random_uuid()` |
| Foreign keys | `<table>_id`; composite `(x_id, shop_id)` when the parent is a tenant table |
| Timestamps | `created_at timestamptz not null default now()`; `updated_at` plus a `set_updated_at` trigger on mutable tables |
| Archiving | Records are never deleted from the UI: `enabled = false` means archived (`client`, `vehicle`, `service`, `job`), so history stays intact |
| Sensitive data | Encrypted by a `trg_<table>_encrypt` trigger and read through `<table>_decrypted` (see [Sensitive data](#sensitive-data)). Unique sensitive values get a `<column>_hash` with `unique (shop_id, <column>_hash)` |
| Business-rule errors | `raise exception using errcode = '23514', message = '<snake_case_code>'`; the app maps the code to UI text |
| Status values | Spanish, `snake_case`, enforced with a `check` constraint (e.g. `en_progreso`) |
| Money | `numeric` |
| Indexes | `idx_<table>_<columns>` |
| Triggers | `trg_<table>_<purpose>` |
| Policies | `tenant_isolation` (all operations) or `tenant_isolation_<operation>` |

### Functions

- Always `set search_path = ''` and schema-qualify every object (`public.job`, `auth.uid()`).
- Use `security definer` only when the function must bypass RLS or read Vault, and say why in a comment.
- `revoke execute … from public, anon` and grant only to the roles that need it. Internal helpers go in the `private` schema.

### New tenant table checklist

- [ ] `shop_id uuid not null references shop(id)`
- [ ] `unique (id, shop_id)` if other tables will reference it
- [ ] Composite FKs `(parent_id, shop_id)` to every tenant parent
- [ ] Index on `shop_id` and on each foreign key
- [ ] `alter table … enable row level security`
- [ ] Policy with both `using` and `with check`: `shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid and public.is_current_profile_enabled()`
- [ ] Explicit grants to `authenticated`; `revoke all … from anon`; revoke `truncate, references, trigger, maintain` from `authenticated`
- [ ] `updated_at` trigger if the table is mutable
- [ ] Sensitive columns: encryption trigger, hash column for unique values, `_decrypted` view with `security_invoker = true`, and its grants
- [ ] pgTAP tests (below)
- [ ] `db_schema.sql` updated

Tables without their own `shop_id` (like `job_status_history`) must reach the shop through their parent in the policy.

### Database tests

Tests live in `supabase/tests/` and use [pgTAP](https://pgtap.org/); [supabase/tests/README.md](../supabase/tests/README.md) lists what each file covers and how to write one with the shared fixtures. They run in GitHub Actions against a temporary database built from the migrations, never against a hosted project.

Each test runs in a transaction that is rolled back, creates its own shops, users and profiles (and throwaway Vault secrets with `vault.create_secret(...)`), and simulates a logged-in user:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub": "<user-uuid>", "shop_id": "<shop-uuid>"}';
```

Every tenant table must be tested for:

- A user sees only rows of their own shop.
- A user cannot insert or update a row with another shop's `shop_id`.
- A user cannot reference another shop's rows through foreign keys.
- A disabled profile sees nothing.
- `anon` sees nothing.

Read-only tables (`shop`, `profile`, `job_status_history`) must also be tested to reject insert, update and delete. Encryption and business-rule triggers need tests too: ciphertext in the tables and plaintext through the views, duplicate plate/DNI rejected per shop but allowed across shops, and every rule error code.

## Frontend (partly built)

### Principles

- **Server-first.** Pages will fetch data in Server Components using `@supabase/ssr`, which carries the user's session in cookies. Mutations will go through Server Actions. Client Components only where interactivity requires it.
- **Always as the user.** The frontend will use the anon key plus the user's session, so RLS applies to every query. The `service_role` key will never be used in the app.
- **Typed.** Database types will be generated (see [Workflow](#workflow)), never written by hand.
- **One validation, two uses.** Each Zod schema will validate the form on the client and the input in the Server Action.
- **Spanish UI through `next-intl`.** A single `es` locale, no locale prefix in URLs. Dates, numbers and currency will be formatted through `next-intl`/`Intl`, never by hand. DB status values will be mapped to display labels in the message files.

### App shell (exists)

- Every signed-in screen lives in the `src/app/(app)/` route group, whose layout renders the top bar, the page content and the floating bottom navigation. Pages that must not show the shell (e.g. login) will live outside that group.
- URLs are Spanish (`/inicio`, `/vehiculos`, `/clientes`, `/turnos`, `/trabajos`, `/servicios`); `/login` is outside the shell and `/` redirects to `/inicio`. The sections are defined once in `src/lib/navigation.ts`.
- Toasts: one `Toaster` (shadcn Sonner, `src/components/ui/sonner.tsx`) is mounted in the root layout. A one-time toast after a redirect uses `FlashToast` (`src/components/shared/flash-toast.tsx`), which also removes its query parameter from the URL.
- `next-intl` runs without i18n routing: `src/i18n/request.ts` fixes the `es` locale, and `src/global.d.ts` type-checks message keys against `messages/es.json`.
- The theme lives in `src/app/globals.css` (see [conventions.md](conventions.md#colors-and-theming)).

### List pages (exists)

Built by [specs/004-services](../specs/004-services/design.md) and extended by [specs/005-clients](../specs/005-clients/design.md); every list page reuses it. Behavior is in [design.md](design.md#list-pages).

- **State in the URL:** `?buscar=&archivados=1&orden=creado&sentido=desc&pagina=2` (`buscar` only on pages that don't search encrypted data, see [Sensitive data](#sensitive-data)) (`orden` is a column id, absent until a header is clicked, when the page's default order applies and no header is marked; `sentido=desc` reverses it), parsed by `lib/list/params.ts` on the server and updated by the `useListUrl` hook (`hooks/use-list-url.ts`) on the client with `history.replaceState`, so changing it doesn't re-render the page (search debounced 200 ms; any change but paging returns to page 1).
- **Server query:** `applyListQuery` (`lib/list/query.ts`) maps the column id to a database column through a per-page whitelist (unknown ids fall back to the default), and adds search on a normalized `search_text` column (always including archived rows), the archived filter, sorting with empty values last in both directions and an `id` tie-breaker, and the 25-row range. Pages over encrypted data read through the `_decrypted` view and write to the table (the saved row is read back through the view); counts use `head` queries on the table, which needs no decryption. Queries are wrapped in `cache()` so the summary, the count and the table share one request.
- **Loading:** the first render streams the summary and the list (toolbar + table) in `<Suspense>` boundaries with skeleton fallbacks; each route also has a `loading.tsx`.
- **Search, sort, filters and paging** don't reload the page: `useListResults` (`hooks/use-list-results.ts`) starts from the server-rendered rows and, when the URL's list state changes, calls the page's search Server Action (e.g. `searchServices`), which runs only the list query. Old results stay on screen until the new ones arrive; late answers to older requests are dropped.
- **Components** (`components/shared/`): `DataTable` (+ `DataTableSkeleton`), `ListToolbar` (+ `ListToolbarSkeleton`), `PaginationBar`, `ListEmpty`, `ListError`, `ArchivedBadge`, `DetailModal`, `DetailList`, `ConfirmDialog`, `LoadingRegion`, `TextSkeleton`, `ListUrlToolbar` (the toolbar wired to the URL state: a page only passes the search placeholder), `ListNoRows` (the three empty states: no results for a search, no records, only archived records), `SearchBox` (also used on its own), `PlateDisplay`, `WhatsappButton`.
- **Short lists inside a modal** (e.g. the vehicles to assign to a client) are loaded once and filtered and paged in memory: `filterByText` and `paginate` (`lib/list/memory.ts`) with `SearchBox` and `PaginationBar`, so searching makes no request. Data a modal loads when it opens comes from `useLoadedData` (`hooks/use-loaded-data.ts`: loading, error with retry, ready; late answers dropped) and shows the shared skeleton while loading.
- **Detail modals** open from the row already loaded (no request); writes are Server Actions that call `revalidatePath`, so the summary and the list refresh in the same response (`useListResults` adopts the new server rows).

### Authentication (exists)

Designed in [specs/002-login](../specs/002-login/design.md).

- **Sign-in and sign-out run on the server** (Server Actions in `src/features/auth/actions.ts`). No Supabase client exists in the browser.
- **Session cookie:** the tokens `@supabase/ssr` would store, plus a last-activity stamp, are encrypted with AES-256-GCM (`SESSION_COOKIE_SECRET`) and stored in `HttpOnly` `torque-session.<n>` cookies (`src/lib/auth/session-store.ts`). The browser sees only ciphertext.
- **Proxy** (`src/proxy.ts` → `src/lib/supabase/proxy.ts`), on every request except static assets: verifies and refreshes the session (`getClaims`), signs out sessions idle for more than 24 hours (revoking the refresh token), and redirects signed-out visitors from every path except `/login`. This is the optimistic layer.
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
  features/<domain>/    # Per-domain code (auth, shop, service, client and vehicle exist; vehicle has only what the client modal needs so far): job, appointment…
    components/         # Components specific to this domain
    actions.ts          # Server Actions
    queries.ts          # Data access (Supabase queries)
    schemas.ts          # Zod schemas
  hooks/                # Client hooks (useListUrl, useListResults, useLoadedData)
  lib/
    actions/            # ActionResult, ok(), fail()
    auth/               # Session store, inactivity rules, redirects, DAL (requireSession)
    data/               # Generic lookups: findByKey (uniqueness), existsWhere
    format/             # DATE_FORMAT, APP_TIME_ZONE, formatPlate, formatDni, toWhatsappUrl
    list/               # List URL params, pagination, applyListQuery, in-memory filter and pager
    search/             # normalizeSearch, the app twin of private.normalize_search
    supabase/           # Server and proxy Supabase clients (no browser client)
    navigation.ts       # App sections for the navigation
    utils.ts            # cn() and other generic helpers
  test/                 # Test helpers: renderWithIntl, createFakeSupabase
  types/database.ts     # (planned) Generated Supabase types
messages/es.json        # UI text
supabase/tests/         # pgTAP RLS tests
```

Rule of placement: code starts in `features/<domain>/`. As soon as a second domain needs it, or when it is generic by nature, it moves to `components/shared/` or `lib/`.

### Environments and configuration

- Configuration comes from server-only environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SESSION_COOKIE_SECRET`, validated on first use by `src/lib/env.ts`. None use the `NEXT_PUBLIC_` prefix, so none reach the browser. Values live in `.env.local` locally and in Vercel project settings for deployments.
- There is no local Supabase stack. Local development and Vercel point to the hosted `torque-dev` project. Projects, and how to set up a new one, are in [environments.md](environments.md).
