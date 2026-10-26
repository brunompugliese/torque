# 009 — Home page (Inicio): Requirements

**Status:** Approved (by the owner in conversation, 2026-10-25)

## Problem

`/inicio` is empty. Staff need one screen with what matters right now: the agenda of the coming week and the jobs that are still open. Nothing new is built for it: it assembles the calendar of [spec 008](../008-appointments/requirements.md) and the jobs list of [spec 007](../007-jobs/requirements.md) with a narrower scope.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access: anyone in the shop sees and manages the same data as on Turnos and Trabajos.

## User stories

- As a staff member, I want to see the next 7 days of appointments as soon as I log in, so that I know what is coming.
- As a staff member, I want to book an appointment from that calendar, so that I don't have to leave the home page.
- As a staff member, I want to see the jobs that are still open, so that I know what is pending in the shop.
- As a staff member, I want to see recently closed jobs only when I ask for them, so that the list stays about open work.
- As a staff member, I want to open a job or an appointment and act on it from here, so that the home page is where I work, not just where I look.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (calendar, list pages, detail modal, modal to modal, modals, job statuses, appointment statuses, formats, accessibility). Where this spec and the docs ever disagree, the docs win. The criteria below are what this page adds or must specifically verify.

Page

- [ ] Given `/inicio`, when it loads, then it replaces the empty page and shows the title "Inicio", a one-line summary, and no buttons. "Nuevo turno" sits on the right of the "Turnos" heading and "Nuevo trabajo" on the right of the "Trabajos" heading.
- [ ] Given the summary, when it shows, then it reads "N turnos en los próximos 7 días, M trabajos abiertos." (singular and plural agree, e.g. "1 turno en los próximos 7 días, 0 trabajos abiertos."). N counts today and the next 6 days, Cancelado excluded; M counts active (not archived) jobs that are not Entregado or Cancelado. The summary does not follow the calendar when the week is moved.
- [ ] Given the page, when it renders, then the calendar section comes first and the jobs section below it, each with its own heading ("Turnos" and "Trabajos"), and nothing else.
- [ ] Given the page's data loads, when it renders, then the title, the section headings and both buttons show right away; the summary, the calendar and the table show the shared skeletons in their final sizes.
- [ ] Given `/` or a successful login, when the user is redirected, then they land on `/inicio` (already the case; unchanged).

Calendar (reuses spec 008)

- [ ] Given the calendar, when it shows, then it is the Turnos week view: today and the next 6 days, the title "dd/mm/aaaa al dd/mm/aaaa", "Hoy" (disabled when the week already starts today) and previous / next arrows that move 7 days. There is no "Mes / Semana" toggle and no month view.
- [ ] Given the week shown, when a day has appointments, then they look and behave exactly as on Turnos: status-styled cards, 5 per day then "+N más" with the same popover, the legend, cancelled appointments struck through and kept, archived ones not shown.
- [ ] Given an empty spot of a day or its "+" button, when clicked or activated, then "Nuevo turno" opens with that date, as on Turnos. Given "Nuevo turno" next to the "Turnos" heading, then it opens with today's date.
- [ ] Given an appointment, when it is clicked, then the full appointment modal opens with every action of Turnos (change status, edit, "Ver trabajo" / "Crear trabajo", the chain to the job modal and "Volver"). After a create or an edit the calendar moves to the appointment's date, as on Turnos.
- [ ] Given the week moved with the arrows, when the user reloads the page, then the page opens on today's week again (the week is not kept in the URL on this page).

Jobs table (reuses spec 007)

