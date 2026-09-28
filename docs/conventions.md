# Torque — Code Conventions

How code will be written once the frontend exists. The folder structure is defined in [architecture.md](architecture.md); database conventions are in [database.md](database.md).

## Reuse first

Before writing a component, schema, query, hook or helper:

1. **Search** `components/shared/`, `lib/` and the other `features/` folders for something that already does it.
2. If something close exists, **extend it** rather than copying it.
3. If you build something new that another domain could plausibly use (a calendar, a data table, a phone input, a date formatter), **build it generic and put it in `components/shared/` or `lib/`** from the start. Domain-specific code stays in `features/<domain>/`.
4. Never duplicate logic. Validation lives in one Zod schema, formatting in one helper, a query in one function.

Generic means: it takes data and callbacks through props, knows nothing about a specific table, and its text comes from the caller or from `next-intl`.

## TypeScript

- `strict` mode. No `any`; use `unknown` and narrow it.
- Database row types come from the generated `src/types/database.ts`, never hand-written.
- Prefer inferred types from Zod schemas (`z.infer<typeof schema>`) for form and action input.

## Naming

| Item | Convention | Example |
|---|---|---|
| Files and folders | `kebab-case` | `vehicle-form.tsx` |
| React components | `PascalCase` | `VehicleForm` |
| Functions, variables | `camelCase` | `getVehicleByPlate` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PLATE_LENGTH` |
| Zod schemas | `<entity><Purpose>Schema` | `vehicleCreateSchema` |
| Server Actions | verb + entity | `createVehicle`, `updateJobStatus` |
| Database | `snake_case` | `job_item` |

## Components

- **Server Components by default.** Add `"use client"` only for interactivity (state, events, browser APIs), and keep client components small.
- **shadcn/ui primitives** are added with the shadcn CLI into `components/ui/` and edited as little as possible. Customize by wrapping them in `components/shared/`.
- Components never call Supabase directly. They receive data from a page or call a Server Action.

## Data access

- **Reads:** functions in `features/<domain>/queries.ts`, called from Server Components, using the server Supabase client from `lib/supabase/`.
- **Writes:** Server Actions in `features/<domain>/actions.ts`. Every action:
  1. Validates its input with the domain's Zod schema.
  2. Uses the server Supabase client, acting as the logged-in user.
  3. Returns a typed result (`{ ok: true, data }` or `{ ok: false, error }`) instead of throwing to the UI.
- Never send `shop_id` from the UI when it can be derived; the database checks it anyway.
- Select only the columns you need.

## Forms and validation

- One Zod schema per form in `features/<domain>/schemas.ts`, used both by the form (client) and by the Server Action (server).
- Reusable field rules (plate, phone, email, DNI) live in `lib/validation/` and are composed into domain schemas.
- Forms use shadcn/ui form components with `react-hook-form` and the Zod resolver.

## UI text and formatting

- All UI text lives in `messages/es.json`, namespaced by domain (`vehicle.form.plateLabel`). No hardcoded strings in components.
- Database status values map to labels in the messages file (`status.job.en_progreso` → "En progreso").
- Dates, numbers and currency are formatted through shared helpers built on `next-intl`, never by hand.

## Errors and logging

- Show the user a translated, friendly message; log the technical detail on the server.
- **Never log personal data** (DNI, phone, email, names) or secrets.

## Security

- The repository is **public**. Everything committed is visible to anyone, including history.
- No credentials, keys, tokens, project refs or personal data in code, tests, fixtures, docs or commit messages. Test data is fake.
- Environment variables only; `.env.example` holds placeholders.

## Tests

- Unit tests with Vitest, next to the code they test: `vehicle-schemas.test.ts` beside `schemas.ts`.
- Test Zod schemas, calculations (e.g. job totals) and helpers. Every shared helper and every schema has tests.
- RLS tests follow [database.md](database.md#rls-tests).

## Comments

Explain **why**, not what. Business decisions and non-obvious constraints get a comment; self-explanatory code does not.

## Git

- Never commit to `main`. One branch per spec or change: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat: add vehicle search`.
- Merge through a PR; tests must pass.
