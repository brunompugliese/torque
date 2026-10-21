# 005 — Clients page: Tasks

**Status:** Approved
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [ ] **1. Database: client and vehicle view columns**
  - Do: migration `ddl-client-search` (`client_decrypted`: `name_key`, `dni_number`, `phone_key`, `email_key`; `vehicle_decrypted`: `brand_name`, `model_name`); `db_schema.sql`; `supabase/tests/07_clients.sql`; tests README.
  - Verify: `npx supabase test db` passes (CI, or locally with Docker).
  - Written; migration applied to the hosted project by the owner. The pgTAP tests have not run yet (Docker isn't running locally): pending the CI run on the PR.
- [x] **2. Shared helpers**
  - Do: `lib/format/plate.ts`, `lib/format/dni.ts`, `lib/format/whatsapp.ts`, `lib/list/memory.ts`; `phoneField`, `dniField`, `optionalEmailField` and their error keys in `lib/validation/fields.ts`; `nullsFirst: false` in `lib/list/query.ts`; `hooks/use-loaded-data.ts`.
  - Verify: Vitest tests for each (existing `applyListQuery`, `fields` and services tests still pass).
- [x] **3. Shared components and tokens**
  - Do: shadcn `checkbox`; `SearchBox` extracted from `ListToolbar`; `PlateDisplay`; `WhatsappButton`; `--whatsapp`, `--plate` and `--plate-foreground` tokens in `globals.css` (a plate is white with black characters in any theme); contrast tests in `theme-tokens.test.ts`.
  - Verify: Vitest tests for each component, `list-toolbar.test.tsx` and `theme-tokens.test.ts` pass.
- [x] **4. Client data layer**
  - Do: `features/client/schemas.ts`, `queries.ts`, `actions.ts`; `clients` messages and `validation` keys.
  - Verify: schema, query and action tests (server validation, create/update read-back, DNI taken active/archived/self, archive/unarchive, unexpected errors).
- [x] **5. Vehicle data layer**
  - Do: `features/vehicle/schemas.ts`, `queries.ts`, `actions.ts` (`getClientVehicles`, `getUnassignedVehicles`, `assignVehiclesToClient`).
  - Verify: schema, query and action tests (all / partial / none assigned, archived client, invalid ids).
- [x] **6. Clients page: list**
  - Do: `app/(app)/clientes/page.tsx` + `loading.tsx`; `ClientsPanel`, `ClientsTable` (+ skeleton), sections (list, summary), `AddClientButton`.
  - Verify: component tests (columns and "—", sort headers, search, archived switch, list states, row opens the modal); `npm test`, `npm run lint`, `npm run build`.
- [x] **7. Client modal, form and archive**
  - Do: `ClientModal` (view with WhatsApp button, edit, create), `ClientForm`, archive/unarchive confirmation, toasts.
  - Verify: component tests (create/edit/no-change flows, field errors with focus, DNI messages, archive/unarchive, toasts).
- [x] **8. Vehicles in the client modal**
  - Do: `VehicleRow`, `ClientVehicles` (loading, empty, error, rows), `AddVehicleChoice`, `AssignVehicles` (search, paging by 5, checkboxes, selection kept, partial-assign message), "Volver" at each step.
  - Verify: component tests for every state and flow, including no requests while searching and paging.
- [x] **9. Docs**
  - Do: `docs/architecture.md` (view columns, in-memory lists, shared pieces, structure), `docs/conventions.md` (plate and WhatsApp tokens, which it owns), `CLAUDE.md` status; spec statuses to `Done` once task 1 is verified.
  - Verify: docs match the implemented behavior.
