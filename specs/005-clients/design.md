# 005 — Clients page: Design

**Status:** Approved
**Requirements:** [requirements.md](requirements.md)

## Summary

`/clientes` is the second list page and follows the shape of `/servicios` ([spec 004](../004-services/design.md)): a Server Component with the list state in the URL (`?buscar=&archivados=1&orden=&sentido=&pagina=`), server-side search, sort and paging, fetch-only updates through a Server Action, the client modal opened from the row already loaded, and writes as Server Actions that call `revalidatePath`. It reuses the whole list-page kit and adds what is specific to clients:

- Personal data is encrypted, so rows are **read through `client_decrypted`** and **written to `client`** (the triggers encrypt on write).
- The client modal has a **vehicles section** that loads its own data, and an **add-vehicle flow** (choose → assign several existing vehicles) inside the same modal.
- New generic pieces: `PlateDisplay`, an in-memory filter and pager, the phone/DNI/optional-email field rules, and the WhatsApp link builder.

Cheap on the free tier: sort keys are computed in the view only when selected, counts use `head` queries on the base table (no decryption), and the assign step filters in memory instead of querying.

## Database

One migration, `ddl-client-search`, that only replaces two views (adds columns at the end; existing columns and grants stay). No table, trigger or grant changes.

`client_decrypted` gets sort keys (computed from the decrypted values, never stored):

| Column | Value | Used by |
|---|---|---|
| `name_key` | `private.normalize_search(concat_ws(' ', name, surname))` | "Cliente" sort and default order |
| `dni_number` | `dni::numeric` (null when no DNI; the trigger guarantees digits only, `numeric` has no size limit) | "DNI" numeric sort |
| `phone_key` | `regexp_replace(phone_number, '\D', '', 'g')` | "Teléfono" sort |
| `email_key` | `lower(email)` | "Email" sort |

"Creado el" sorts on the existing `created_at`.

`vehicle_decrypted` gets `brand_name` and `model_name` (it already joins `brand` and `model` for `search_text`).

- Migration: `<ts>_ddl-client-search.sql`. `db_schema.sql` updated in the same change.
- RLS impact: none. Both views are `security_invoker`, so the caller's RLS still applies; the tests confirm it for the new columns.
- No new `EXECUTE` grants: the views call functions the app role can already run.
- Writes need nothing new: `vehicle.client_id` is already updatable by `authenticated`, the composite FK keeps the client in the same shop, and `trg_vehicle_encrypt` keeps the encrypted plate when `plate` isn't touched.

## Frontend

### Route

```
src/app/(app)/clientes/
  page.tsx      # replaces the placeholder: requireSession, parse URL params, sections in Suspense
  loading.tsx   # whole-page skeleton
```

`page.tsx` is `servicios/page.tsx` with clients: `PageHeader` (title, summary in `<Suspense>`, `AddClientButton`), then toolbar + table in one `<Suspense>` with `ListToolbarSkeleton` and `ClientsTableSkeleton` as fallback, all inside `ClientsPanel`.

### List

Columns (`features/client/components/clients-table.tsx`):

| id | Header | Cell | Align | Sort column |
|---|---|---|---|---|
| `cliente` | Cliente | name + surname (medium weight) + `ArchivedBadge` | left | `name_key` |
| `dni` | DNI | `formatDni`, tabular figures, "—" when empty | right | `dni_number` |
| `telefono` | Teléfono | as entered, "—" when empty | left | `phone_key` |
| `email` | Email | address, "—" when empty | left | `email_key` |
| `creado` | Creado el | `TableDate` | left | `created_at` |

The default sort is `cliente` and no header is marked (`CLIENT_DEFAULT_SORT = "cliente"`, as services). Searching uses `search_text` of the view, which already covers name, surname, DNI, phone and email through `normalize_search`.

Empty values sort last in both directions: `applyListQuery` passes `nullsFirst: false` to every `order()` (`ListQueryBuilder.order` takes the option). Services never have empty sort values, so nothing changes there. The `id` tiebreak stays.

### Client modal

`ClientsPanel` (client component, like `ServicesPanel`) holds one modal with a `mode`:

```
view ⇄ edit
view → add-vehicle (choose) → assign        create (from "Agregar cliente")
```

"Volver" in `add-vehicle` and `assign` goes back one step (`DetailModal.onBack`); from `view` there is none. The X closes the whole chain (shared behavior).

