# 007 — Jobs page: Design

**Status:** Approved (by the owner in conversation, 2026-10-22)
**Requirements:** [requirements.md](requirements.md)

## Summary

`/trabajos` is the fourth list page and follows `/vehiculos` ([spec 006](../006-vehicles/design.md)): a Server Component with the list state in the URL, the search in `ListSearchProvider`, server-side search, filter, sort and paging, a modal opened from the row already loaded, and writes as Server Actions. What is new:

- **List filters** (`Estado` checklist with counts, `Fecha` range) and their chips: the list state gains a generic `filters` map, and the toolbar gets filter controls. Shared, not job-specific.
- **A `job_list` view** with everything the list and the modal need (vehicle, client, appointment, totals, sort keys), computed in the view and never stored.
- **One job modal, three hosts:** `/trabajos`, a vehicle's history (inside the vehicle modal, itself inside the client modal) and, later, Inicio and Turnos. Built once as a hook, like `useVehicleModal`.
- **A job form with a services editor** (quote and work phases), quick create of a client and of services inside the same save.
- **One database function, `save_job`**, that saves the job, its services and its status atomically, in the order the closed-job guard needs.
- **A status timeline** (history) and the job's service table in the modal.

## Database

Four migrations (`ddl-job-list`, `dcl-job-list`, `ddl-save-job`, `dcl-save-job`: each concern gets its own `ddl-` / `dcl-` pair, architecture.md). No table, policy or trigger changes.

### 1. `ddl-job-list`: view `public.job_list` and function `public.job_status_counts`

A new `security_invoker` view (not extra columns on `job_decrypted`: the list needs joins to the vehicle, its brand and model, the client and the appointment, which `job_decrypted` should not pay for when the history or a single job is read). Nothing is stored.

| Column | Value | Used by |
|---|---|---|
| `id, shop_id, vehicle_id, client_id, appointment_id, status, kilometers, quoted_total, final_total, enabled, created_at, updated_at` | from `job` | rows, modal |
| `observations` | `private.decrypt_text(j.observations)` | modal, form |
| `plate`, `vehicle_year`, `brand_name`, `model_name`, `vehicle_enabled` | the job's vehicle, decrypted (`vehicle_year` is `v.year`) | "Patente", "Vehículo", modal title |
| `client_name`, `client_surname`, `client_phone_number`, `client_enabled` | the job's client, decrypted (null without one) | "Cliente", modal |
| `appointment_date`, `appointment_time`, `appointment_enabled` | the linked appointment (null without one) | "Turno" in the modal and form |
| `search_text` | `private.normalize_search(concat_ws('|', plate, concat(brand, model), concat(client name, surname)))` | search |
| `vehicle_key` | `normalize_search(concat_ws(' ', brand, model, year))` | "Vehículo" sort |
| `client_name_key` | `nullif(normalize_search(concat_ws(' ', name, surname)), '')` | "Cliente" sort (null sorts last) |
| `status_order` | 1–7, in the status order of design.md | "Estado" sort |
| `total_amount` | `coalesce(final_total, quoted_total)` | "Total" sort |

- The joins use the composite keys (`c.id = j.client_id and c.shop_id = j.shop_id`), like `vehicle_decrypted`, and decrypt in `lateral` subqueries so a column is only computed when selected or sorted by. The first task checks it with `EXPLAIN` on the list query and on `select id`; if decryption still runs when unselected, the plain columns move to a lighter view as in 006's fallback.
- **`public.job_status_counts(p_pattern text, p_show_archived boolean, p_from timestamptz, p_to timestamptz)`** returns `(status, total)`: the number of jobs per status for the Estado filter's counts. It reads `job_list` with the search pattern (always including archived, like the list), the archived switch and the date range, and ignores the Estado selection. `security invoker`, `stable`, `set search_path = ''`. One request instead of seven.
- RLS impact: none. The view and function run as the caller; `authenticated` can already read `job`, `vehicle`, `client`, `appointment`, `brand`, `model` and run `decrypt_text` / `normalize_search`. The pgTAP test covers the new columns and the function for tenant isolation.
- Grants go in migration 3.

