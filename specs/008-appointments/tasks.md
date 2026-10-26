# 008 — Appointments page (Turnos): Tasks

**Status:** Approved (pre-approved by the owner in conversation, 2026-10-25)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Database: `appointment_list`**
  - Do: migrations `ddl-appointment-list` (view) and `dcl-appointment-list` (grants); `db_schema.sql`; `supabase/tests/10_appointments.sql`; tests README.
  - Written; pending the owner applying the migrations and the CI run (Docker isn't running locally, so the pgTAP file was reviewed, not run).
  - Verify: pgTAP (CI).
- [x] **2. Shared helpers**
  - Do: `lib/calendar.ts`, `lib/format/time.ts`, appointment statuses in `lib/status.ts`, `AppointmentStatusBadge`, validation keys.
  - Verify: Vitest tests for each; existing status tests still pass.
- [x] **3. Shared components**
  - Do: `Calendar` (+ `CalendarSkeleton`).
  - Verify: Vitest tests (views, popover, creation, keyboard, announcements).
- [x] **4. Shared vehicle dropdown**
  - Do: move `searchVehicleOptions` / `listVehicleOptions` to `features/vehicle`, extract `VehicleSelect`, use it in the job form.
  - Verify: job and vehicle tests pass; `VehicleSelect` tests.
- [x] **5. Appointment data layer**
  - Do: `features/appointment/` schemas, calendar params, queries, actions (create, update, status, job from appointment), format and form helpers; `saveJob` revalidates `/turnos`.
  - Verify: schema, params, query and action tests.
- [x] **6. Turnos page: calendar**
  - Do: `turnos/page.tsx` + `loading.tsx`, `AppointmentsPanel`, `AppointmentsCalendar`, `AppointmentCard`, summary, `NewAppointmentButton`, messages for the page.
  - Verify: component tests (cards per status, ranges, URL state, loading and error states, day popover); `npm test`, lint, build.
- [x] **7. Appointment modal: view and status pill**
  - Do: `useAppointmentModal` (view), `AppointmentStatusControl` (the pill as a dropdown), `AppointmentJob`, the job modal as a step.
  - Verify: component tests (details, empty values, any status from the pill, cancel confirmation, job button states, the job step and the "+N más" list reopening).
- [x] **8. Appointment form**
  - Do: `AppointmentForm` for create and edit, the calendar moving to the saved date.
  - Verify: component tests (fields, owner as client, errors with focus, no-change edit, toasts, archived vehicle).
- [x] **9. Docs**
  - Do: `docs/design.md` (quick create exception, appointments not archived, client follows the vehicle), `docs/architecture.md` (view, calendar, structure), `docs/conventions.md` (appointment statuses), `CLAUDE.md` status; tests README.
  - Docs written. The spec statuses stay `Approved`: they become `Done` once the owner applies the migrations of task 1 and the pgTAP tests pass in CI.
  - Verify: docs match the implemented behavior.