- [ ] Given the table, when it loads, then it is the Trabajos table with the same seven columns, sorting, pagination (25 per page), row click, status pill dropdown, loading, error and empty states, and the default order (last update, newest first).
- [ ] Given the table with no Estado selected, when it loads, then it lists every active job that is not Entregado or Cancelado, whatever its age.
- [ ] Given the toolbar, when it shows, then it has the search box (same placeholder and behavior as Trabajos, never in the URL) and the "Estado" filter. It has no "Fecha" filter and no "Mostrar archivados" switch; archived jobs are never listed in Inicio.
- [ ] Given the "Estado" dropdown, when opened, then it is the checklist of all seven job statuses in their order, including Entregado and Cancelado, each with its count.
- [ ] Given the "Estado" dropdown, when opened, then the Entregado and Cancelado options read "Entregado (últ. 30 días)" and "Cancelado (últ. 30 días)", so the window is visible where the choice is made; the five open statuses keep their plain names. A ticked one shows the same text as its chip. A screen reader hears the full text ("Entregado, últimos 30 días"). There is no other hint text on the page.
- [ ] Given Entregado and / or Cancelado ticked, when the list reloads, then it also lists jobs in those statuses last updated in the last 30 days (today and the 29 days before it, Argentina time, by the date of the last update, the same one the Trabajos "Actualizado" column shows). Closed jobs last updated earlier are never listed.
- [ ] Given open statuses ticked together with a closed one, when the list reloads, then it lists the ticked open statuses of any age plus the ticked closed ones from the last 30 days.
- [ ] Given the counts in the dropdown, when they show, then open statuses count all their active jobs, and Entregado and Cancelado count only those of the last 30 days; the counts follow the search and ignore the Estado selection itself, as on Trabajos.
- [ ] Given active filters, when they show, then each ticked status is a removable chip, as on Trabajos. The default (nothing ticked) shows no chip.
- [ ] Given a search or filters that match nothing, when "Limpiar búsqueda y filtros" is clicked, then the search and the Estado selection are cleared. Given no open jobs at all and nothing searched, when the table shows, then it says "No hay trabajos abiertos" · "Los trabajos pendientes o en curso aparecen acá." · "Nuevo trabajo".
- [ ] Given a row, when it is clicked, then the job modal opens with all its actions (status, edit, archive), as on Trabajos. This supersedes spec 007's "read only when opened from Inicio" criterion. A job changed or archived from here refreshes the table, the summary and the calendar's "Trabajo" detail.
- [ ] Given "Nuevo trabajo", when clicked, then the same job form of Trabajos opens, and a saved job refreshes the table.
- [ ] Given the Estado selection, sort and page, when they change, then they are kept in the URL (the Back button works), as on Trabajos; the search is not.

Rules for every screen

- [ ] Given the page and its modals, when used, then they meet design.md's accessibility rules, as on Turnos and Trabajos: keyboard-only operation with visible focus, focus trapped in modals and returned to what opened them, status never conveyed by color alone, announcements for range changes and toasts, and animations still with reduced motion.
- [ ] Given a narrow screen, when the page shows, then the calendar and the table keep working as on their own pages (nothing is cut off).

Reuse and standardization

- [ ] Given the page, when built, then no new visual component is created: it reuses `Calendar`, `AppointmentsCalendar`, `AppointmentsPanel`, `JobsListView`, `JobsToolbar`, `JobsTable`, `JobsPanel`, `PageHeader`, `NewAppointmentButton`, `NewJobButton` and the shared list kit. Where a piece needs a small option (a fixed view, no Fecha filter, no archived switch, a scope), the option is added to the existing piece, not copied.

Isolation and database

- [ ] Given two shops, when a user of one uses this page, then they never see or change the other shop's data (the same RLS as Turnos and Trabajos; covered again for the one database function that changes).
- [ ] Given the 30-day window, when applied, then it is computed on the server from today's date in Argentina, never taken from the URL or the request body, so it can't be widened by editing either.
- [ ] Given a job's plate, client or any personal data, when handled, then it is read through the same views as Trabajos and never logged or put in the URL.

## Out of scope

- A month view, or any other date control, on Inicio.
- The Fecha filter and the archived switch on Inicio.
- Statistics, charts, totals of money or any widget other than the calendar and the table.
- A "Ver todos" link to Turnos or Trabajos.
- Role-specific home pages.

## Docs to update when implemented

- [design.md](../../docs/design.md#calendar): Inicio's calendar is the week view without the toggle and its week is not kept in the URL.
- [design.md](../../docs/design.md#list-pages): Inicio's jobs table (open jobs, the 30-day window for closed ones, no Fecha filter or archived switch).
- [spec 007 requirements](../007-jobs/requirements.md): the job modal from Inicio has all its actions (the "read only" line is superseded).
- [architecture.md](../../docs/architecture.md): the changed `job_status_counts` function, if it is listed there.
- `db_schema.sql`, `supabase/tests/README.md`.

## Open questions

- None.