### 2. `ddl-save-job`: `public.save_job(...)`

```
save_job(
  p_job_id         uuid,     -- null: create, otherwise: update that job
  p_vehicle_id     uuid,
  p_client_id      uuid,     -- ignored when p_new_client is set
  p_status         text,
  p_kilometers     integer,
  p_appointment_id uuid,
  p_observations   text,
  p_quoted_total   numeric,  -- calculated by the app
  p_final_total    numeric,  -- null outside the work phase
  p_items          jsonb,    -- [{ id?, service_id?, new_service?: {name, description}, quantity, quoted_unit_price, final_unit_price }]
  p_new_client     jsonb     -- null, or { name, surname, phone_number, dni }
) returns uuid              -- the job's id
```

- **`security invoker`**, `set search_path = ''`, schema-qualified. It runs as the caller, so RLS, the composite foreign keys, the encryption triggers and every business-rule trigger apply. The shop comes from the JWT claim; the app never sends it.
- **One transaction, in this order:** (1) the new client, if any; (2) the new services, if any (the `normalize_service` trigger fills their keys); (3) the items; (4) the job itself. Step 4 comes last because `guard_closed_job_item` looks at the stored status: items must be saved before the job is closed, and a closed job can't take items ([db_schema.sql](../../db_schema.sql): "to close a job, save its items first, then the status").
- **Items are diffed, not replaced:** an item with an `id` of this job is updated, one without is inserted (in a loop with `clock_timestamp()` as `created_at`, so the order the user typed survives: a plain insert would give every row the same `now()`), and the job's items that are not in the list are deleted. For an existing item whose job is stored in the **work phase**, `quoted_unit_price` is kept as stored whatever is sent ("what the client accepted"); in the quote phase it is editable.
- **Creating a job directly as Entregado or Cancelado:** the job is inserted as `pendiente`, its items are added and then its status is set, because a closed job can't take items. The history then shows "(creación)" as Pendiente and the close as a second entry. Editing never has this effect.
- Step 4 always runs an `update` on the job, so `updated_at` moves when only the items changed.
- Errors the app maps: the existing `23514` codes (`job_closed`, `job_kilometers_below_previous`, `vehicle_archived`, `client_archived`, `service_archived`), `23505` `client_dni_taken` (decided like `save_vehicle_with_new_client`, by the violated column) and `P0002` `job_not_found`. A service name taken is checked by the app before calling (design.md: app-only), not by the function.
- The pgTAP test is `supabase/tests/09_jobs.sql`.

### 3. Grants: `dcl-job-list` and `dcl-save-job`

`dcl-job-list`: `grant select` on `job_list` to `authenticated` (revoking `anon`), as the other views do, and `revoke execute … from public, anon; grant execute … to authenticated;` on `job_status_counts`. `dcl-save-job`: the same execute grants on `save_job`.

`db_schema.sql` reflects all three, with comments.

## Frontend

### Route

```
src/app/(app)/trabajos/
  page.tsx      # replaces the placeholder: requireSession, parse URL params (search ignored), sections in Suspense
  loading.tsx   # whole-page skeleton
```

Same shape as `vehiculos/page.tsx`: `PageHeader` (title, summary in `<Suspense>`, `NewJobButton`), toolbar + table in one `<Suspense>` inside `JobsPanel` wrapped in `ListSearchProvider`. The server list renders with `search: ""` (a stale `?buscar=` is ignored).

### List state with filters (generic)

