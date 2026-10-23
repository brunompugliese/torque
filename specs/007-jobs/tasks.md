# 007 — Jobs page: Tasks

**Status:** Approved (by the owner in conversation, 2026-10-22)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Database: `job_list` view and `job_status_counts`**
  - Written; pending the owner applying the migrations and the CI run (Docker isn't running locally). The `EXPLAIN` check is still to do (needs a database with the migration).
  - Do: migrations `ddl-job-list` (view with the vehicle, client and appointment columns, `search_text`, `vehicle_key`, `client_name_key`, `status_order`, `total_amount`; function `job_status_counts`) and `dcl-job-list` (grants); check with `EXPLAIN` that unselected columns aren't computed (else a lighter view); `db_schema.sql`; the view and counts cases of `supabase/tests/09_jobs.sql`.
  - Verify: `npx supabase test db` (CI, or locally with Docker).
- [x] **2. Database: `save_job`**
  - Written; pending the owner applying the migrations and the CI run.
  - Do: migration `ddl-save-job` (new client, new services, item diff with `clock_timestamp()` order, quoted price kept for existing items in the work phase, job update last, direct-close path); migration `dcl-save-job` (execute grants); `db_schema.sql`; the function cases of `09_jobs.sql`; tests README.
  - Verify: pgTAP passes (create, update, diff, close order, rollbacks and each error, cross-shop, `anon`, disabled profile).
- [x] **3. Shared helpers**
  - Do: `ListParams.filters` with `parseListParams` / `toListSearch`; `useListUrl` `setFilters`, `clearFilters`, `clearAll`; `applyListQuery` `defaultDirection`; `argentinaDayStart`, `argentinaNextDayStart`, `formatDateTime`; `moneyField`, `kilometersField`; `jobPhase`, `isClosedStatus`; `calculateTotals`, `fillFinalPrices`.
  - Verify: Vitest tests for each (existing list, URL and date tests still pass).
- [x] **4. Shared components**
  - Done without the `ListUrlToolbar` slot: the jobs toolbar composes `ListToolbar` (which already has a `filters` slot) with `useListUrl(JOB_FILTER_KEYS)` in task 6. Also built: `formatMoneyInput`; shadcn `popover` (`checkbox` already existed).
  - Do: `FilterPopover`, `ChecklistFilter`, `DateRangeFilter`, `FilterChips`; `StatusTimeline`; `MoneyInput`; `ClosingWarning`; shadcn `popover` and `checkbox` through the CLI if missing.
  - Verify: Vitest tests for each, including keyboard, accessible names and the date-range error.
- [x] **5. Job data layer**
  - Do: extend `features/job/` schemas (`jobFormSchema`, `jobListRowSchema`, detail and history rows, list constants), queries (`listJobs`, counts, `getJobRow`, `getJobDetail`, status counts, `getKmFloor`, `getVehicleOwner`, option queries) and actions (`searchJobs`, `createJob`, `updateJob`, `setJobArchived`, read actions); `searchClientOptions` gains `onlyActive` and `currentId`; validation keys.
  - Verify: schema, query and action tests (server validation, phase normalization, new-service name taken active/archived, rpc call and read-back, each database error mapped, archive/unarchive, unexpected errors).
- [x] **6. Jobs page: list**
  - Do: `app/(app)/trabajos/page.tsx` + `loading.tsx`; `JobsPanel`, `JobsTable` (+ skeleton), sections, `NewJobButton`, the toolbar with the Estado and Fecha filters and chips; `jobs` messages for the list.
  - Verify: component tests (columns, "—" and "Sin cliente", default order with no header marked, sorting, filters and chips, search not in the URL, archived switch, list states, "Limpiar búsqueda y filtros"); `npm test`, `npm run lint`, `npm run build`.
- [x] **7. Job modal: view and archive**
  - Do: `useJobModal` (view with details, `JobServices`, `JobStatusHistory`, archive/unarchive, `readOnly`, loading by `jobId`); toasts.
  - Verify: component tests (header and subtitle, closed lock and hidden "Editar trabajo", services table per phase, timeline, skeletons and errors, archive flows, `readOnly`).
- [x] **8. Job form and services editor**
  - Also built: `NewClientSection` moved to `features/client/components/` and made generic (the vehicle and job forms use it); `SearchableSelect` options can have an `inputLabel`; `FIELD_WIDTH` gained `quantity`, `money` and `kilometers`; `DetailModal` scrolls inside the viewport; shadcn `select`.
  - Do: `JobForm` (vehicle, client with quick create, Pendiente default, status with closing warning and confirmation, km floor and hint, appointment, observations), `ServicesEditor` (phases, read-only quoted price, new service, totals, add/remove); create and edit; no-change edit.
  - Verify: component tests (vehicle change resets client / km / appointment, status switches fill and clear final prices, editor rows and errors with focus, closing confirmation, toasts, a job closed meanwhile).
- [x] **9. Vehicle history integration**
  - Do: `VehicleJobRow` clickable with an arrow; `useVehicleModal` and `ClientModal` gain `job-view` / `job-edit` with "Volver" at each level; the chain closes after any action; update spec 006's tests that said "not clickable".
  - Verify: component tests ("Volver", the X closes the chain, action closes the chain, focus returns to the row); `npm test`.
- [x] **10. Docs**
  - Docs written (`architecture.md`, `conventions.md`, `design.md`, `CLAUDE.md`, tests README, `db_schema.sql`). The spec statuses stay `Approved`: they become `Done` once the owner applies the migrations of tasks 1 and 2 and the pgTAP tests pass in CI; the `EXPLAIN` check of task 1 is also pending.
  - Do: `docs/architecture.md` (view, functions, list filters, new shared pieces, structure), `docs/conventions.md` (filters, money input), `docs/design.md` if a shared pattern changed (filters, timeline), `CLAUDE.md` status, tests README; spec statuses to `Done` once tasks 1 and 2 are verified.
  - Verify: docs match the implemented behavior.
