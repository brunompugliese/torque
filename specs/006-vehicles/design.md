# 006 — Vehicles page: Design

**Status:** Approved (by the owner in conversation, 2026-10-21)
**Requirements:** [requirements.md](requirements.md)

## Summary

`/vehiculos` is the third list page and follows `/clientes` ([spec 005](../005-clients/design.md)): a Server Component with the list state in the URL, server-side search, sort and paging, a modal opened from the row already loaded, and writes as Server Actions. It reuses the whole list-page kit. What is new:

- **The search term stays out of the URL** (plate and VIN are encrypted; architecture.md "Never in URLs"). A small `ListSearchProvider` keeps it in component state; `useListUrl` uses it when present. Clientes adopts it in a follow-up.
- **`vehicle_decrypted` gains list columns** (last km, the client's name and phone, sort keys), computed in the view and never stored.
- **A job history** in the vehicle modal, from a new `features/job/` read module.
- **A searchable dropdown** (`SearchableSelect`, generic) for brand, model and client, and an inline "Cliente nuevo" section.
- **One database function** that creates (or updates) a vehicle together with a new client atomically.
- **One vehicle modal, two hosts.** The same modal content serves `/vehiculos` and the client modal (client → vehicle chain), as `ClientModal` already switches modes inside one `DetailModal`.

## Database

Three migrations, no table, policy or trigger changes.

### 1. `ddl-vehicle-list`: new columns at the end of `vehicle_decrypted`

| Column | Value | Used by |
|---|---|---|
| `last_km` | `(select max(j.kilometers) from public.job j where j.vehicle_id = v.id and j.enabled)` | "Último km" column, sort, modal |
| `client_name`, `client_surname`, `client_phone_number` | decrypted from the vehicle's client (null without client) | "Cliente" column, modal |
| `client_enabled` | `c.enabled` (null without client) | "(Archivado)" suffix |
| `client_name_key` | `private.normalize_search(concat_ws(' ', client name, surname))` | "Cliente" sort |
| `vehicle_key` | `private.normalize_search(concat_ws(' ', b.name, m.name))` | "Vehículo" sort |

The view adds `left join public.client c on c.id = v.client_id and c.shop_id = v.shop_id` and a lateral decrypt of the client's columns. `last_km` uses the same rule as `check_job_kilometers` (non-archived jobs) and the existing `idx_job_vehicle`.

- Nothing is stored: no personal data is copied into plaintext columns (rule 2; same decision as spec 005).
- Postgres only evaluates a view column that a query selects or sorts by (stable functions and a join on the primary key are dropped otherwise). The first task checks it with `EXPLAIN` on the list query and on `select id`; if the client decrypt still runs when unselected, the columns move to a separate `vehicle_list` view with the same grants.
- RLS impact: none. The view is `security_invoker`, so the caller's RLS applies to `vehicle`, `client` and `job`; `authenticated` can already read all three and run `decrypt_text`/`normalize_search`. The pgTAP test confirms it for the new columns.
- Existing columns, order, options and grants stay (`create or replace view` only appends).

### 2. `ddl-vehicle-with-new-client`: `public.save_vehicle_with_new_client(...)`

```
save_vehicle_with_new_client(
  p_vehicle_id uuid,                    -- null: create, otherwise: update that vehicle
  p_plate text, p_brand_id uuid, p_model_id uuid, p_year integer, p_vin text,
  p_name text, p_surname text, p_phone_number text, p_dni text
) returns uuid                          -- the vehicle's id
```

- **`security invoker`**, `set search_path = ''`, schema-qualified. It runs as the caller: RLS, composite foreign keys and the encryption triggers all apply. It does not need `security definer` (nothing to bypass).
- Takes the shop from the JWT claim (`(select auth.jwt()) ->> 'shop_id'`), like the RLS policies, so the app never sends a shop id.
- One transaction: inserts the client, then inserts or updates the vehicle with `client_id` set. Any error rolls both back.
- Unique violations are caught and re-raised as `23505` with a stable message: `client_dni_taken` or `vehicle_plate_taken` (decided from the violated constraint's name). The app maps them to field errors, as the business-rule triggers do with `23514`. A missing `p_vehicle_id` raises `vehicle_not_found` (`P0002`).
- The plate and DNI are normalized by the existing triggers, and the app already sends the VIN normalized and the phone formatted.

### 3. `dcl-vehicle-with-new-client`

`revoke execute on function public.save_vehicle_with_new_client(...) from public, anon; grant execute ... to authenticated;` (new functions are executable by `public` by default).

`db_schema.sql` reflects all three, with comments. pgTAP is in `supabase/tests/08_vehicles.sql`.

## Frontend

### Route

```
src/app/(app)/vehiculos/
  page.tsx      # replaces the placeholder: requireSession, parse URL params (search ignored), sections in Suspense
  loading.tsx   # whole-page skeleton
```

`page.tsx` is `clientes/page.tsx` with vehicles: `PageHeader` (title, summary in `<Suspense>`, `AddVehicleButton`), toolbar + table in one `<Suspense>`, all inside `VehiclesPanel` wrapped in `ListSearchProvider`. The server list always renders with `search: ""` (a stale `?buscar=` is ignored); the first search happens on the client.

### List

`features/vehicle/list.ts` (kept out of schemas.ts so the table doesn't load Zod):

| id | Header | Cell | Align | Sort column |
|---|---|---|---|---|
| `patente` | Patente | `PlateDisplay` | center | `plate` |
| `vehiculo` | Vehículo | brand + model (medium weight, min width like Clientes' name) + `ArchivedBadge` | left | `vehicle_key` |
| `anio` | Año | year, "—" | right | `year` |
| `vin` | VIN | VIN, tabular figures, "—" | left | `vin` |
| `cliente` | Cliente | `formatClientName` + "(Archivado)" suffix, or "Sin cliente" in secondary color | left | `client_name_key` |
| `km` | Último km | `formatKm`, "—" | right | `last_km` |
| `creado` | Creado el | `TableDate` | left | `created_at` |

The default sort is `patente` (`VEHICLE_DEFAULT_SORT = "patente"`: the vehicle's identity, as `cliente` and the service name are in the other lists), A–Z, with no header marked like every list. `applyListQuery` needs no change.

Rows come from `vehicle_decrypted` with `VEHICLE_LIST_COLUMNS` (the light `VEHICLE_COLUMNS` plus ids, `created_at` and the new columns), parsed by `vehicleListRowSchema`. Counts are two `head` queries on `vehicle` (total, archived). Search uses `search_text` (plate, VIN, brand, model), which already exists.

### Search outside the URL

- `ListSearchProvider` (`components/shared/list-search-provider.tsx`) holds the typed value and the committed search (debounced 300 ms, then back to page 1).
- `useListUrl` reads its search from the provider when there is one; the URL it writes never contains `buscar`. Without a provider it behaves as today. Sort, page and the archived switch stay in the URL.
- `useListResults` keys on `toListSearch(params)` including the search and passes it to `searchVehicles(key)`: it travels in the Server Action's body, never in a URL.
- Clientes' follow-up is then: wrap its page in the provider (and ignore `buscar` on the server). Tracked as the last task.

### Vehicle modal (shared content)

`useVehicleModal(...)` (`features/vehicle/components/use-vehicle-modal.tsx`) returns the `DetailModal` props for the modes `view`, `edit` and `create`, plus the archive confirmation. Hosts:

- `VehiclesPanel` (client component, like `ClientsPanel`): holds `{ open, mode, vehicle }`; the modal opens from the loaded row.
- `ClientModal`: its mode union gains `vehicle-view`, `vehicle-edit`, `vehicle-create` and a `vehicle` state; it renders the same hook's output. "Volver" from `vehicle-view` goes to the client `view`; the X closes the chain. The client's vehicles reload by themselves when the client modal shows again (the section remounts), and the row the user came from gets the focus. After an action on the vehicle the chain closes (`onClose`), so `fromClient` only carries the client and `onBack`.

Contents:

- **view:** title = `PlateDisplay` + "Brand Model Year" (+ badge); actions "Archivar" / "Desarchivar" (shared `useArchiveFlow`, `ArchiveToggleButton`, `ArchiveConfirmDialog`) and "Editar vehículo"; `DetailList` with Cliente (name + surname, "(Archivado)", phone + `WhatsappButton`, or "Sin cliente"), VIN and Último km ("Sin cargar"); `VehicleJobs`; footer "Creado el" and "Volver" when hosted by a client.
- **edit / create:** `VehicleForm`; edit shows the plate above the subtitle; "Cancelar" returns to `view` (edit) or closes / goes back to the client (create).
- **create from a client:** `VehicleForm` gets `lockedClient`: the Cliente field is a read-only field with the client's name and no quick create. After saving, the whole chain closes with a toast (the rule below).

### Job history

`features/job/` (new, read only for now): `queries.ts` `listVehicleJobs(vehicleId)`, `schemas.ts` (`jobRowSchema`), `actions.ts` `getVehicleJobs(vehicleId)` (read action behind `requireSession()`), `components/vehicle-jobs.tsx`.

- Query: `job` (not `job_decrypted`: no encrypted column is needed) selecting `id, status, kilometers, quoted_total, final_total, enabled, created_at` with its items' service names (`job_item(created_at, service(name))`), ordered by `created_at` and `id` descending. If PostgREST can't embed through the composite foreign keys, the fallback is two queries (jobs, then items by `job_id`).
- `VehicleJobs` loads with `useLoadedData` (skeleton, `ListError` with "Reintentar", empty text), shows five rows and "Ver todos (N)" expanding in place (N = all jobs). A row (`VehicleJobRow`) is two lines in the modal's width: date + km and the status badge on the first, services (one line, truncated with "…") and the total with its "Final" / "Presupuestado" label on the second. Not clickable.
- The total is `final_total ?? quoted_total`, labelled by which one it is; no total at all shows "—".
- `StatusBadge` (`components/shared/status-badge.tsx`) and `lib/status.ts` (database status → family, label key) are the shared helper conventions.md asks for; the job tokens already exist in `globals.css`.

### Rules for every screen (owner, 2026-10-21)

Four rules that this page follows and every screen after it ([design.md](../../docs/design.md): Modals, Forms, Loading, Plates; [conventions.md](../../docs/conventions.md) for the code). They changed Servicios and Clientes too.

| Rule | How it is built |
|---|---|
| Every action closes the modal | After a successful create, edit, archive or assign, the modal toasts and calls `onOpenChange(false)` (`useVehicleModal`'s `onClose`, which closes the whole chain from the client modal); `onModeChange` only moves between view, edit and steps. `ServiceModal`, `ClientModal` (create, edit, assign) changed the same way. A partial assignment is the one result that stays, to show its message |
| Two columns, fields as wide as their values | `FormRow` (two to a row from `sm`, stacked below) and `FIELD_WIDTH` (year, plate, DNI, phone, VIN) in `components/shared/form-layout.tsx`; `ClientForm`, `VehicleForm` and `NewClientSection` use them, `ServiceForm` keeps its long fields full width |
| Every plate has the same drawing and room | `PlateDisplay` has one fixed width (`PLATE_WIDTH_CLASS`, fits "AB 123 CD"); the table column and the skeletons use the same class |
| A list shows its skeleton on every load | `useListResults` already reported `pending`; each list view passes it to its table, which renders `DataTable` with `loading` (header and sort buttons stay, body placeholders, one "Cargando…") instead of the old rows. `DataTableColumn` has `skeletonLines` for multi-line cells. Servicios, Clientes and Vehículos do it |

### Form

`VehicleForm` (React Hook Form + `vehicleFormSchema`), field order: plate, year, brand, model, VIN, client; registered where they appear so "focus the first error" follows the page.

- **Plate:** `onChange` runs `formatPlateInput` (drop non-alphanumerics, uppercase, 7 max, spaced only when the value fits one of the two known shapes, so it matches `formatPlate`). Caret goes to the end, as in the phone field.
- **Year:** numeric keyboard, text input; the schema turns it into a number.
- **VIN:** `onChange` strips hyphens and spaces, uppercases and caps at 17.
- **Brand / model:** `SearchableSelect` fed by read actions `getBrandOptions(currentId?)` and `getModelOptions(brandId, currentId?)` (`brand` / `model` are global tables, read directly; enabled rows plus the vehicle's current one). Models load when the brand changes (`useLoadedData` keyed by brand); the model field is disabled with "Primero elegí la marca" until then and cleared when the brand changes. Typed text with no selection is a form-level check (the server only receives ids): `brandInvalid` / `modelInvalid`.
- **Client:** `SearchableSelect` in remote mode. Typing (debounced 300 ms) calls `searchClientOptions(term)`: up to 10 matches from `client_decrypted.search_text` ordered by `name_key`, archived included. Options show the name and the phone in grey, archived ones with "(Archivado)". The last option "+ Crear cliente nuevo" hides the dropdown and opens `NewClientSection` with an X. Carry-over: digits go to Teléfono, otherwise the text splits into Nombre and Apellido at the first space (`splitTypedClient`, in `features/vehicle/`).
- **`NewClientSection`:** Nombre, Apellido, Teléfono, DNI with the same input rules as `ClientForm`; it validates with `clientFormSchema.pick(...)` (one schema for both forms). Choosing a client from the list or discarding the section clears the other.
- **Submit:** unchanged edits (after normalization) go back without a request. Otherwise `createVehicle` / `updateVehicle`.

### `SearchableSelect`

`components/ui/combobox.tsx` comes from the shadcn CLI (Base UI Combobox, version 1.8 already installed); `components/shared/searchable-select.tsx` wraps it as design.md's "Searchable dropdowns": options with main text and grey secondary text, `filter` either local (accent- and case-insensitive through `normalizeSearch`) or none (the caller filters remotely and passes `loading`), a final action option (`footerAction`), `disabled` with a reason, empty text, and `aria-invalid` / `aria-describedby` for `Field`. It exposes the typed text so a form can reject text that matches nothing. Keyboard: arrows, Enter, Esc come from Base UI.

## Server data and actions

`features/vehicle/queries.ts`: `listVehicles(params)` and `getVehicleCounts()` (cached with primitive arguments, like clients), `listClientVehicles` (switches to `VEHICLE_LIST_COLUMNS` so the client's vehicle rows can open the full modal), brand, model and client option queries.

`features/vehicle/actions.ts` (the existing `getClientVehicles`, `getUnassignedVehicles`, `assignVehiclesToClient` stay):

- `createVehicle(input)`, `updateVehicle(id, input)`: validate with `vehicleFormSchema`. Without a new client: `insert` / `update` on `vehicle` (shop id from the session, as `createClient`), then read the row back through `vehicle_decrypted`. With a new client: `rpc("save_vehicle_with_new_client")`, then read back. Queries per save: 2 (write, read back).
- **Uniqueness** relies on the constraints. On `23505` (direct write) or the function's `vehicle_plate_taken` / `client_dni_taken`, the action looks the value up with `findByKey` (`vehicle_decrypted.plate`, `client_decrypted.dni`, `excludeId` on edit) to choose between the taken and taken-archived messages, returned as field errors (`plate`, `newClient.dni`). No lookup on the happy path.
- `setVehicleArchived(id, archived)`; `searchVehicles(listSearch)`; `getBrandOptions`, `getModelOptions`, `searchClientOptions(term)`.
- Error keys: `invalid`, `plateTaken`, `plateTakenArchived`, `dniTaken`, `dniTakenArchived`, `notFound`, `unexpected`. A foreign-key violation (a brand/model pair or client that doesn't exist for the shop) is `invalid`.
- Revalidation: `/vehiculos` on every write, plus `/clientes` when a client was created (its summary changes).
- Actions log only error codes, never personal data.

## Validation

`vehicleFormSchema` (`features/vehicle/schemas.ts`), used by the form and the actions:

- `plate`: `plateField` (`lib/validation/vehicle-fields.ts`): strips non-alphanumerics, uppercases, empty → `plateRequired`, not 6 or 7 characters → `plateInvalid`.
- `year`: `yearField`: empty → null, otherwise a whole number from 1886 to `maxVehicleYear()` (next year, Argentina time, in `lib/format/date.ts` beside `APP_TIME_ZONE`) → `yearInvalid`. The form fills the `{max}` of its message from the same function.
- `brandId`, `modelId`: `idSchema` with `brandRequired` / `modelRequired`.
- `vin`: `vinField`: trims, removes hyphens, uppercases; empty → null; otherwise exactly 17 characters of `[A-HJ-NPR-Z0-9]` → `vinInvalid`.
- `clientId`: `idSchema` or null. `newClient`: the picked client fields or null; having both is invalid.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `DataTable`, `ListUrlToolbar`, `PaginationBar`, `ListNoRows`/`ListError`, `ArchivedBadge`, `DetailModal`, `DetailList`, `ArchiveConfirmDialog`/`ArchiveToggleButton`, `TableDate`, `PageHeader`, `LoadingRegion`, `PlateDisplay`, `WhatsappButton`, `VehicleRow` | `components/shared/`, `features/vehicle/` | Reused as-is |
| `useListUrl` | `hooks/use-list-url.ts` | Extended: search from `ListSearchProvider` when present |
| `ListSearchProvider` | `components/shared/list-search-provider.tsx` | New |
| `SearchableSelect`, `Combobox` | `components/shared/`, `components/ui/` | New (shadcn CLI) |
| `StatusBadge`, job status helper | `components/shared/status-badge.tsx`, `lib/status.ts` | New |
| `formatKm`, `formatMoney`, `formatThousands` | `lib/format/` | New; `formatThousands` extracted from `formatDni`. Hand-built like `formatDni` because the fixed `es` locale doesn't group four-digit numbers, and design.md wants "9.500 km" |
| `formatPlateInput`, `PLATE_MAX_LENGTH` | `lib/format/plate.ts` | Extended |
| `plateField`, `vinField`, `yearField`, `ValidationErrorKey` | `lib/validation/vehicle-fields.ts`, `fields.ts` | New / extended |
| `maxVehicleYear` | `lib/format/date.ts` | Extended |
| `clientFormSchema` | `features/client/schemas.ts` | Reused (`pick`) |
| Vehicle schemas, list constants, queries, actions | `features/vehicle/` | Extended |
| `VehiclesPanel`, `VehiclesTable` (+ skeleton), `VehiclesList`/`VehiclesSummary`, `useVehicleModal`, `VehicleForm`, `NewClientSection`, `AddVehicleButton`, `splitTypedClient` | `features/vehicle/components/` | New |
| Job module (`VehicleJobs`, `VehicleJobRow`, queries, action) | `features/job/` | New |
| `ClientModal`, `ClientVehicles`, `AddVehicleChoice` | `features/client/components/` | Extended: vehicle modes, clickable rows, "Crear un vehículo nuevo" enabled |
| `vehiculos/page.tsx` + `loading.tsx` | `app/(app)/vehiculos/` | Replaced / new |

## UI text

`messages/es.json`: `vehicles` namespace (title, summary with ICU plurals, columns, search placeholder, empty states, modal and details, jobs history with "Final" / "Presupuestado" and "Ver todos ({count})", form, new-client section, archive confirmation, toasts, errors); `validation.plateRequired`, `plateInvalid`, `yearInvalid`, `vinInvalid`, `brandRequired`, `brandInvalid`, `modelRequired`, `modelInvalid`; `status.job.*` (conventions.md); `common` / `list` reused. `clients.addVehicle.createSoon` is removed.

## Tests

- **pgTAP** `supabase/tests/08_vehicles.sql`: `last_km` is the highest km among non-archived jobs and null without jobs; the client columns and `client_name_key` match the right client, are null without one and sort by name; `vehicle_key`; another shop's vehicles, clients and jobs never show through the view; `save_vehicle_with_new_client` creates both rows (ciphertext in the tables, plaintext in the views), updates an existing vehicle with the new client, rolls back both when the plate or the DNI is taken (the right message), rejects a vehicle or model of another shop, is not executable by `anon`, and a disabled profile can't use it.
- **Vitest, shared:** `formatPlateInput`, `formatKm`, `formatMoney`, `formatThousands` (and `formatDni` unchanged), `plateField`, `vinField`, `yearField`, `maxVehicleYear` (year boundary in Argentina time), `useListUrl` with the provider (the URL never gets `buscar`; page back to 1), `ListSearchProvider`, `SearchableSelect` (local and remote filtering, typed-text reporting, footer action, disabled reason, keyboard, accessible names), `StatusBadge` and the status helper.
- **Vitest, rules for every screen:** each modal closes after its actions (services, clients, assigning, vehicles, the chain) and stays open on failure; `FormRow` and `FIELD_WIDTH`, and the layout of the client, vehicle and new-client forms; `PlateDisplay` has one box for every format; `DataTable` loading (header and sort buttons stay, placeholders, announced once, not clickable) and each list view showing placeholders while a search loads, then the results, and on retry.
- **Vitest, vehicles and jobs:** schema, queries (mocked Supabase: view and column names, sort map, counts), actions (validation on the server, create/update/read-back, with and without a new client, plate and DNI taken active/archived/self, archive/unarchive, unexpected errors), components (list states and columns, "—" and "Sin cliente", default A–Z by plate with no header marked, sort headers, row opens the modal, search not in the URL, create / edit / archive flows and toasts, field errors with focus, carry-over into the new-client section, brand → model dependency, job history loading / empty / error / five rows / "Ver todos" / "Final" vs "Presupuestado" / not clickable), the vehicle modal inside the client modal (open from a row, "Volver", X closes the chain, create from a client with the locked field, toast, vehicles reload), and the updated `AddVehicleChoice`.
- **Accessibility checks:** skeletons `aria-busy` with one announcement; combobox roles and keyboard; `aria-sort`; focus returns after the chain closes.

## Risks and alternatives

- **View cost.** Each list request decrypts the shop's vehicles (as today) and, only when the client or km columns are selected or sorted, the clients and the jobs' km. Selected columns are needed for the 25 visible rows and for sorting by them. Fine at one shop's scale; the `EXPLAIN` check and the `vehicle_list` fallback cover the case where the view doesn't prune. Rejected: a trigger-maintained `last_km` (stale-value risk, more write-path code) and any stored client name (plaintext personal data).
- **Remote client search vs. loading all clients.** One query per debounced keystroke, each decrypting the shop's clients (like the Clientes list), against shipping every client's personal data to the browser at once. Chosen for privacy and because the list can't be bounded; the in-memory approach used for unassigned vehicles stays right for that short list. If requests prove costly, a minimum of two typed characters is a one-line change.
- **Search state is lost on reload** by decision (nothing sensitive in URLs). Back/forward don't restore it either.
- **Constraint names** in the function (`client_shop_id_dni_hash_key`, `vehicle_shop_id_plate_hash_key`) must match what the base migration generated; the pgTAP test fails if not.
- **PostgREST embed** of services through composite foreign keys may need a hint or the two-query fallback.
- **Formatting the plate while typing** moves the caret to the end when editing in the middle (accepted for 7 characters, as with the phone). Unusual plates (motorcycles) show unspaced in the field and in `PlateDisplay`, consistently, because both use the same two known shapes.
- **Duplicated state between hosts.** The vehicle modal lives inside `ClientModal` and `VehiclesPanel`; sharing it through `useVehicleModal` avoids two copies, at the cost of `ClientModal` growing (it already switches five modes). If it gets unwieldy, split the client chain into its own component in a cleanup.
- **A stale vehicle in the client modal.** Rows come from the last load of the client's vehicles; after editing or archiving the vehicle the client modal reloads them when it shows again.