- `lib/list/params.ts`: `ListParams` gains `filters: Record<string, string>` (default `{}`). `parseListParams(raw, filterKeys = [])` reads only the keys a page whitelists; `toListSearch` writes them. Jobs use `estado` (statuses joined by commas, in order) and `desde` / `hasta` (`yyyy-mm-dd`). Invalid values are dropped on parse; a "Desde" later than "Hasta" is dropped too (the toolbar shows the error before it reaches the URL).
- `hooks/use-list-url.ts`: `setFilters(patch)` merges and returns to page 1; `clearFilters()`; `clearAll()` clears search and filters ("Limpiar búsqueda y filtros"). The search stays in `ListSearchProvider`.
- `lib/list/query.ts`: `applyListQuery` gets `defaultDirection` (`"desc"` for jobs): used when no column is chosen, so the default order is newest update first while no header is marked. It also keeps its nulls-last and `id` tie-break.
- Job filters (`status in (…)`, `updated_at >= from`, `updated_at < day after to`) are applied by `features/job/queries.ts` on the builder before `applyListQuery`. Days are Argentina days: `lib/format/date.ts` gains `argentinaDayStart(date)` and `argentinaNextDayStart(date)` (fixed UTC−3, no DST) that return the ISO timestamps.

### Filter controls (shared)

`components/shared/` (all generic, with Vitest tests):

| Piece | What it is |
|---|---|
| `FilterPopover` | Toolbar button ("Estado", "Fecha") that opens a popover; the button shows the active state. Base UI Popover through shadcn |
| `ChecklistFilter` | Checkbox list with a count per option; used for Estado |
| `DateRangeFilter` | "Desde" / "Hasta" date inputs with the "Desde no puede ser posterior" error; apply on valid input |
| `FilterChips` | Removable chips for the active filters, accessible name "Quitar filtro: …"; sits under the toolbar |

`ListToolbar` already accepts `filters`; `ListUrlToolbar` gains a `filters` slot and renders `FilterChips`. The Estado counts come from `getJobStatusCounts(search, archived, range)` (the rpc above), loaded with `useLoadedData` keyed by the search, archived switch and date range; the checklist shows the shared skeleton for the counts while they load.

### List

`features/job/list.ts`:

| id | Header | Cell | Align | Sort column |
|---|---|---|---|---|
| `patente` | Patente | `PlateDisplay` | center | `plate` |
| `vehiculo` | Vehículo | "Brand Model" (medium weight, min width) + `ArchivedBadge`, year below in secondary color | left | `vehicle_key` |
| `cliente` | Cliente | `formatClientName` + "(Archivado)", or "Sin cliente" | left | `client_name_key` |
| `estado` | Estado | `StatusBadge` (plain) | left | `status_order` |
| `km` | Kilometraje | `formatKm`, "—" | right | `kilometers` |
| `total` | Total | `formatMoney(final ?? quoted)` with "Final" / "Presupuestado" below in secondary color, "—" | right | `total_amount` |
| `actualizado` | Actualizado | `TableDate` | left | `updated_at` |

`JOB_DEFAULT_SORT = "actualizado"` with `defaultDirection: "desc"`; no header is marked. Rows come from `job_list` with `JOB_LIST_COLUMNS`, parsed by `jobListRowSchema`. Counts for the summary are two `head` queries on `job`. `DataTableColumn.skeletonLines` covers the two-line cells.

### Job modal (shared content)

`useJobModal(...)` (`features/job/components/use-job-modal.tsx`) returns the `DetailModal` props for the modes `view`, `edit` and `create` plus the archive and close confirmations, like `useVehicleModal`.

