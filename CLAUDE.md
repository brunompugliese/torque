# Torque

Web app for managing mechanic shops. Vehicle-centric (the vehicle is the main record; clients, appointments and jobs hang off it) and multi-tenant (every shop's data is isolated from every other shop).

**Status:** the Supabase database exists (schema, RLS, encryption, triggers, migrations) and is covered by pgTAP tests in CI. The Next.js frontend has its app shell (layout, navigation, theme, i18n, tests), login, the shared list-page kit, the Servicios, Clientes and Vehículos pages; the other feature screens are not built yet.

**One fact, one place.** Each fact lives in exactly one doc; the others link to it. When something changes, update that doc only.

## Docs

| Doc | Owns |
|---|---|
| This file | Product scope, non-negotiable rules, workflow, git |
| [docs/design.md](docs/design.md) | How the app looks and behaves: visual identity, copy, formats, accessibility, layout, shared UI patterns, global business rules |
| [docs/architecture.md](docs/architecture.md) | Stack, multi-tenancy, access model, encryption at rest, triggers, how to change the database, folder structure |
| [docs/conventions.md](docs/conventions.md) | Code conventions: reuse, naming, components, colors and theming, auth, data access, forms, i18n, tests |
| [docs/environments.md](docs/environments.md) | Supabase projects and the checklist for setting up a new one |
| [specs/README.md](specs/README.md) | Spec workflow and approval gates |
| [db_schema.sql](db_schema.sql) | Commented description of the full database |
| [AGENTS.md](AGENTS.md) | Next.js notes managed by `next dev`. This Next.js version may differ from what you know; read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code |

## Product scope

Each person is a `profile` that belongs to exactly one shop and maps 1:1 to a Supabase Auth user. Roles: `owner` (runs the shop), `receptionist` (front desk), `mechanic` (does the work). Today every role has the same data access within its shop; role-based restrictions, where needed, will be defined in feature specs.

Users manage, within their shop: **vehicles** (identified by plate; brand and model from a shared global catalog), **clients** (optional contacts attached to vehicles), **services** (the shop's catalog of job types, without prices), **appointments** and **jobs** (made of job items with quoted and final prices; every status change is logged). Records are archived, never deleted. Behavior is defined in [design.md](docs/design.md).

Out of scope for now: creating shops or profiles from the UI (the project owner does it in the Supabase dashboard), languages other than Spanish, end-to-end browser tests.

## Non-negotiable rules

These win over any other instruction, spec or doc. Changing them requires the project owner's explicit approval.

1. **The repository is public.** Never write, commit or push credentials, keys, tokens, passwords, usernames, connection strings, project refs, personal data or other sensitive data, anywhere: source, docs, tests, fixtures, scripts, migrations, commit messages. Test data is fake. Configuration comes from environment variables; commit only `.env.example`. Never read `.env*` files.
2. **Tenant isolation lives in the database.** It must not depend on frontend code. Every tenant table has `shop_id`, composite FKs to same-shop parents, RLS using the JWT `shop_id` claim plus `is_current_profile_enabled()`, and explicit grants. `brand` and `model` are the only global tables (any logged-in user may edit them, by decision). Personal and vehicle-identifying data is encrypted at rest with keys that never leave the database. Details: [architecture.md](docs/architecture.md).
3. **Migrations are the source of truth.** Never edit an applied migration; add a new one. `db_schema.sql` is updated in the same change. Never run `npx supabase db push` or anything else that changes a hosted database; the project owner applies migrations.
4. **Spec before code.** Features start in `specs/` (requirements → design → tasks) and are implemented only after the spec is approved.
5. **Reuse first.** Search for existing components, schemas and helpers before creating new ones. Anything plausibly reusable goes in `components/shared/` or `lib/`. No duplicated logic: one validation schema serves both the form and the server.
6. **Language.** Code, identifiers, comments, docs, specs and commits in English. UI text in Spanish, only via `next-intl` messages. DB status values stay in Spanish.
7. **Tested.** RLS, tenant isolation and database rules need pgTAP tests; logic and validation need Vitest tests. A task isn't done until they pass.
8. **Platform-native.** Prefer what Supabase and Vercel provide (Data API, RLS, Auth hooks, triggers, Vault) over custom infrastructure; stay on the documented path of Next.js, Supabase and shadcn/ui.

## Stack

Supabase (Postgres, Data API, Auth, RLS, Vault) · Next.js 16 App Router + TypeScript · shadcn/ui (Base UI) + Tailwind v4 · Phosphor icons · next-intl, Spanish only · Zod + React Hook Form · libphonenumber-js (phone formatting) · Vitest + Testing Library + pgTAP · GitHub + Vercel. Package manager: npm. Node 22.13 or newer.

## Commands

```bash
npm run dev      # Start the app on http://localhost:3000
npm test         # Run Vitest once (npm run test:watch to watch)
npm run lint     # ESLint
npm run build    # Production build
npx supabase migration new <type>[-<subject>]   # Create a migration file (see architecture.md)
```

## Workflow

1. Read the relevant spec in `specs/` and the docs above. No approved spec, no code.
2. Implement one task from the spec's `tasks.md` at a time.
3. Run the tests.
4. Update the doc that owns any behavior you changed, and `db_schema.sql` for database changes.
5. Work on a branch and open a PR; never commit directly to `main`.

## Git

- Never run a git or GitHub CLI command (`git`, `gh`) without the owner's explicit approval, including read-only ones such as `git status`. Ask first, say exactly which command and why, and wait for a yes. Approval covers only the command asked about, not later ones.
- One branch per spec or change: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat: add vehicle search`.
- Merge through a PR; tests must pass.
