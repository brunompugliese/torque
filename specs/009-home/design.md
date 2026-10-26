# 009 — Home page (Inicio): Design

**Status:** Approved (by the owner in conversation, 2026-10-25)
**Requirements:** [requirements.md](requirements.md)

## Summary

`/inicio` is two existing pieces on one page. The calendar is Turnos' week view without the view toggle; the table is Trabajos' table with a different scope. Both keep their own panel (and so their own modals), nested in the page. What changes is small and lives in the existing pieces as options:

- **`Calendar` / `AppointmentsCalendar`** get a fixed week view (no toggle) and an option to keep the week out of the URL.
- **The jobs list** gets a `home` scope: open jobs of any age, plus Entregado / Cancelado of the last 30 days when ticked; no Fecha filter, no archived switch. The scope is decided by separate Server Actions, so the browser never sends it.
- **One database function changes**: `job_status_counts` gets a bound for the closed statuses, so the Estado counts match the list.
- **The job modal** from this page has all its actions (supersedes spec 007's "read only from Inicio").

## Database

One function changes; no table, policy, view or trigger changes.

### `public.job_status_counts`

Today it takes `p_pattern`, `p_show_archived`, `p_from`, `p_to` (a window on `updated_at`) and returns the count per status. Inicio needs a window on `updated_at` that applies **only to Entregado and Cancelado**, while the other statuses count every active job, and archived jobs must never count (a search normally includes them). The function gains two parameters:

| Parameter | Value |
|---|---|
| `p_closed_from timestamptz default null` | When not null, jobs in `entregado` / `cancelado` count only if `updated_at >= p_closed_from`. Other statuses are unaffected. Null keeps today's behavior, so Trabajos is unchanged. |
| `p_enabled_only boolean default false` | When true, archived jobs never count, even with a search. False keeps today's behavior. |

A function's signature is part of its identity, so the migration drops the old signature and creates the new one (keeping `security invoker`, the same body plus the extra condition, and the same grants: `execute` to `authenticated`, nothing for `anon`). PostgREST would see two overloads otherwise.

- Migrations: `ddl-job-status-counts-closed-window` (drop and create) and `dcl-job-status-counts-closed-window` (grants), following the names used in [spec 007](../007-jobs/design.md). The final SQL is written from the existing function in `20261022000000_ddl-job-list.sql` when the task is done. The owner applies them to the hosted project.
- RLS impact: none. The function runs as the caller (`security invoker`), so the existing RLS on `job` still scopes every count to the caller's shop.
- `db_schema.sql` reflects the new signature.

## Frontend

### Route

```
src/app/(app)/inicio/
  page.tsx      # requireSession, parse the list params, summary + calendar + table in Suspense
  loading.tsx   # whole-page skeleton (the skeletons of Turnos' calendar and Trabajos' table)
```

`page.tsx` follows `turnos/page.tsx` and `trabajos/page.tsx`: `requireSession()`, `PageHeader` (title "Inicio", `HomeSummary` in `<Suspense>`, no actions), then two sections inside `ListSearchProvider > JobsPanel > AppointmentsPanel`:

1. **Turnos:** `AppointmentsCalendarSection` with the fixed week state (`view: "week"`, `anchor: today`), in `<Suspense fallback={<CalendarSkeleton />}>`.
2. **Trabajos:** `HomeJobsList` in `<Suspense fallback={<><ListToolbarSkeleton /><JobsTableSkeleton /></>}>`.

Each section has a heading row: its `h2` ("Turnos", "Trabajos") on the left and its button on the right (`NewAppointmentButton`, `NewJobButton`).

The two panels are siblings of the same page, nested (`AppointmentsPanel` inside `JobsPanel`), each hosting its own lazily loaded modal as on its own page. The appointment modal already hosts the job modal for its "Ver trabajo" step; the job table opens the standalone job modal. Both are existing code paths. A job changed in either place triggers the revalidation described below.

### The calendar

`AppointmentsCalendar` takes an optional `fixedView?: CalendarView` and `syncUrl?: boolean` (default true):

- `fixedView: "week"`: the initial state is `{ view: "week", anchor: today }`, `onViewChange` is never called, and the toggle is not drawn.
- `syncUrl: false`: skips the `history.replaceState` effect. This matters here: the calendar writes the whole query string (`window.location.pathname + its own params`), which would erase the jobs list's `estado`, `orden` and `pagina` params, and `useListUrl` writes its own params without the calendar's. Keeping the week out of the URL means exactly one writer owns the query string on this page. On reload the week returns to today, which the requirements accept.

`Calendar` (shared) gains `views?: readonly CalendarView[]` (default both). With one view, the "Mes / Semana" group is not rendered; "Hoy", the arrows, the title and the announcements stay. The week view, popover, "+" buttons, legend and click-to-create are unchanged. Its tests gain a case for the single-view header.

The summary's "next 7 days" and the calendar's initial week use the same `todayIsoDate()`; the summary does not follow the arrows (stated in the requirements).

### The jobs table

`JobsListView`, `JobsToolbar` and `JobsTable` keep working as they do for Trabajos and gain a `scope: "all" | "home"` prop (default `"all"`), threaded from the page:

| Piece | `scope: "home"` |
|---|---|
| `JobsListView` | calls `searchHomeJobs` instead of `searchJobs`; passes `total` = the open-jobs count to the table |
| `JobsToolbar` | labels the Entregado and Cancelado options and chips with `home.jobs.closedLabel` (the label passed to `ChecklistOption` and `FilterChip`, with the full text as accessible name); hides the Fecha `FilterPopover` and the date chip; passes no archived handler so `ListToolbar` hides the switch (`ListToolbar` already renders the switch only when a handler is given, or gains that small option if it doesn't); the Estado counts call `getHomeStatusCounts` |
| `JobsTable` | the empty state for "no jobs and nothing searched" uses the home copy (`home.jobs.empty.*`) |

`JOB_FILTER_KEYS` stays as is; on Inicio only `estado` is read. `parseJobFilters` ignores `desde` / `hasta` in the home scope (a hand-typed `?desde=` can't widen anything), and the stale-URL cleanup in the toolbar drops them.

### Server side

`features/job/queries.ts` gains an optional scope in `listJobs` / `getJobStatusCounts`; `features/job/actions.ts` gains the two entry points the browser calls:

- `searchHomeJobs(listSearch)`: parses the list params like `searchJobs`, then calls `listJobs(params, "home")`.
- `getHomeStatusCounts(listSearch)`: same for the counts.
- `getHomeOpenJobCount()` (over `getOpenJobCount` in `queries.ts`): the number of open, active jobs (a head count, for the summary and the empty state).

The scope is not a parameter of the request; it is which action ran. `queries.ts` derives everything else.

**Home scope rules** (`features/job/home.ts`, pure and tested):

- `HOME_CLOSED_STATUSES = ["entregado", "cancelado"]`; `HOME_OPEN_STATUSES` = the other five (from `lib/status`; no new status list).
- `homeClosedFrom(today)`: the start of the day `today - 29` in Argentina time (`argentinaDayStart(addDays(today, -29))`, both helpers exist), i.e. the 30 days ending today, today included.
- `homeStatusFilter(selected, closedFrom)` → how the list query is shaped:
  - nothing selected → `status in OPEN`, any age;
  - only open ticked → `status in selected`, any age;
  - only closed ticked → `status in selected and updated_at >= closedFrom`;
  - both → one `.or()`: `status.in.(open ticked),and(status.in.(closed ticked),updated_at.gte.<closedFrom>)`.
- Always `enabled = true` (`showArchived` is forced to `false` in the home scope, whatever the URL says).

The existing search, sort and pagination (`applyListQuery`) apply on top, unchanged. Counts call `job_status_counts` with `p_show_archived: false`, no `p_from` / `p_to`, `p_closed_from = homeClosedFrom(today)` and `p_enabled_only: true`. The list query adds `enabled = true` explicitly (a search would otherwise bring archived rows back).

**Revalidation:** `saveJob` / status / archive actions already revalidate `/trabajos` and `/turnos`; they also revalidate `/inicio`. The appointment actions already revalidate `/turnos` and add `/inicio`. (The list refresh after an action inside the page is the existing client refresh of each list.)

**Summary** (`HomeSummary`, a Server Component like `JobsSummary`): `getOpenJobCount()` and `getAppointmentCountInRange(today, today + 6)` (a head count on `appointment`, `enabled`, `date` between, `status <> 'cancelado'`; added to `features/appointment/queries.ts`). If either fails the summary is omitted, as the other pages do.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `PageHeader`, `TextSkeleton`, `ListSearchProvider`, `ListToolbarSkeleton`, `CalendarSkeleton`, `JobsTableSkeleton`, `NewAppointmentButton`, `NewJobButton`, `AppointmentsPanel`, `JobsPanel`, `AppointmentsCalendarSection`, the appointment and job modals | existing | Reused |
| `Calendar` | `components/shared/calendar.tsx` | Extended (`views`) |
| `AppointmentsCalendar` | `features/appointment/components/` | Extended (`fixedView`, `syncUrl`) |
| `JobsListView`, `JobsToolbar`, `JobsTable` | `features/job/components/` | Extended (`scope`) |
| `listJobs`, `getJobStatusCounts` | `features/job/queries.ts` | Extended (scope) |
| `searchHomeJobs`, `getHomeStatusCounts`, `getHomeOpenJobCount` (actions), `getOpenJobCount` (query) | `features/job/` | New (thin) |
| Home scope rules | `features/job/home.ts` | New |
| `getAppointmentCountInRange` | `features/appointment/queries.ts` | New (thin) |
| `HomeSummary` (`app/(app)/inicio/_components/`), `HomeJobsList` (`features/job/components/jobs-sections.tsx`) | - | New (thin server wrappers, like `JobsList`) |
| `inicio/page.tsx` + `loading.tsx` | `app/(app)/inicio/` | Replaced / new |
| `job_status_counts` | migrations, `db_schema.sql` | Changed (new parameter) |
| `saveJob` and appointment actions | `features/*/actions.ts` | Extended (also revalidate `/inicio`) |

## Validation

None new: the search and filters go through the existing `parseListParams` / `parseJobFilters`; the scope is never an input. The one extra rule is that the home scope ignores `desde`, `hasta` and `archivados` from the URL.

## UI text

`messages/es.json`: a `home` namespace.

- `home.title` "Inicio"; `home.summary` "{appointments, plural, one {# turno} other {# turnos}} en los próximos 7 días, {jobs, plural, one {# trabajo abierto} other {# trabajos abiertos}}."
- `home.appointments.title` "Turnos"; `home.jobs.title` "Trabajos".
- `home.jobs.closedLabel` "{status} (últ. 30 días)" (visible text of the Entregado and Cancelado options and chips, home scope only); `home.jobs.closedLabelFull` "{status}, últimos 30 días" (the accessible name).
- `home.jobs.empty.title` "No hay trabajos abiertos"; `.description` "Los trabajos pendientes o en curso aparecen acá."; the action reuses "Nuevo trabajo".
- `nav.home` already exists. Everything else (calendar, table, filters, modals) reuses the `appointments.*` and `jobs.*` keys.

## Tests

- **pgTAP** (`supabase/tests/09_jobs.sql`, extended): `job_status_counts` with `p_closed_from` null behaves as before (no regression); with it set, `entregado` / `cancelado` jobs last updated before the bound are not counted while open statuses of any age are; archived jobs follow `p_show_archived`; another shop's jobs are never counted; `anon` and a disabled profile get nothing.
- **Vitest, rules:** `features/job/home.ts` (`homeClosedFrom` around Argentina midnight and month ends; `homeStatusFilter` for none / only open / only closed / both selected).
- **Vitest, server:** queries (home scope forces `enabled`, builds the `.or()` for the four cases, ignores `desde` / `hasta` / `archivados`, calls the counts function with `p_closed_from`), actions (`searchHomeJobs`, `getHomeStatusCounts`, `getHomeOpenJobCount`; the scope can't be set by the input), `getAppointmentCountInRange` (excludes cancelled and archived), revalidation of `/inicio`.
- **Vitest, components:** `Calendar` with one view (no toggle, "Hoy" and arrows work); `AppointmentsCalendar` with `fixedView` / `syncUrl: false` (no URL write, no toggle, week arrows); `JobsToolbar` home scope (no Fecha, no archived switch, all seven statuses in the dropdown, counts from the home action); `JobsTable` home empty state; the page composition (summary text with singular / plural, headings, the "(últ. 30 días)" labels on the two closed options and their chips, both buttons, "Nuevo turno" from a day and from the header).
- **Accessibility:** headings order (h1, then the two h2), button names, the single-view calendar's announcements.
- The existing Turnos and Trabajos tests keep passing unchanged (the options default to today's behavior).

## Risks and alternatives

- **Two writers on one query string.** The calendar and `useListUrl` both replace the whole query. Alternative: make both merge into the current query; rejected as a bigger change to two shared pieces for a small gain (the week is cheap to lose on reload). `syncUrl: false` keeps each piece untouched on its own page.
- **Changing a deployed database function.** Alternative: a new function `home_job_status_counts` next to the old one; rejected because it duplicates the body, but it is the fallback if replacing the signature proves awkward to apply.
- **The 30-day window by last update** means a closed job leaves the ticked list 30 days after its last change, whatever its age (a job created 40 days ago and delivered yesterday does appear). Any later edit of a closed job (for instance archiving or unarchiving) refreshes `updated_at` and brings it back. The Trabajos page has the full history.
- **Two modals on one page** (appointment and job) are separate hosts. This is already how each page works; opening one closes the other's chain first because only one modal is open at a time.
- **Counting "open" jobs in two places** (summary and empty state) uses one query (`getOpenJobCount`, cached per request).