- **Hosts:** `JobsPanel` holds `{ open, mode, job }` and opens from the loaded row. The vehicle history opens it through `useVehicleModal`, whose modes gain `job-view` and `job-edit`; `ClientModal` forwards them, so the chain is client → vehicle → job with "Volver" at each level and one X for the whole chain. After any action `onClose` closes the chain.
- **Row source:** from the list the row is already loaded. From a vehicle's history only a summary is, so the hook accepts `jobId` instead of a row and loads it with `getJobRow(id)` (`job_list`, one row) behind `useLoadedData` (skeleton, error with "Reintentar"). The vehicle history query keeps reading `job` for its rows; the full row is fetched on click.
- **Read-only mode:** the hook has `readOnly`: no "Archivar" and no "Editar trabajo". No host sets it today (Inicio ended up with the full actions, [spec 009](../009-home/requirements.md)).
- **view:** title = `PlateDisplay` + "Brand Model Year" (+ badge); subtitle "Actualizado dd/mm/aaaa hh:mm hs" (new `formatDateTime` in `lib/format/date.ts`, Argentina time); actions through `ArchiveToggleButton` and `ArchiveConfirmDialog` (`useArchiveFlow`) and "Editar trabajo" (hidden when closed). `DetailList`: Cliente (as in the vehicle modal, with `WhatsappButton`), Kilometraje, Observaciones (no Turno: the job modal does not show the appointment). Then `JobServices` and `JobStatusHistory`, each loaded with `useLoadedData` from `getJobDetail(jobId)` (items and history in one action, two parallel queries), with the shared skeleton and error. Footer: "Creado el" and "Volver".
- **edit / create:** `JobForm`; edit shows the vehicle's plate and name above the subtitle; "Cancelar" returns to `view` (edit) or closes / goes back (create).

### `JobServices` (modal table)

Columns by phase (`lib/status.ts` gains `jobPhase(status, hasFinalPrices)` → `"quote" | "work"`, plus `isClosedStatus`; Cancelado is `work` when any item has a final price). Quote: Servicio · Cant. · Precio; work: Servicio · Cant. · Presupuestado · Final; totals in the last row from `calculateTotals` (below). Archived services are labelled "(Archivado)". Empty: "Todavía no hay servicios cargados."

### `JobStatusHistory` and `StatusTimeline`

`components/shared/status-timeline.tsx`: a generic vertical timeline (`<ol>`) of entries with a bold title, a secondary line and a meta line. `JobStatusHistory` maps `job_status_history` rows (newest first) to the status pill (`JobStatusBadge`) and a "user name · date and time" line (`formatDateTime`); no "desde …" or "(creación)" text, since the previous status is the entry below and the oldest entry is the creation. The user's name comes from `profile.full_name` through the `changed_by` embed; a missing user shows no name.

### Form

`JobForm` (React Hook Form + `jobFormSchema`), field order: vehicle, client, status, km, appointment, observations, services. `Estado` sits next to `Kilometraje` (`FormRow`); the dropdowns, Observaciones and the editor are full width.

