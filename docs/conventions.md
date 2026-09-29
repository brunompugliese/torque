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
- **Icons come from Phosphor** (`@phosphor-icons/react`; use `@phosphor-icons/react/ssr` in Server Components) with the `*Icon` names (`HouseIcon`, not the deprecated `House`). `components.json` sets `iconLibrary` to `phosphor`, so shadcn components use it too. Don't add other icon libraries. Use the `regular` weight by default and `fill` for active or selected states.
- Components never call Supabase directly. They receive data from a page or call a Server Action.
- **Hand pointer on everything clickable.** A base rule in `src/app/globals.css` gives every enabled button, link, `[role="button"]`, `summary`, `select`, `label[for]` and clickable input `cursor: pointer`, and disabled buttons `cursor: not-allowed`. Don't add `cursor-*` classes to components; if a new kind of clickable element isn't covered, extend that rule.
- **Forms use shadcn `Field`** (`Field`, `FieldLabel`, `FieldError`) for every field, with `aria-invalid` and `aria-describedby` pointing at the error. Field errors are plain text under the field, without a box.
- **Messages about a whole form go in `FormAlert`** (`src/components/shared/form-alert.tsx`): a box with a translucent tint of its color as background (`bg-destructive/10`) and a matching border. Any message shown inside a container follows this pattern; add variants to `FormAlert` (with their own semantic tokens) instead of styling alerts ad hoc.

## Colors and theming

Every color in the app is a CSS variable, so switching to another brand kit means editing one block of variables and no component code.

- **One source.** Colors are defined only in `:root` in `src/app/globals.css`, using shadcn/ui's token names (`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`, …) and exposed to Tailwind through `@theme inline`.
- **Components use tokens only.** Use token classes such as `bg-primary`, `text-muted-foreground` and `border-border`. Never use Tailwind palette colors (`bg-teal-600`, `text-gray-500`), hex or `rgb()` values, or arbitrary values (`bg-[#2F7A78]`) in components. Tints come from tokens too (`bg-primary/10`).
- **New color needs get a new token.** If no token fits (for example status colors such as success or warning), add a semantic variable to `:root` (`--success`, `--success-foreground`), register it in `@theme inline`, and use it through its class. Name tokens by role, not by hue.
- **Light mode only.** There is no dark theme and no `.dark` block. Backgrounds are never pure white (`#FFFFFF`).
- **Changing brand kit:** replace the values in `:root`, keep the token names, then check text contrast (WCAG AA, 4.5:1 for body text) on `background`, `card` and `primary`.

Current palette, *Sand & Teal*:

| Token | Value | Use |
|---|---|---|
| `--background` | `#F4F1EA` | Page background (sand) |
| `--card`, `--popover` | `#FAF8F3` | Raised surfaces |
| `--foreground` | `#22302F` | Main text (ink) |
| `--muted`, `--secondary`, `--accent` | `#E8E3D8` | Subtle fills, hover states |
| `--muted-foreground` | `#6B6558` | Secondary text |
| `--border`, `--input` | `#DAD3C5` | Borders, input outlines |
| `--primary`, `--ring` | `#2F7A78` | Main actions, links, focus ring (teal) |
| `--primary-foreground` | `#FAF8F3` | Text on primary |
| `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `#22302F` | Text on those surfaces |
| `--destructive` | `#B4442F` | Errors and destructive actions |
| `--chart-1` … `--chart-5` | `#2F7A78`, `#6FA9A6`, `#C08A3E`, `#8A7F6B`, `#22302F` | Chart series |
| `--sidebar-*` | Same values as `card`, `foreground`, `primary`, `accent`, `border` and `ring` | shadcn sidebar component |

Shadcn's `dark:` utilities stay in the generated components but never apply: `globals.css` binds them to a `.dark` class that the app never sets.

Layout sizes that must stay in sync also live in `:root` (for example `--floating-nav-height`, `--floating-nav-offset`, `--floating-nav-space`).

## Authentication and sessions

- **Every app page and every data access calls `requireSession()`** from `src/lib/auth/session.ts`. Layouts don't re-render on client navigation, so a check in the layout alone is not enough.
- Identify the user only with `getSession()`/`requireSession()` (verified claims). Never use `supabase.auth.getSession()` on the server: it trusts the cookie without verifying it.
- Create Supabase clients only with `createServerSupabase()` (`src/lib/supabase/server.ts`). Never create a browser client, never use the `service_role` key, and never give an env var the `NEXT_PUBLIC_` prefix unless it is truly public.
- Never pass session objects, tokens, user ids or shop ids to Client Components; pass only the values they display.
- Auth errors shown to users must not reveal whether an account exists (see `mapAuthError`). Log error codes, never emails, passwords or tokens.
- Redirect targets that come from the URL go through `getSafeRedirectPath()`.
- Field validation messages live under `validation.*` in `messages/es.json` and are shared by every form; feature-specific messages live under the feature's namespace (e.g. `auth.errors.*`).

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
- **Agents never run git or GitHub CLI commands (`git`, `gh`) without the owner's explicit approval**, read-only ones included. They ask first, naming the exact command and why, and approval covers only that command. The owner's `.claude/settings.local.json` also marks these commands as "ask", so each one needs a confirmation.
