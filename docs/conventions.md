# Torque — Code Conventions

How code is written. The folder structure is defined in [architecture.md](architecture.md); database conventions are in [architecture.md](architecture.md#changing-the-database); non-negotiable rules (security, git) are in [CLAUDE.md](../CLAUDE.md); how the app looks and behaves (layout, copy, formats, shared UI patterns, business rules) is in [design.md](design.md).

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
- **Every data-loading page and component ships its skeleton** ([behavior](design.md#loading)). A route that fetches data has a `loading.tsx`, or a `<Suspense>` boundary with a skeleton fallback around the part that waits (preferred when the static parts can render first). A shared component that loads or displays fetched data exports its skeleton beside it (`DataTable` → `DataTableSkeleton`) with the same layout and sizes. Skeletons are built from shadcn's `Skeleton` (`components/ui/`) and shared composites in `components/shared/`, never ad hoc grey `div`s. Each skeleton has a test (renders, `aria-busy`, one "Cargando…" announcement). A page or component without its skeleton is not done.
- **Forms use shadcn `Field`** (`Field`, `FieldLabel`, `FieldError`) for every field, with `aria-invalid` and `aria-describedby` pointing at the error. Field errors are plain text under the field, without a box.
- **Messages about a whole form go in `FormAlert`** (`src/components/shared/form-alert.tsx`): a box with a translucent tint of its color as background (`bg-destructive/10`) and a matching border. Any message shown inside a container follows this pattern; add variants to `FormAlert` (with their own semantic tokens) instead of styling alerts ad hoc.

## Colors and theming

Every color in the app is a CSS variable, so switching to another brand kit means editing one block of variables and no component code.

- **One source.** Colors are defined only in `:root` in `src/app/globals.css`, using shadcn/ui's token names (`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`, …) and exposed to Tailwind through `@theme inline`.
- **Components use tokens only.** Use token classes such as `bg-primary`, `text-muted-foreground` and `border-border`. Never use Tailwind palette colors (`bg-teal-600`, `text-gray-500`), hex or `rgb()` values, or arbitrary values (`bg-[#2F7A78]`) in components. Tints come from tokens too (`bg-primary/10`).
- **New color needs get a new token.** If no token fits (for example status colors such as success or warning), add a semantic variable to `:root` (`--success`, `--success-foreground`), register it in `@theme inline`, and use it through its class. Name tokens by role, not by hue.
- **Light mode only.** There is no dark theme and no `.dark` block, even when the user's system is in dark mode.
- **Changing brand kit:** replace the values in `:root`, keep the token names, then check text contrast (WCAG AA, 4.5:1 for body text) on `background`, `card` and `primary`.

Current palette, *Neutral* (the visual identity in [design.md](design.md#visual-identity)): black, white and greys, so status colors are the only strong color on screen.

| Token | Value | Use |
|---|---|---|
| `--background` | `#FAFAFA` | Page background, behind panels |
| `--card`, `--popover` | `#FFFFFF` | Panels, modals, inputs, cards |
| `--foreground` | `#09090B` | Body text and values |
| `--muted`, `--secondary`, `--accent` | `#F4F4F5` | Row hover, selected items, read-only fields |
| `--muted-foreground` | `#6B6B74` | Labels, hints, metadata, empty values |
| `--border`, `--input` | `#E4E4E7` | Panels, tables, inputs |
| `--primary`, `--ring` | `#18181B` | Primary buttons, current navbar item, today marker, focus ring |
| `--primary-foreground` | `#FAFAFA` | Text on primary |
| `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `#09090B` | Text on those surfaces |
| `--destructive` | `#B91C1C` | Cancel actions, field errors |
| `--warning`, `--warning-border`, `--warning-foreground` | `#FFFBEB`, `#FCD34D`, `#78350F` | Closing-a-job warning |
| `--plate-band` | `#1E4FB8` | Top band of the plate drawing |
| `--plate`, `--plate-foreground` | `#FFFFFF`, `#09090B` | Plate drawing background, border and characters (white with black characters in any theme) |
| `--whatsapp` | `#128C7E` | WhatsApp button icon; darker than WhatsApp's own green to keep 3:1 non-text contrast (checked in `theme-tokens.test.ts`) |
| `--status-<family>`, `-foreground`, `-dot` (`-border` for `done`, `cancelled`) | See [design.md](design.md#visual-identity) | Status badges and calendar cards |
| `--chart-1` … `--chart-5` | `#18181B`, `#3B82F6`, `#8B5CF6`, `#22C55E`, `#F59E0B` | Chart series |
| `--sidebar-*` | Same values as `card`, `foreground`, `primary`, `accent`, `border` and `ring` | shadcn sidebar component |

Status families map to database values in one shared helper, never per component:

| Family | Job status | Appointment status |
|---|---|---|
| `pending` | `pendiente` | `pendiente` |
| `quote-sent` | `presupuesto_enviado` | — |
| `quote-accepted` | `presupuesto_aceptado` | — |
| `in-progress` | `en_progreso` | — |
| `done` | `completado` | `confirmado`, `completado` |
| `delivered` | `entregado` | — |
| `cancelled` | `cancelado` | `cancelado` |

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
- **Encrypted tables** ([how it works](architecture.md#sensitive-data)): write to the table, read through its `<table>_decrypted` view, including right after a write. Never send or select `*_hash` columns. Never put their values, or searches over them, in a URL. Normalize search terms with one shared helper that matches the database's `normalize_search`.
- **Business-rule errors** from the database ([codes](architecture.md#automatic-behavior-triggers)) are mapped to UI messages in one place; the UI prevents them first.
- **Lists** paginate on the server (25 rows per page) with search, filters and sorting applied in the query ([design.md](design.md#list-pages)): build them with `applyListQuery`, `useListUrl`, `useListResults` (plus a search Server Action per page) and the shared list components ([architecture.md](architecture.md#list-pages-exists)).
- **Actions return `ActionResult`** (`lib/actions/result.ts`, with `ok()` / `fail()`); field errors are message keys.
- **"Already exists" checks** use `findByKey` (`lib/data/lookups.ts`) on a normalized key column, comparing active and archived rows ([design.md](design.md#uniqueness-per-shop)); "is it used?" checks use `existsWhere`, never a count.
- Until database types are generated, rows are parsed with a Zod row schema in the domain's `schemas.ts`.
- Select only the columns you need.

## Forms and validation

- One Zod schema per form in `features/<domain>/schemas.ts`, used both by the form (client) and by the Server Action (server).
- Reusable field rules (plate, phone, email, DNI) live in `lib/validation/` and are composed into domain schemas.
- Forms use shadcn/ui form components with `react-hook-form` and the Zod resolver.

## UI text and formatting

- All UI text lives in `messages/es.json`, namespaced by domain (`vehicle.form.plateLabel`). No hardcoded strings in components.
- Database status values map to labels in the messages file (`status.job.en_progreso` → "En progreso").
- Dates, numbers and currency are formatted through shared helpers built on `next-intl`, never by hand. Dates always use `DATE_FORMAT` (`lib/format/date.ts`): `format.dateTime(value, DATE_FORMAT)` → dd/mm/aaaa in Argentina time. In table cells use `TableDate` (`components/shared/table-date.tsx`).
- Shared UI text (buttons, list chrome, loading) lives under `common.*` and `list.*`; reuse those keys instead of repeating them per domain.

## Errors and logging

- Show the user a translated, friendly message; log the technical detail on the server.
- **Never log personal data** (DNI, phone, email, names) or secrets.

## Tests

- Unit tests with Vitest, next to the code they test: `vehicle-schemas.test.ts` beside `schemas.ts`.
- Test Zod schemas, calculations (e.g. job totals) and helpers. Every shared helper, shared component and schema has tests.
- Helpers in `src/test/`: `renderWithIntl` renders with the Spanish messages; `createFakeSupabase` records queries and returns canned results for queries and actions.
- Database tests follow [architecture.md](architecture.md#database-tests).

## Comments

Minimal. Comment only to explain a business decision or a non-obvious constraint (**why**, never what), in one short line when possible. Self-explanatory code gets no comment, and docs are linked rather than repeated. Database scripts (migrations, `db_schema.sql`, pgTAP tests) are the exception: there, explaining more is better than less.
