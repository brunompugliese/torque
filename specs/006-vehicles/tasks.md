# 006 — Vehicles page: Tasks

**Status:** Approved (by the owner in conversation, 2026-10-21)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Database: vehicle list columns**
  - Do: migration `ddl-vehicle-list` (`vehicle_decrypted`: `last_km`, `client_name`, `client_surname`, `client_phone_number`, `client_enabled`, `client_name_key`, `vehicle_key`); check with `EXPLAIN` that unselected columns aren't computed (else the `vehicle_list` view fallback); `db_schema.sql`.
  - Verify: `npx supabase test db` (CI, or locally with Docker) with the view cases of `supabase/tests/08_vehicles.sql`.
  - Written; migration applied to the hosted project by the owner. The pgTAP tests have not run yet (Docker isn't running locally): pending the CI run on the PR. The `EXPLAIN` check is still to do (needs a database with the migration).
- [x] **2. Database: `save_vehicle_with_new_client`**
  - Do: migrations `ddl-vehicle-with-new-client` and `dcl-vehicle-with-new-client`; constraint names are matched by column (`plate_hash`, `dni_hash`) instead of by their generated names; `db_schema.sql`; the function cases of `08_vehicles.sql` (both rows, update path, rollback on taken plate and DNI, cross-shop, `anon`, disabled profile); tests README.
  - Verify: pgTAP passes.
  - Written; pending the owner applying the migrations and the CI run.
- [x] **3. Shared helpers**
  - Do: `formatThousands` (extracted from `formatDni`), `formatKm`, `formatMoney`; `formatPlateInput` and `PLATE_MAX_LENGTH`; `maxVehicleYear`; `plateField`, `vinField`, `yearField` and their error keys; `lib/status.ts`.
  - Verify: Vitest tests for each (existing `formatDni` and `fields` tests still pass).
- [x] **4. Search outside the URL**
  - Do: `ListSearchProvider`; `useListUrl` reads the search from it when present and never writes `buscar`.
  - Verify: Vitest tests (URL never gets the search, page returns to 1, behavior without a provider unchanged).
- [x] **5. Shared components**
  - Do: shadcn `combobox` through the CLI; `SearchableSelect` (local and remote filtering, typed text, footer action, disabled reason); `StatusBadge`.
  - Verify: Vitest tests for each, including keyboard and accessible names.
- [x] **6. Job read module**
  - Do: `features/job/` schemas, `listVehicleJobs`, `getVehicleJobs` (embed or two-query fallback), `VehicleJobs` and `VehicleJobRow`; `status.job.*` messages.
  - Verify: schema, query and action tests; component tests (loading, error, empty, five rows, "Ver todos (N)", "Final" vs "Presupuestado", not clickable).
- [x] **7. Vehicle data layer**
  - Do: extend `features/vehicle/` schemas (`vehicleFormSchema`, list row schema, list constants), queries (`listVehicles`, counts, brand, model and client options, `listClientVehicles` with the full columns) and actions (`createVehicle`, `updateVehicle`, `setVehicleArchived`, `searchVehicles`, option actions); `validation` keys (the `vehicles` messages arrive with the components that use them, tasks 8 and 9).
  - Verify: schema, query and action tests (server validation, create/update read-back with and without a new client, plate and DNI taken active/archived/self, archive/unarchive, unexpected errors).
- [x] **8. Vehicles page: list**
  - Do: `app/(app)/vehiculos/page.tsx` + `loading.tsx`; `VehiclesPanel`, `VehiclesTable` (+ skeleton), sections, `AddVehicleButton`.
  - Verify: component tests (columns, "—" and "Sin cliente", A–Z by plate with no header marked, sorting, search not in the URL, archived switch, list states, row opens the modal); `npm test`, `npm run lint`, `npm run build`.
- [x] **9. Vehicle modal, form and archive**
  - Do: `useVehicleModal` (view with WhatsApp and job history, edit, create), `VehicleForm` with `NewClientSection` and `splitTypedClient`, archive/unarchive, toasts. Also built here: `FormattedInput` (`ClientForm` uses it too) and `useRemoteOptions`.
  - Verify: component tests (create/edit/no-change flows, field errors with focus, carry-over, brand → model, locked client, archive/unarchive, toasts).
- [x] **10. Clientes integration**
  - Do: `ClientModal` vehicle modes, clickable rows in `ClientVehicles`, "Crear un vehículo nuevo" enabled in `AddVehicleChoice` (remove `createSoon`), reload of the client's vehicles on return.
  - Verify: updated and new component tests ("Volver", the X closes the chain, create from a client, toast, reload); `npm test`.
- [x] **11. Docs**
  - Do: `docs/architecture.md` (view columns, function, search provider, new shared pieces, structure), `docs/conventions.md` (searchable select, formats), `CLAUDE.md` status, tests README, spec 005's pending notes; spec statuses to `Done` once tasks 1 and 2 are verified.
  - Verify: docs match the implemented behavior.
  - Docs written. The spec statuses stay `Approved`: they become `Done` once the owner applies the migrations of tasks 1 and 2 and the pgTAP tests pass in CI.
- [x] **12. Rules for every screen**
  - Do: the owner's four rules (2026-10-21), written in `docs/design.md` (Modals, Forms, Loading, Plates) and `docs/conventions.md`, and applied everywhere: every action closes the modal (Servicios, Clientes, assigning, Vehículos and the chain); forms in two columns with `FormRow` and `FIELD_WIDTH`; one fixed plate size; `DataTable` `loading` on every search, sort and page in the three lists. Notes in specs 004 and 005.
  - Verify: component tests for each rule, the existing ones updated; `npm test`, `npm run lint`, `npm run build`.
- [ ] **13. Follow-up: Clientes search out of the URL** (separate change, remind the owner when task 11 is done)
  - Do: wrap the Clientes page in `ListSearchProvider`, ignore `buscar` on the server, update spec 005 and architecture.md.
  - Verify: Clientes tests updated; the URL never holds the search.
