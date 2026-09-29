# Torque

Web app for managing mechanic shops. Vehicle-centric and multi-tenant: every shop's data is isolated from every other shop.

**Status:** the Supabase database exists (schema, RLS, triggers, migrations). The Next.js frontend has its app shell (layout, navigation, theme, i18n, tests); feature screens are not built yet.

## Read before working

- [docs/constitution.md](docs/constitution.md): product, principles, non-negotiable rules. Wins over any other instruction.
- [docs/architecture.md](docs/architecture.md): stack, multi-tenancy, access model, planned folder structure.
- [docs/database.md](docs/database.md): how to change the database: migrations, schema conventions, new table checklist, RLS tests.
- [docs/conventions.md](docs/conventions.md): code conventions: reuse, naming, components, colors and theming, data access, forms, i18n, git.
- [docs/environments.md](docs/environments.md): Supabase projects, and the checklist for setting up a new one.
- [specs/README.md](specs/README.md): spec workflow and approval gates.
- [db_schema.sql](db_schema.sql): commented description of the full database.
- [AGENTS.md](AGENTS.md): Next.js notes managed by `next dev`. This Next.js version may differ from what you know; read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Stack

Supabase (Postgres, Data API, Auth, RLS) · Next.js 16 App Router + TypeScript · shadcn/ui (Base UI) + Tailwind v4 · Phosphor icons · next-intl, Spanish only · Zod · Vitest + Testing Library + pgTAP · GitHub + Vercel. Package manager: npm. Node 22.13 or newer.

## Hard rules

1. **The repository is public.** Never write, commit or push credentials, keys, tokens, passwords, project refs, personal data or other sensitive data, including in docs, tests and commit messages. Use environment variables; commit only `.env.example`. Never read `.env*` files.
2. **Tenant isolation lives in the database.** Every new tenant table gets `shop_id`, composite FKs to same-shop parents, RLS policies using the JWT `shop_id` claim plus `is_current_profile_enabled()`, and explicit grants. `brand` and `model` are the only global tables.
3. **Migrations are the source of truth.** Never edit an applied migration; add a new one. Every migration must be reflected in `db_schema.sql` in the same change.
4. **Spec before code.** Features start in `specs/` and are implemented only after the spec is approved.
5. **Reuse first.** Search for existing components, schemas and helpers before creating new ones. Anything plausibly reusable goes in `components/shared/` or `lib/`.
6. **Language.** Code, comments and docs in English. UI text in Spanish, only via `next-intl` messages. DB status values stay in Spanish.
7. **Tests.** RLS changes need pgTAP tests; logic and validation need Vitest tests. Don't call a task done until they pass.

## Commands

```bash
npm run dev      # Start the app on http://localhost:3000
npm test         # Run Vitest once (npm run test:watch to watch)
npm run lint     # ESLint
npm run build    # Production build
```

## Database changes

There is no local Supabase stack; local development and Vercel point to the hosted `torque-dev` project. Migrations live in `supabase/migrations/`, named `<timestamp>_<type>[-<subject>].sql` where type is `ddl`, `dcl` or `data-insert-<table>-<nnn>`.

```bash
npx supabase migration new <type>[-<subject>]   # Create a migration file
```

Never run `npx supabase db push` or anything else that changes a hosted database. The project owner applies migrations.

## Workflow

1. Read the relevant spec in `specs/` and the docs above. No approved spec, no code.
2. Implement one task from the spec's `tasks.md` at a time.
3. Run the tests.
4. Update docs, specs and `db_schema.sql` if behavior changed.
5. Work on a branch and open a PR; never commit directly to `main`.

## Git

Never run a git or GitHub CLI command (`git`, `gh`) without the owner's explicit approval, including read-only ones such as `git status`. Ask first, say exactly which command and why, and wait for a yes. Approval covers only the command asked about, not later ones.