- **Vehículo:** `SearchableSelect` in remote mode through `useRemoteOptions` and `searchVehicleOptions(term, currentId?)`: active vehicles from `vehicle_decrypted` (search text, 10 matches), plus the job's own vehicle when editing (labelled "(Archivado)" if it is). Option: "Brand Model" + plate in grey; selected: "Fiat Cronos (AD 915 TB)". No footer action.
- **Cliente:** remote `SearchableSelect` (`searchClientOptions(term, { onlyActive: true, currentId })`: the existing action gains the option; the job's own archived client stays listed when editing), with "+ Crear cliente nuevo" and the existing `NewClientSection`. On a vehicle change the form calls `getVehicleOwner(vehicleId)` (active owner or null) and resets the client; the hint "Por defecto, el dueño del vehículo." shows while the client is the owner.
- **Estado:** `Select` of the seven statuses from `lib/status.ts`; a new job always opens with Pendiente selected (the form's default value and the database default), and only the user's choice changes it. `ClosingWarning` (the existing warning color tokens) shows for Entregado / Cancelado. Switching into the work phase fills empty final prices with the quoted ones (`fillFinalPrices(items)`, pure and tested); switching to the quote phase clears them (the server does too).
- **Kilometraje:** `FormattedInput` (digits, dot thousands via `formatThousands`). On a vehicle change `getKmFloor(vehicleId, excludeJobId?)` returns the highest km among the vehicle's non-archived jobs created before the job being edited (all of them for a new job): the same predicate as `check_job_kilometers`, the hint and the prefill (new job only; the field is not overwritten once the user typed). The server and the database check again.
- **Turno:** `Select` loaded with `useLoadedData` keyed by the vehicle (`getAppointmentOptions(vehicleId, jobId?)`: enabled, not cancelled, with no job, plus the job's own); disabled until a vehicle is picked.
- **Observaciones:** `Textarea`.
- **Submit:** an edit with no changes after normalization goes back without a request. If the status becomes Entregado or Cancelado, the shared `ConfirmDialog` asks first ("¿Cerrar el trabajo?"); only "Guardar y cerrar" calls the action. Then `createJob` / `updateJob`.

### Services editor

`ServicesEditor` (`features/job/components/`) with `useFieldArray`; it receives the phase from the form's status and the loaded items. A row is `{ key, id?, serviceId | newService, quantity, quotedUnitPrice, finalUnitPrice }`.

- **Servicio:** `SearchableSelect` (local filter) over `getServiceOptions(currentIds)` loaded once per form: active services plus the ones already on the job (archived ones labelled). Last option "+ Crear servicio nuevo" turns the row into an inline "Servicio nuevo" section (Nombre, Descripción, X "Descartar servicio nuevo") with the typed text carried over.
- **Cant.:** `FormattedInput` (digits), default 1. **Precio unit.**, **Presup. unit.** and **Final unit.:** `MoneyInput` (`components/shared/money-input.tsx`: "$" prefix, accepts digits and one comma with up to two decimals, text input so the comma stays). "Presup. unit." is read-only (muted fill) only for rows with an `id` while the form is in the work phase. **Subtotal** = quantity × (final in work, quoted otherwise) with `formatMoney`.
- **Totals** below the table from `calculateTotals(rows, phase)` in `features/job/total.ts` (extended): quoted always, final in the work phase. The same function computes the values the action saves.
- "Agregar servicio" appends an empty row and focuses its dropdown (a `focusRow` ref).
- Errors are linked to their cells (`aria-describedby`); the first error in row order takes focus.

## Server data and actions

`features/job/queries.ts` (existing history query stays): `listJobs(params)` and `getJobCounts()` (cached with primitive arguments), `getJobRow(id)`, `getJobDetail(id)`, `getJobStatusCounts(...)`, `getKmFloor`, `getVehicleOwner`, `getAppointmentOptions`, `getServiceOptions`, `searchVehicleOptions`.

`features/job/actions.ts` (the existing `getVehicleJobs` stays):

- `searchJobs(listSearch)` and the read actions above, each behind `requireSession()`.
- `createJob(input)`, `updateJob(id, input)`: validate with `jobFormSchema` (the same schema as the form), normalize the items for the phase (see below), check the names of new services with `findByKey` (`service.name_key`, active and archived messages), calculate the totals with `calculateTotals`, call `rpc("save_job")`, read the row back through `job_list`. Queries per save: 1 to 2 lookups (only with new services), the call, the read-back.
- **Server-side phase rules:** quote statuses drop every final price; work statuses require them (defaulting to the quoted one); Cancelado keeps final prices only if the stored job already had them. A new client or service payload is accepted only together with its required fields.
- `setJobArchived(id, archived)`.
- Error keys: `invalid`, `closed`, `kmBelowPrevious` (with the minimum), `vehicleArchived`, `clientArchived`, `serviceArchived`, `dniTaken`, `dniTakenArchived`, `serviceNameTaken`, `serviceNameTakenArchived`, `notFound`, `unexpected`. Database codes map to a field error (km, vehicle, client, a service row) or to a form alert ("Este trabajo ya está cerrado y no se puede editar.").
- Revalidation: `/trabajos` on every write, `/vehiculos` (its history and last km) on every write, plus `/clientes` when a client was created and `/servicios` when services were created.
- Actions log only error codes, never personal data.

## Validation

`jobFormSchema` (`features/job/schemas.ts`), used by the form and the actions:

- `vehicleId`: `idSchema` with `vehicleRequired`. `clientId`: `idSchema` or null; `newClient` (picked fields via `clientFormSchema.pick`) or null; both is invalid.
- `status`: `z.enum(JOB_STATUSES)`. `kilometers`: `kilometersField` (`lib/validation/job-fields.ts`: empty → null, digits → integer ≥ 0). The floor is checked in the action, not in the schema.
- `appointmentId`: `idSchema` or null. `observations`: trimmed, empty → null.
- `items`: array of `{ id?, serviceId | newService, quantity, quotedUnitPrice, finalUnitPrice }`. `quantity`: whole number ≥ 1. Prices: `moneyField` (`lib/validation/money-fields.ts`): digits with an optional comma and up to two decimals, `0` allowed, empty → `priceRequired` ("Ingresá el precio."). `serviceId` missing → `serviceRequired` ("Elegí un servicio."); `newService`: `serviceFormSchema.pick` (one schema for both forms). A final price is required in the work phase.
- A cross-field refinement carries the phase, so the same schema validates the form and the action.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `DataTable`, `ListUrlToolbar`, `ListToolbar`, `ListSearchProvider`, `PaginationBar`, `ListNoRows`/`ListError`, `ArchivedBadge`, `DetailModal`, `DetailList`, `ConfirmDialog`, `ArchiveConfirmDialog`/`ArchiveToggleButton`, `TableDate`, `PageHeader`, `LoadingRegion`, `PlateDisplay`, `WhatsappButton`, `StatusBadge`, `SearchableSelect`, `FormattedInput`, `FormRow`, `FIELD_WIDTH`, `NewClientSection`, `useListResults`, `useLoadedData`, `useRemoteOptions`, `useArchiveFlow` | `components/shared/`, `hooks/`, `features/` | Reused as-is |
| `ListParams.filters`, `parseListParams`, `toListSearch`, `useListUrl`, `applyListQuery` (`defaultDirection`) | `lib/list/`, `hooks/` | Extended |
| `FilterPopover`, `ChecklistFilter`, `DateRangeFilter`, `FilterChips` | `components/shared/` | New |
| `StatusTimeline`, `MoneyInput`, `ClosingWarning` | `components/shared/` | New |
| `argentinaDayStart`, `argentinaNextDayStart`, `formatDateTime` | `lib/format/date.ts` | Extended |
| `moneyField`, `kilometersField` | `lib/validation/` | New |
| `jobPhase`, `isClosedStatus` | `lib/status.ts` | Extended |
| `calculateTotals`, `fillFinalPrices`, `jobTotal` | `features/job/total.ts` | Extended |
| Job schemas, list constants, queries, actions | `features/job/` | Extended |
| `JobsPanel`, `JobsTable` (+ skeleton), `JobsList`/`JobsSummary`, `NewJobButton`, `useJobModal`, `JobForm`, `ServicesEditor`, `JobServices`, `JobStatusHistory` | `features/job/components/` | New |
| `searchClientOptions` (`onlyActive`, `currentId`) | `features/vehicle/actions.ts` | Extended |
| `useVehicleModal`, `ClientModal`, `VehicleJobs`/`VehicleJobRow` | `features/vehicle/`, `features/client/`, `features/job/` | Extended: job modes, clickable rows with "Volver" |
| `serviceFormSchema` (`pick`) and the name uniqueness check | `features/service/` | Reused |
| `trabajos/page.tsx` + `loading.tsx` | `app/(app)/trabajos/` | Replaced / new |

## UI text

`messages/es.json`: `jobs` namespace (title, summary with ICU plurals, columns, search placeholder, filters and chips, empty states, modal details, services table, history, form, services editor, new-service section, closing warning and confirmation, archive confirmation, toasts, errors); `validation.vehicleRequired`, `vehicleInvalid`, `serviceRequired`, `serviceInvalid`, `priceRequired`, `kmBelowPrevious`; `common` / `list` / `status.job.*` reused. `vehicles.jobs` loses "not clickable".

## Tests

- **pgTAP** `supabase/tests/09_jobs.sql`: `job_list` columns (plate, brand, model, client, appointment, `total_amount`, `status_order`, sort keys, `search_text`); another shop's jobs never show; `job_status_counts` per status, with search, archived switch and date range, and without the Estado selection; `save_job` creates job + items + status, creates with a new client and new services (ciphertext in tables, plaintext in views), updates and diffs items (update, insert, delete; order survives), keeps the quoted price of existing items in the work phase, closes a job after its items, creates a job directly as closed (two history entries), rolls everything back on a taken DNI, a km below the previous, an archived vehicle / client / service and a closed job (with the right message), rejects another shop's vehicle, client, service or appointment, is not executable by `anon`, and a disabled profile can't use it.
- **Vitest, shared:** `parseListParams`/`toListSearch` with filters, `useListUrl` filters (`setFilters`, `clearAll`, page back to 1, search still out of the URL), `applyListQuery` `defaultDirection`, `argentinaDayStart`/`argentinaNextDayStart` (day boundaries, no DST), `formatDateTime`, `moneyField`, `kilometersField`, `MoneyInput`, `FilterPopover`, `ChecklistFilter`, `DateRangeFilter` (including the error), `FilterChips`, `StatusTimeline`, `jobPhase`, `isClosedStatus`.
- **Vitest, jobs:** schemas (items, phases, both new client and new service, `0` price), `calculateTotals`, `fillFinalPrices`, queries (mocked Supabase: view and column names, sort map, filters, counts, default order), actions (server validation, phase normalization, new-service name taken active/archived, rpc call and read-back, each database error mapped, archive/unarchive, unexpected errors), components (list columns and states, "—" and "Sin cliente", default order with no header marked, sorting, filters and chips, search not in the URL, row opens the modal, view with closed lock and hidden "Editar trabajo", services table per phase, timeline, form: vehicle → client / km / appointment resets, closing warning and confirmation, status switches fill and clear final prices, services editor add / remove / read-only quoted price / new service / errors with focus, no-change edit, toasts, archive flows, a job closed meanwhile), the job modal inside the vehicle modal inside the client modal ("Volver" at each level, X closes the chain, action closes the chain), `readOnly` hides the actions.
- **Accessibility checks:** skeletons `aria-busy` with one announcement; popover and checkbox keyboard; chips removable by keyboard; `aria-sort`; timeline as a list; errors linked in the editor; focus returns after the chain closes.

## Risks and alternatives

- **View cost.** `job_list` decrypts the vehicle and the client of every job the query reads (search and sort need them for the whole shop's jobs). Same scale argument as 006. The `EXPLAIN` check covers pruning; a plain-columns view is the fallback.
- **Estado counts cost.** One extra rpc per search / archived / date change, each scanning `job_list`. Rejected: seven `head` queries (seven scans) and counting in the browser (needs every row).
- **Atomic function size.** `save_job` is long (client, services, item diff, job). Rejected: several Data API calls (partial saves, wrong order for the closed guard) and `security definer` (RLS must apply).
- **Created as closed.** Two history entries for a job created directly as Entregado / Cancelado, because a closed job can't take items. Alternative: disallow those two statuses on creation; not chosen because the docs say any status can be set at any time.
- **Item ordering.** `created_at` default `now()` is the same for every row of a transaction, so the function sets it with `clock_timestamp()` in a loop. Without it the services would come back in an arbitrary order.
- **Stale form.** A job closed in another tab is reported by the database (`job_closed`) and the form stays open with a message; there is no live refresh.
- **Date filter days.** Fixed UTC−3 offset (Argentina has no DST); if that ever changes, one helper changes.
- **Modal depth.** Client → vehicle → job grows `useVehicleModal` and `ClientModal` again. If it gets unwieldy, extract a generic modal-chain stack in a cleanup, as 006 noted.
- **Search state is lost on reload** by decision (as in Vehículos).