- **view:** header, `DetailList` (DNI, Teléfono + WhatsApp button, Email), the vehicles section, footer "Creado el". The phone value is `<span>{phone}</span>` plus `WhatsappButton`.
- **Vehicles section:** `ClientVehicles` loads with `useLoadedData` (below) through the `getClientVehicles(clientId)` action: skeleton while loading, `ListError` with "Reintentar" on failure, the empty text, or the rows. "Agregar vehículo" sits on the section title line.
- **choose:** two large rows. "Asignar un vehículo existente" loads the unassigned vehicles when the step opens (`getUnassignedVehicles()`, skeleton while loading) and is greyed out with "No hay vehículos sin cliente" when empty. "Crear un vehículo nuevo" is greyed out with "Próximamente" (a disabled button with `aria-disabled` and its subtitle).
- **assign:** `AssignVehicles`: search box, five checkbox rows, `PaginationBar`, footer "Volver" / "Asignar vehículo(s)". Details below.
- **edit / create:** `ClientForm`, same pattern as `ServiceForm`.
- After assigning, the mode returns to `view` and the vehicles section reloads (its `key` changes), so the new vehicles appear without a page revalidation.

The modal keeps `DetailModal`'s width; vehicle rows wrap onto two lines instead (plate and brand + model on the first, year and VIN in secondary color on the second, badge at the end).

### Assign step (in memory)

All unassigned vehicles come in one fetch. Everything after is client state:

- `filterByText(items, term, getText)` in `lib/list/memory.ts` keeps the items whose `normalizeSearch(getText(item))` contains `normalizeSearch(term)`. The text is plate (unspaced), brand, model, year and VIN. Returns the same order.
- `paginate(items, page, pageSize)` in the same file returns the slice; `pageCount`/`pageRange` from `lib/list/pagination.ts` and the shared `PaginationBar` give the controls (5 per page).
- A new `SearchBox` is extracted from `ListToolbar` to `components/shared/search-box.tsx` (input with the magnifier, label, placeholder) so both use it; `ListToolbar` renders it unchanged.
- The selection is a `Set` of vehicle ids in state, independent of the filter and page. The button label comes from its size.
- Filtering resets to page 1. Unmounting the step discards everything.
- Shared checkbox: a new shadcn `Checkbox` (Base UI) in `components/ui/checkbox.tsx`; each row is a `<label>` so the whole row toggles it, with the plate and brand + model as its accessible name.

### URL state and fetching

Same as services: `useListUrl`, `useListResults` with `searchClients(key)` as the fetcher, `LIST_PAGE_SIZE`, debounced search. Column ids: `cliente`, `dni`, `telefono`, `email`, `creado`. Personal data never goes into the URL beyond the search text the user types, which is not stored or logged.

### Loaders for the modal

New `hooks/use-loaded-data.ts`: `useLoadedData(load, deps)` returns `{ status: "loading" | "error" | "ready", data, retry }`, drops answers from superseded requests (same technique as `useListResults`), and is generic (future modals reuse it). `ClientVehicles` and the assign step use it with the two read actions.

### WhatsApp

`lib/format/whatsapp.ts`: `toWhatsappUrl(phone)` returns `https://wa.me/<number>`, where the number is the digits of `phone`, leading zeros dropped, prefixed with `549` unless it starts with `54`. `WhatsappButton` (`components/shared/whatsapp-button.tsx`) is generic: an `<a>` styled as an icon button (Phosphor `WhatsappLogoIcon`), `target="_blank"`, `rel="noopener noreferrer"`, `aria-label` from a prop, no visible text. It always renders.

Color: a new token `--whatsapp` (and `--color-whatsapp`) in the brand kit in `globals.css`, `#128c7e`, picked for at least 3:1 against `--card` (non-text contrast). `theme-tokens.test.ts` covers it per conventions. `docs/design.md` lists it with the other brand colors.

### Plate

