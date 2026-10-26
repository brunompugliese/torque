# 009 — Home page (Inicio): Tasks

**Status:** Approved (by the owner in conversation, 2026-10-25)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Database: closed-window counts**
  - Do: migrations `ddl-job-status-counts-closed-window` and `dcl-job-status-counts-closed-window` (drop the old signature, create it with `p_closed_from`, same grants); update `db_schema.sql`. The owner applies them to the hosted project.
  - Verify: extended pgTAP in `supabase/tests/09_jobs.sql` passes in CI; Trabajos' counts are unchanged (null bound).
- [x] **2. Home scope rules**
  - Do: `features/job/home.ts` (`HOME_CLOSED_STATUSES`, `HOME_OPEN_STATUSES`, `homeClosedFrom`, `homeStatusFilter`).
  - Verify: Vitest for the window around Argentina midnight and month ends, and the four selection cases.
- [x] **3. Home queries and actions**
  - Do: scope option in `listJobs` / `getJobStatusCounts`; `getHomeOpenJobCount`; `searchHomeJobs`, `getHomeStatusCounts`; `getAppointmentCountInRange`; revalidate `/inicio` in the job and appointment actions.
  - Verify: Vitest with mocked Supabase (enabled forced, `.or()` shapes, `desde` / `hasta` / `archivados` ignored, counts called with `p_closed_from`, cancelled excluded from the appointment count); Trabajos' tests unchanged.
- [x] **4. Calendar options**
  - Do: `views` in `Calendar`; `fixedView` and `syncUrl` in `AppointmentsCalendar`.
  - Verify: Vitest for the single-view header, no URL write and week arrows; Turnos' tests unchanged.
- [x] **5. Jobs table scope**
  - Do: `scope` in `JobsListView`, `JobsToolbar` (no Fecha, no archived switch, home counts) and `JobsTable` (home empty state); home messages.
  - Verify: Vitest for the home toolbar, the seven-status dropdown, the empty state; Trabajos' tests unchanged.
- [x] **6. Inicio page**
  - Do: `inicio/page.tsx`, `loading.tsx`, `HomeSummary`, `HomeJobsList`; nest `ListSearchProvider`, `JobsPanel` and `AppointmentsPanel`; add the `home` messages.
  - Verify: Vitest for the composition (summary with singular and plural, headings, both buttons, create from a day and from the header); `npm run lint`, `npm test`, `npm run build` pass; manual check in `npm run dev`: week arrows, appointment modal chain to a job, job modal actions, Estado ticks for Entregado / Cancelado, search, sort, page, narrow screen.
- [x] **7. Docs**
  - Do: update `docs/design.md` (calendar, list pages), spec 007's Inicio line, `docs/architecture.md` if it lists the function, `supabase/tests/README.md`, `CLAUDE.md` status line, and set the spec statuses.
  - Verify: docs match the implemented behavior.
