# Torque — Constitution

The principles in this document rarely change and apply to every spec, plan and line of code. If a spec or instruction contradicts it, this document wins. Changing it requires the project owner's explicit approval.

Tense convention: **is** describes what exists today; **will** describes what is planned but not built yet.

## 1. Product

Torque is a web app for managing mechanic shops. It is **vehicle-centric**: just as a doctor treats patients, a mechanic treats vehicles. The vehicle is the main entity. Clients, appointments and jobs revolve around it, and a vehicle's history is the core of the product.

### Users

Each person is a `profile` that belongs to exactly one shop and maps 1:1 to an existing Supabase Auth user.

| Role | Who |
|---|---|
| `owner` | Runs the shop |
| `receptionist` | Handles clients, vehicles and appointments at the front desk |
| `mechanic` | Performs the work on vehicles |

Today every role has the same data permissions within its shop. Role-based restrictions, where needed, will be defined in feature specs.

### Domain

Users will manage, within their shop:

- **Clients**: the people who own or bring in vehicles.
- **Vehicles**: identified by plate (unique per shop); brand and model come from a shared global catalog.
- **Services**: the shop's catalog of named job types.
- **Appointments**: scheduled visits for a vehicle.
- **Jobs**: work performed on a vehicle, made of **job items** (services with frozen prices). Every job status change is logged automatically in **job status history**.

### Out of scope (for now)

- Creating shops from the UI. The project owner creates them in the Supabase dashboard.
- Creating or editing profiles from the UI. Profiles are read-only for users and managed in the dashboard.
- Languages other than Spanish in the UI.
- End-to-end (browser) tests.

## 2. Principles

### I. Tenant isolation is enforced by the database

- Every tenant table has a `shop_id` and row-level security (RLS). Data from one shop must never be reachable from another.
- Isolation must not depend on frontend code: the frontend may be wrong, the database may not.
- The only exceptions are `brand` and `model`, a global catalog shared by all shops on purpose (reusable, low write activity). Any logged-in user may edit it. This is an accepted business decision.

### II. No credentials, ever

The repository is public: everything committed, including history, is visible to anyone. Never hardcode, include, commit or push personal data, credentials, API keys, tokens, usernames, passwords, connection strings, project refs or any other sensitive data. This covers source, docs, tests, scripts, migrations and commit messages. Configuration comes from environment variables, and only an `.env.example` with placeholder values is committed.

### III. Reuse first

- Efficient, clean, reusable code is the priority.
- If a component, validation, query, hook or helper could plausibly be reused, build it to be reusable from the start and place it in the shared location defined in [architecture.md](architecture.md).
- Before creating something new, check whether it already exists.
- No duplicated logic: one validation schema serves both the form and the server.

### IV. Spec before code

Every feature starts as a spec in `specs/` (requirements → design → tasks) and is implemented only after the spec is approved. Specs and docs are updated when behavior changes.

### V. Tested

- RLS and tenant isolation are covered by database tests.
- Business logic and validations are covered by unit tests.
- A change is not done until its tests pass.

### VI. Platform-native

Prefer what Supabase and Vercel provide (Data API, RLS, Auth, Auth hooks, triggers, Vercel deployments) over custom infrastructure. Stay on the mainstream, documented path of Next.js, Supabase and shadcn/ui.

### VII. Language

| What | Language |
|---|---|
| Code, identifiers, comments, docs, specs, commits | English |
| UI text | Spanish, always through `next-intl` message files, never hardcoded |
| Database status values (e.g. `pendiente`, `en_progreso`) | Spanish, stored as-is; the UI shows labels from message files |

### VIII. The database has two sources, each with a role

- **Migrations** (`supabase/migrations/`) are the source of truth for the database's actual state, because they are what gets deployed.
- **`db_schema.sql`** is the readable, commented description of the full current structure, including business-decision comments. It is not executed. It must be updated in the same change as any migration.