`lib/format/plate.ts`: `formatPlate(plate)` returns `AB 123 CD` for `AA999AA`, `ABC 123` for `AAA999`, otherwise the uppercase stored value. `components/shared/plate-display.tsx`: `PlateDisplay` draws the plate (white fill, 1px black border, 6px radius, `bg-plate-band` strip on top, bold spaced characters, tabular figures). The visible text is the accessible text; the band is `aria-hidden`. Plain text uses `formatPlate` directly (toasts).

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `DataTable`, `ListToolbar`, `PaginationBar`, `ListEmpty`/`ListError`, `ArchivedBadge`, `DetailModal`, `DetailList`, `ConfirmDialog`, `TableDate`, `LoadingRegion`, `PageHeader`, `TextSkeleton` | `components/shared/` | Reused as-is |
| `ListToolbar` | `components/shared/list-toolbar.tsx` | Extended: uses `SearchBox` |
| `SearchBox` | `components/shared/search-box.tsx` | New (extracted) |
| `PlateDisplay` | `components/shared/plate-display.tsx` | New |
| `WhatsappButton` | `components/shared/whatsapp-button.tsx` | New |
| `Checkbox` | `components/ui/checkbox.tsx` | New (shadcn) |
| `applyListQuery` | `lib/list/query.ts` | Extended: `nullsFirst: false` |
| `filterByText`, `paginate` | `lib/list/memory.ts` | New |
| `useLoadedData` | `hooks/use-loaded-data.ts` | New |
| `formatPlate` | `lib/format/plate.ts` | New |
| `formatDni` | `lib/format/dni.ts` | New: dot thousands |
| `toWhatsappUrl` | `lib/format/whatsapp.ts` | New |
| `phoneField`, `dniField`, `optionalEmailField` | `lib/validation/fields.ts` | Extended (and `ValidationErrorKey`: `phoneRequired`, `dniInvalid`) |
| `findByKey`, `existsWhere`, `ActionResult`, `normalizeSearch`, `DATE_FORMAT` | `lib/` | Reused |
| `NAV_ITEMS` | `lib/navigation.ts` | Reused (Clientes is already there) |
| Client schema, queries, actions | `features/client/` | New |
| Vehicle row schema, read queries, `assignVehiclesToClient` | `features/vehicle/` | New (the Vehículos spec extends it) |
| `ClientsPanel`, `ClientsTable` (+ skeleton), `ClientsToolbar`, `ClientsList`/`ClientsSummary` sections, `ClientModal`, `ClientForm`, `ClientVehicles`, `AddVehicleChoice`, `AssignVehicles`, `AddClientButton` | `features/client/components/` | New |
| Vehicle row | `features/vehicle/components/vehicle-row.tsx` | New: plate, brand + model, year, VIN, badge; used by the client modal and the assign step |
| `clientes/page.tsx` + `loading.tsx` | `app/(app)/clientes/` | Replaced / new |
| `--whatsapp` | `app/globals.css` | New token |

## Server data

`features/client/queries.ts` (like services; `cache()` with primitive arguments):

- `listClients(params)`: `client_decrypted` with `applyListQuery` (`searchColumn: "search_text"`, `sortColumns`: `cliente → name_key`, `dni → dni_number`, `telefono → phone_key`, `email → email_key`, `creado → created_at`), selecting `id, name, surname, dni, phone_number, email, enabled, created_at`, `count: "exact"`.
- `getClientCounts()`: two `head` counts on `client` (total, archived).

