# 008 — Appointments page (Turnos): Design

**Status:** Approved (pre-approved by the owner in conversation, 2026-10-25)
**Requirements:** [requirements.md](requirements.md)

## Summary

`/turnos` is the first page that is a calendar, not a list. It follows the shape of `/trabajos` ([spec 007](../007-jobs/design.md)): a Server Component that reads the URL and renders the first range, a client panel that owns the modals, writes as Server Actions, and one modal built as a hook that other hosts can reuse. What is new:

- **A shared calendar** (`components/shared/calendar.tsx`): month and week views, "+N más" popover, day "+" buttons. Generic: it knows nothing about appointments; Inicio reuses it.
- **A read view, `appointment_list`**, with the vehicle, client and linked job of each appointment, computed in the view and never stored.
- **The appointment modal** (view, edit, create) with a status dropdown, "Ver trabajo" / "Crear trabajo" and the job modal as one more step of the chain.
- **Appointment statuses** in `lib/status.ts` and `StatusBadge`.
- **The vehicle dropdown** of the job form, extracted and shared.
- **Writes are plain Data API calls** (one table, no quick create), so no database function is needed.

## Database

Two migrations (`ddl-appointment-list`, `dcl-appointment-list`). No table, policy or trigger changes.

### `public.appointment_list`