`features/vehicle/queries.ts`: `listClientVehicles(clientId)` and `listUnassignedVehicles()` read `vehicle_decrypted` (`id, plate, brand_name, model_name, year, vin, enabled`), filtered by `client_id = clientId` or `client_id is null`, ordered by `created_at` and `id` so the order is stable between loads. Rows are parsed with Zod (types aren't generated yet).

## Actions

`features/client/actions.ts`: `createClient`, `updateClient`, `setClientArchived`, `searchClients`.

- Writes go to the `client` table and the saved row is read back from `client_decrypted` by id (inserting and updating return ciphertext). Queries per save: create 2 (insert, read back); edit 2 (update, read back) plus 1 lookup only when the insert/update fails.
- **DNI uniqueness** relies on the database constraint (`unique (shop_id, dni_hash)`). On `23505`, the action looks the DNI up with `findByKey({ table: "client_decrypted", column: "dni", key: digits, excludeId })` to choose between `dniTaken` and `dniTakenArchived`; both come back as field errors on `dni`. No lookup on the happy path.
- Error keys: `invalid`, `dniTaken`, `dniTakenArchived`, `notFound`, `unexpected`.
- No rename confirmation and no check on name or phone.

`features/vehicle/actions.ts`: `getClientVehicles(clientId)` and `getUnassignedVehicles()` (read actions for the modal, validated and behind `requireSession()`), and `assignVehiclesToClient(clientId, vehicleIds)`:

- Validates `clientId` and 1..N distinct uuids with Zod.
- One statement: `update vehicle set client_id = :clientId where id in (:ids) and client_id is null returning id`. The guard keeps vehicles that got a client meanwhile untouched; RLS keeps it inside the shop.
- Result data: `{ assigned: string[], skipped: number }`. `skipped > 0` is the "Algunos vehículos ya tenían un cliente." / "Este vehículo ya tiene un cliente." case (a client error shown in the step; the step's list is refetched). Nothing assigned: `fail("alreadyAssigned")`. Archived clients are valid owners, so there is no check on `enabled`.
- Revalidates `/vehiculos` (the future page); `/clientes` doesn't show vehicle data, and the modal reloads its own section.

All actions log only error codes, never personal data.

## Validation

`clientFormSchema` (`features/client/schemas.ts`), used by the form and by the actions:

- `name`: `requiredTextField("nameRequired")`.
- `surname`: `optionalTextField`, with inner spaces collapsed.
- `phoneNumber`: `phoneField`: trimmed, hyphens removed, required (`phoneRequired`).
- `dni`: `dniField`: dots and spaces removed; empty → `null`; anything but digits → `dniInvalid`.
- `email`: `optionalEmailField`: trimmed, empty → `null`, then `z.email` (`emailInvalid`, the existing key).

The no-change check compares the normalized form with the current row, as services do.

## UI text

`messages/es.json`: `nav` unchanged; `clients` namespace (title, summary and count with ICU plurals, columns, search placeholder, empty states, modal, form, vehicles section, add-vehicle steps, assign step, confirmation, toasts, errors); `validation.phoneRequired`, `validation.dniInvalid`; `common` reused; `list` reused (`range`, `previous`, `next`, `goToPage`, `searchLabel`, `retry`). New shared texts go under `common`/`list`, not under `clients`.

## Tests

- **pgTAP** `supabase/tests/07_clients.sql`: `client_decrypted.name_key` is the same for names differing in case, accents and spaces, and orders by name then surname; `dni_number` is numeric (7 digits sorts before 8) and null without DNI; `phone_key` has digits only; `email_key` is lowercase; `search_text` finds a client by name, surname, DNI with and without dots, phone without hyphens and email; `vehicle_decrypted` exposes `brand_name` and `model_name` and the right ones; another shop's clients and vehicles never show through either view; assigning `vehicle.client_id` works inside the shop, is rejected for a client of another shop (composite FK), and works for an archived client; the plate stays intact after the update.
- **Vitest, shared:** `formatPlate`, `PlateDisplay` (white/band/text, accessible text), `toWhatsappUrl` (leading zeros, `54` prefix kept, `549` added, symbols, empty), `WhatsappButton` (always renders, no visible text, accessible name, `rel`, new tab), `formatDni`, `filterByText`/`paginate` (accents, spaces, dots, empty term, page bounds), `useLoadedData` (loading → ready, error + retry, stale answers dropped), `SearchBox`, `Checkbox`, `applyListQuery` with `nullsFirst`, the new field rules, `ListToolbar` after the extraction.
- **Vitest, clients:** schema, queries (mocked Supabase: view and column names, sort map, counts), actions (validation on the server, create/update/read-back, DNI taken active/archived/self, archive/unarchive, unexpected errors, `assignVehiclesToClient` with all/partial/none assigned), components (list states, row opens modal, columns and "—" values, sort headers, create/edit/archive/unarchive flows and toasts, field errors with focus, WhatsApp button, vehicles section loading/empty/error/rows, add-vehicle choose step with "Próximamente" and "No hay vehículos sin cliente", assign step: skeleton, paging by 5, in-memory search without requests, selection kept across pages and filters, button label by count, no-selection error, partial-assign message, "Volver" at each step).
- **Accessibility checks in component tests:** skeletons `aria-busy` with one announcement; checkbox names; header `aria-sort`; focus returns after the modal chain closes.

## Risks and alternatives

- **Decrypting to sort and search.** The views decrypt every row of the shop on each list request. Fine at a shop's scale (hundreds of clients); the sort keys are computed only when selected. Rejected: stored sort columns (they'd copy personal data into plaintext columns, against the encryption rule).
- **DNI sorted as `numeric`.** Relies on the trigger leaving digits only; a non-digit value would make the view fail on that row. Mitigation: `dni` is written only through the trigger, and the pgTAP test covers it. Alternative: a padded text key, rejected for being less clear.
- **WhatsApp number rule.** Argentina's mobile format is a first version (the owner expects to iterate). A phone entered with "15" after the area code won't open the right chat; fixing it is a change in one function.
- **Unbounded unassigned-vehicles fetch.** One query returns every vehicle without a client. Fine now; if a shop accumulates thousands, move the assign step to server-side search. Accepted by the owner.
- **Stale assign list.** The list may include a vehicle that got a client meanwhile; the `client_id is null` guard in the update and the partial-result message cover it.
- **Vehicle read queries live in `features/vehicle`** though the Vehículos page doesn't exist yet. The alternative (inside `features/client`) would be moved later; creating the module now keeps Vehículos from having to untangle it.