A `security_invoker` view (`appointment_decrypted` stays the light read of one appointment's own columns).

| Column | Value | Used by |
|---|---|---|
| `id, shop_id, vehicle_id, client_id, date, time, status, enabled, created_at, updated_at` | from `appointment` | calendar, modal |
| `reason` | `private.decrypt_text(a.reason)` | modal, form |
| `plate`, `vehicle_year`, `brand_name`, `model_name`, `vehicle_enabled` | the vehicle, decrypted | card, popover, modal |
| `client_name`, `client_surname`, `client_phone_number`, `client_enabled` | the stored client, decrypted (null without one) | modal |
| `job_id` | the latest non-archived job with `appointment_id = a.id` (lateral, `created_at desc, id desc limit 1`), null without one | "Ver trabajo" / "Crear trabajo" |

Joins use the composite keys (`v.id = a.vehicle_id and v.shop_id = a.shop_id`), and decryption happens in `lateral` subqueries so a column is computed only when selected. There is no `search_text` (the page has no search). Grants: `select` to `authenticated`, nothing for `anon`, no writes.

`db_schema.sql` reflects it. pgTAP: `supabase/tests/10_appointments.sql` (see Tests).

## Frontend

### Route

```
src/app/(app)/turnos/
  page.tsx      # requireSession, parse ?vista=&fecha=, summary and calendar in Suspense
  loading.tsx   # whole-page skeleton
```

`PageHeader` (title, summary in `<Suspense>`, `NewAppointmentButton`), then `AppointmentsCalendarSection` (server) which reads the visible range with `listAppointments` and renders the client `AppointmentsCalendar` with that first result. The summary is "N turnos en total." (head count on `appointment`, enabled only).

### Calendar state in the URL

`?vista=semana&fecha=2026-10-12`: `vista` is absent for the month (default) and `semana` for the week; `fecha` is the anchor day (`yyyy-mm-dd`), absent when it is today's. Parsed by `features/appointment/calendar-params.ts` (invalid values fall back to the defaults) and written with `history.replaceState` by the panel, like `useListUrl`. Nothing sensitive is in it.

| View | Anchor | Visible days | Title | Arrows / "Hoy" |
|---|---|---|---|---|
| Month | any day of the month (stored as its first day) | the month's weeks, Monday to Sunday (the greyed days included) | "01/10/2026 al 31/10/2026" (the month itself) | ±1 month / current month |
| Week | the first day | anchor and the next 6 days | "12/10/2026 al 18/10/2026" | ±7 days / anchor = today |

"Hoy" is disabled when the view already holds today as its anchor (week) or its month (month). The weekday labels over the month grid are column headers, not dates.

### Shared pieces

`lib/calendar.ts` (pure, tested; dates are `yyyy-mm-dd` strings, no `Date` in the browser's time zone):

- `todayIsoDate()` (Argentina), `addDays`, `addMonths`, `monthStart`, `monthGrid(monthStart)` (weeks of 7 days with `inMonth`), `weekDays(start)`, `visibleRange(view, anchor)` → `{ from, to }` (the days the data must cover), `periodTitleRange`, `weekdayIndex`.

`components/shared/calendar.tsx`:

- `Calendar<Item extends CalendarItem>` where `CalendarItem = { id: string; date: string; sortKey: string }`. Props: `view`, `anchor`, `items`, `loading`, `onViewChange`, `onAnchorChange`, `renderItem(item)` (the one-line chip, a button the caller styles), `renderPopoverItem(item)`, `onItemOpen`, `onCreate(date)`, `openDay` / `onOpenDayChange` (the "+N más" popover, controlled so the host can reopen it after "Volver"), `labels` (all text from the caller's `next-intl`), `legend` (a node).
- Header: title, "Mes / Semana" toggle (a two-button group with `aria-pressed`), "Hoy", previous / next. A polite live region announces the new range.
- Month: Monday-first grid; other-month days greyed; today with a dark circle; at most 3 items per day then "+N más" (a popover button, Base UI Popover via shadcn) titled with the day's dd/mm/aaaa date; the popover lists all the day's items, closes with X, Esc, outside click or scroll; focus returns to "+N más". Week: seven day columns with all their items.
- Day creation: clicking an empty part of a day, or its "+" button (visible on hover or focus, accessible name "Nuevo turno el dd/mm/aaaa"), calls `onCreate(date)`.
- `CalendarSkeleton`: the same grid with `Skeleton` blocks, `aria-busy` through `LoadingRegion`.

Date and time are native fields: a date `Input` like `DateRangeFilter`'s and a time `Input` with no step (any hour and minute). `lib/format/time.ts`: `isTime`, `normalizeTime`.

`lib/status.ts` gains `APPOINTMENT_STATUSES`, `AppointmentStatus`, `isAppointmentStatus`, `appointmentStatusFamily` (`pendiente → pending`, `confirmado → done`, `completado → done`, `cancelado → cancelled`). `status-badge.tsx` gains `AppointmentStatusBadge`, and `status-select.tsx` becomes generic (`StatusPillSelect`) with `StatusSelect` (jobs) and `AppointmentStatusSelect` (the pill as a dropdown of the four statuses). `status.appointment.*` messages. No new color tokens: the cards use the existing `--status-*` tokens.

`features/vehicle/components/vehicle-select.tsx` is the job form's Vehículo dropdown extracted (remote `SearchableSelect` with `useRemoteOptions`); `searchVehicleOptions` and `listVehicleOptions` move from `features/job` to `features/vehicle` (`actions.ts` / `queries.ts`), and the job form uses the shared component. Job tests that mocked them follow.

### Appointment domain

`features/appointment/`:

| File | What |
|---|---|
| `schemas.ts` | `APPOINTMENT_LIST_COLUMNS`, `appointmentListRowSchema` (→ `{ id, date, time, status, reason, createdAt, vehicle, client, jobId }`), `appointmentFormSchema` (`vehicleId`, `date`, `time`, `status`, `reason`), `toAppointmentFieldErrors` |
| `calendar-params.ts` | parse / serialize `?vista=&fecha=` |
| `queries.ts` | `listAppointments(from, to)` (cached with primitives), `getAppointmentCounts()`, `getAppointmentListRow(id)` |
| `actions.ts` | `searchAppointments(from, to)`, `createAppointment`, `updateAppointment`, `setAppointmentStatus`, `createJobFromAppointment` |
| `format.ts` | `formatAppointmentLabel` ("Fiat Cronos, 14/10/2026 a las 09:00 hs"), `formatAppointmentWhen` ("14/10/2026 · 09:00 hs"), `formatAppointmentVehicle` |
| `form.ts` | `emptyAppointmentForm(date)`, `appointmentToFormState`, `isAppointmentUnchanged`, `appointmentClientId` |

**Reads.** `listAppointments` reads `appointment_list` with `date >= from and date <= to and enabled`, ordered by date, time, `created_at`. The page's first render and every range change use it (the change through `searchAppointments`, a Server Action whose arguments are validated dates, capped at 62 days).

**Writes** (all behind `requireSession()`, validated by `appointmentFormSchema`, which the form uses too):

- `createAppointment(input)`: owner of the vehicle through `getVehicleOwner` (reused from `features/job/queries`); `insert` into `appointment` with `shop_id` from the session, `client_id` = the owner (even archived: the database only checks the vehicle), `status` pendiente; read back through `appointment_list`.
- `updateAppointment(id, input)`: loads the stored row; `client_id` stays when the vehicle is unchanged and follows the new vehicle's owner when it changes; `update`; read back.
- `setAppointmentStatus(id, status)`: `update status`; read back.
- `createJobFromAppointment(id)`: loads the row (`appointment_list` plus `getKmFloor(vehicleId)`); refuses a cancelled appointment (`cancelled`); builds `{ vehicleId, status: "pendiente", kilometers: floor, appointmentId: id, observations: reason, items: [] }` and calls the existing `createJob`, whose server rules (owner as client, archived owner dropped, km floor) apply. Returns the job's list row.
- Errors: `invalid`, `vehicleArchived` (`23514` / `vehicle_archived`), `notFound`, `cancelled`, `unexpected`. Foreign key violations (`23503`) are `invalid`. Codes only are logged.
- Revalidation: `/turnos` on every write. `saveJob` in `features/job/actions.ts` also revalidates `/turnos` (a job's creation or archiving changes an appointment's "Trabajo").

### Panel and modal

`AppointmentsCalendar` (client) holds `{ view, anchor }` (initialised from the URL), loads the visible range with `useListResults` (the server result as the first value, `searchAppointments` when the range changes, the skeleton while it loads, `ListError` with "Reintentar"), and renders `Calendar` with `AppointmentCard`s. `AppointmentsPanel` wraps it with the context `useAppointmentsPanel()` (`openAppointment(row, fromDay?)`, `openCreate(date?)`) used by the cards and `NewAppointmentButton`, and hosts the lazily loaded `AppointmentModal`, like `JobsPanel`.

`AppointmentCard`: the chip (time in bold + brand and model, cut with "…" when it doesn't fit), styled by status (a white card with a 4px left edge in `bg-status-*-dot` for Pendiente; a solid border with diagonal lines, the `hatch-done` utility of `globals.css`, for Confirmado; filled with the `done` / `cancelled` fill, border and text and the edge for Completado and Cancelado; Cancelado struck through), `aria-label` "09:00, Fiat Cronos, Confirmado". `AppointmentLegend` draws each status as a square that matches its card.

`useAppointmentModal({ mode, appointment, createDate, jobId, onModeChange, onClose, onSaved })` returns `DetailModal` content like `useJobModal`:

- **view:** title `formatAppointmentWhen`; badge `AppointmentStatusControl` (the status pill as a dropdown of the four statuses, like `JobStatusControl`); `DetailList` two columns: Cliente (shared pieces), Vehículo (`PlateDisplay` + `formatAppointmentVehicle`), Motivo, Trabajo (`AppointmentJob`: "Ver trabajo" → `job-view`, or "Crear trabajo"); footer "Creado el" and "Editar turno" (no "Volver": a modal opened from a day's list leaves the list open when it closes).
- **edit / create:** `AppointmentForm`.
- **job-view / job-edit:** the shared `useJobModal` hosted exactly like `useVehicleModal` does (row loaded with `getJobRow`), "Volver" back to the appointment.
- After a successful action: toast, `onClose()`, and for create / edit `onSaved(row)` so the panel moves the calendar to the appointment's date.
- `AppointmentStatusControl`: any status can be chosen; cancelling opens `ConfirmDialog` ("¿Cancelar el turno?"); the change calls `setAppointmentStatus`, shows the new status right away, toasts and closes.
- The panel holds the modal and sends the calendar messages in order (`saved`: go to the day; `reopen-day`: open the "+N más" list the modal came from, with the focus on the appointment), so closing a modal opened from a list leaves it as it was.
- `AppointmentJob`: "Crear trabajo" runs `createJobFromAppointment`, toasts "Trabajo agregado" · job label and closes; hidden when the appointment is cancelled; disabled with "El vehículo está archivado." when `vehicle.enabled` is false.

`AppointmentForm` (React Hook Form + `appointmentFormSchema`): `FormRow`s Vehículo (`VehicleSelect`) + Cliente (read only, hint "Dueño del vehículo al momento de crear el turno."; owner through `getOwnerOfVehicle`, the stored client while the vehicle is the appointment's own), Fecha (date `Input`) + Hora (time `Input`), Estado (edit only, `Select` of the four statuses; Cancelado asks the cancel confirmation on submit), Motivo (`Textarea`). Errors linked to their fields, focus on the first error in page order.

## Validation

`appointmentFormSchema`: `vehicleId` `requiredIdField("vehicleRequired")`; `date` a real `yyyy-mm-dd` day (`isIsoDate`), else `dateRequired`; `time` any `HH:MM`, else `timeRequired`; `status` `z.enum(APPOINTMENT_STATUSES).default("pendiente")`; `reason` `optionalTextField`. New `ValidationErrorKey`s: `dateRequired`, `timeRequired`.

## Components and code

| Item | Location | New / reused |
|---|---|---|
| `DetailModal`, `DetailList`, `ConfirmDialog`, `PageHeader`, `LoadingRegion`, `PlateDisplay`, `WhatsappButton`, `StatusBadge`, `SearchableSelect`, `FormRow`, `FIELD_WIDTH`, `useLoadedData`, `useListResults`, `useRemoteOptions`, `ListError`, `ActionResult`, `formatClientName`, the job modal and `getJobRow` | shared / `features/` | Reused |
| `Calendar`, `CalendarSkeleton` | `components/shared/` | New |
| `lib/calendar.ts`, `lib/format/time.ts` | `lib/` | New |
| `APPOINTMENT_STATUSES`…, `AppointmentStatusBadge` | `lib/status.ts`, `status-badge.tsx` | Extended |
| `VehicleSelect`, `searchVehicleOptions`, `listVehicleOptions` | `features/vehicle/` | Moved from `features/job/`, reused by the job form |
| Appointment schemas, queries, actions, format, form, calendar params | `features/appointment/` | New |
| `AppointmentsPanel`, `AppointmentsCalendar`, `AppointmentCard`, `NewAppointmentButton`, `AppointmentsSummary`, `useAppointmentModal`, `AppointmentModal`, `AppointmentForm`, `AppointmentStatusControl`, `AppointmentJob` | `features/appointment/components/` | New |
| `turnos/page.tsx` + `loading.tsx` | `app/(app)/turnos/` | Replaced / new |
| `saveJob` revalidates `/turnos` | `features/job/actions.ts` | Extended |

## UI text

`messages/es.json`: `appointments` namespace (title, summary, calendar labels and legend, card label, modal details, status change and confirmation, job button states, form, toasts, errors); `status.appointment.*`; `validation.dateRequired`, `timeRequired`; `nav.appointments` already exists.

## Tests

- **pgTAP** `supabase/tests/10_appointments.sql`: `appointment_list` columns (decrypted reason, plate, brand, model, client; empty client columns), `job_id` (latest non-archived job; null when the only job is archived or none), another shop's rows never show, `anon` and a disabled profile see nothing, no writes through the view, the base-table rules the page depends on (an archived vehicle can't get an appointment; another shop's vehicle is refused).
- **Vitest, shared:** `lib/calendar` (month grid incl. months starting on Monday / Sunday and 6-week months, week range, `visibleRange`, arrows, Argentina today), `lib/format/time`, `lib/status` appointment mapping, `AppointmentStatusBadge`, `Calendar` (both views, greyed days, today marker, 3 + "+N más", popover contents and focus return, "+" creation, click on an empty spot, toggle, "Hoy" disabled, arrows, loading skeleton, announcements), `VehicleSelect`.
- **Vitest, appointments:** schema, calendar params, form helpers, queries (mocked Supabase: view, filters, order), actions (validation, owner as client, client kept / re-snapshotted, status update, archived vehicle mapped, `createJobFromAppointment` builds the right job and refuses a cancelled one, unexpected errors), components (card styles per status and the strikethrough, modal details and empty values, `Ver trabajo` / `Crear trabajo` states, status actions per status and the cancel confirmation, form fields and errors, no-change edit, toasts, the chain appointment → job with "Volver", day popover → appointment → "Volver" reopens it, the calendar moving to the saved date).
- **Accessibility:** buttons with names, `aria-pressed`, announcements, popover keyboard, focus returns, skeleton `aria-busy`.
- Existing job tests are updated for the moved vehicle search.

## Risks and alternatives

- **Moving the vehicle search** touches the job form and its tests. Alternative: import it from the job domain; rejected because a shared dropdown belongs to the vehicle domain.
- **A calendar is bigger than a list.** Kept generic and small (no drag and drop, no time grid); Inicio can reuse it.
- **Month titles as ranges** ("01/10/2026 al 31/10/2026") follow design.md's "never month names". Weekday labels stay as column headers.
- **The latest job per appointment** is a lateral subquery per row of the visible range; ranges are at most ~6 weeks, so the cost is small.
- **No search and no pagination** by design: the calendar is bounded by its visible range.
- **Stale data** after a change in another tab is refreshed on the next navigation, as in the other pages.
