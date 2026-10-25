# 008 — Appointments page (Turnos): Requirements

**Status:** Approved (pre-approved by the owner in conversation, 2026-10-25)

## Problem

Appointments, the shop's agenda, can only be created in the Supabase dashboard. `/turnos` is a placeholder. Staff need to see the agenda as a month or a week, create and edit appointments, follow their status, and start a job from an appointment.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access: anyone in the shop can manage its appointments.

## User stories

- As a staff member, I want to see the shop's appointments on a calendar by month or by week, so that I know what is coming.
- As a staff member, I want to create an appointment for a vehicle on a day and time, so that the visit is booked.
- As a staff member, I want to confirm, complete, cancel and reactivate an appointment, so that the agenda reflects what happened.
- As a staff member, I want to see an appointment's vehicle, client and reason, so that I know what to expect.
- As a staff member, I want to start a job from an appointment, so that I don't retype what the shop already knows.
- As a staff member, I want to open an appointment's job, so that I can move between the booking and the work.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (detail modal, modal to modal, modals, forms, searchable dropdowns, confirmations, toasts, formats, appointment statuses, clients on records, archived records) and reuses the kit built in specs [004](../004-services/requirements.md) to [007](../007-jobs/requirements.md). Where this spec and the docs ever disagree, the docs win. The criteria below are what this page adds or must specifically verify.

Page and calendar

- [ ] Given `/turnos`, when it loads, then it replaces the placeholder and shows the title "Turnos", a one-line summary and the "Nuevo turno" button.
- [ ] Given the calendar panel, when it shows, then its header has the period as title, a "Mes / Semana" toggle (month by default), "Hoy" (disabled when the view already includes today) and previous / next arrows with accessible names.
- [ ] Given the titles, when they show, then they use only the dd/mm/aaaa date format, never month names: the month view reads "01/10/2026 al 31/10/2026" and the week view "12/10/2026 al 18/10/2026".
- [ ] Given the month view, when it shows, then it is a Monday-first grid with the weekday labels as column headers, days of other months greyed and today marked with a dark circle on its number.
- [ ] Given a month day, when it has appointments, then each one is a single line with the time in bold and the vehicle's brand and model (cut with "…" when it exceeds the width), styled by status per [design.md](../../docs/design.md#visual-identity) (a 4px edge in the status color; Confirmado a solid border with diagonal lines; Cancelado struck through), with a legend under the calendar that draws each status as a square matching its card (plain, hatched, filled with a border, plain) and the status exposed to screen readers.
- [ ] Given a day with more than 3 appointments, when it shows, then the first 3 are listed and "+N más" opens a popover anchored to the day, titled with its dd/mm/aaaa date, listing all its appointments (time, brand and model, plate, status style). Clicking one opens its modal; the popover closes with its X, Esc, a click outside or scrolling; the view never switches by itself.
- [ ] Given an appointment opened from a "+N más" popover, when its modal is closed (the X, Esc, or after an action), then the popover is open again on the same day with the focus on that appointment. An appointment opened from the day itself leaves no popover open.
- [ ] Given the week view, when it shows, then it covers today and the next 6 days (7 days), and the arrows move it by 7 days. A day lists 5 appointments and then "+N más", which opens the same list as the month view. It is a shared calendar component that Inicio reuses with its own range.
- [ ] Given appointments in a day, when they are sorted, then they come by time and, for the same time, by creation.
- [ ] Given a cancelled appointment, when the calendar shows, then it stays in its day, struck through, and counts toward the first 3.
- [ ] Given the calendar, when a month or week is shown, then only the appointments of the visible days (including the greyed days of the month view) are loaded, with the shared skeleton while they load, an error with "Reintentar" if it fails, and the change of range announced to screen readers. Archived appointments are not shown and the page never shows the word "habilitado" or any archive control.
- [ ] Given the view and the date shown, when they change, then they are kept in the URL (the Back button works) and nothing sensitive is put in it.
- [ ] Given the days, when the pointer is over any part of one, then it is a hand (not only over its "+"), and each day is tall by default in both views.
- [ ] Given a day, when an empty spot of it is clicked, or its "+" button (visible on hover or keyboard focus, with an accessible name) is activated, then "Nuevo turno" opens with that date.
- [ ] Given an appointment, when it is clicked or activated with the keyboard, then the appointment modal opens. Past days behave like any other.
- [ ] Given a narrow screen, when the calendar shows, then it still works (the grid shrinks or scrolls sideways, nothing is cut off).

Appointment modal

- [ ] Given an appointment, when its modal opens, then the title is its date and time ("14/10/2026 · 09:00 hs"), there is no subtitle, and the header shows the status as a pill that is a dropdown (see Status below).
- [ ] Given the modal, when it shows, then the details sit two to a row from the `sm` breakpoint up: "Cliente" (name + surname, "(Archivado)" if archived, phone as plain text with the shared `WhatsappButton`, or "Sin cliente"; read only) next to "Vehículo" (the `PlateDisplay` drawing and "Brand Model Year", or "Brand Model"), then "Motivo" ("Sin motivo" when empty) next to "Trabajo".
- [ ] Given the "Trabajo" detail, when the appointment has a job, then it shows a "Ver trabajo" button that opens the job modal (the whole app's one job modal, with its actions) with "Volver" back to the appointment; when it has more than one, it opens the latest non-archived one; when it has none (or only archived ones), it shows "Crear trabajo" instead.
- [ ] Given the footer, when it shows, then it has "Creado el dd/mm/aaaa" and, on the right, only "Editar turno". There is no "Archivar", no status button and no "Volver" (an appointment opened from a day's "+N más" list closes back to that list: see the popover criteria).
- [ ] Given the status pill, when it shows, then it works like a job's: a dropdown (arrow inside the pill) with the four statuses in order and the app's neutral style, and any of them can be chosen at any time, from any status.
- [ ] Given a status chosen, when it differs from the current one, then the appointment changes, a toast confirms ("Turno confirmado", "Turno completado", "Turno cancelado", or "Estado actualizado" for Pendiente) and the whole modal closes; if it fails the old status stays and an error toast shows.
- [ ] Given Cancelado chosen from the pill, when the appointment wasn't cancelled, then a confirmation asks "¿Cancelar el turno?" + one line + "Cancelar" / "Cancelar turno"; nothing changes until it is confirmed. The other changes ask nothing.
- [ ] Given "Crear trabajo", when clicked, then a job is created at once, without a form, with: the appointment's vehicle, its client (the vehicle's owner; none when that owner is archived, the database refuses it), the appointment's id, status Pendiente, no services, Observaciones prefilled with the appointment's reason, and Kilometraje as the vehicle's latest recorded km (empty when there is none), by the same rule as a new job. The modal closes, a toast "Trabajo agregado" confirms and the appointment's status does not change.
- [ ] Given a cancelled appointment, when its modal shows, then "Crear trabajo" is hidden. Given an appointment whose vehicle is archived, when its modal shows, then "Crear trabajo" is disabled with the reason ("El vehículo está archivado.").

New and edit appointment

- [ ] Given "Nuevo turno", when clicked, then a modal titled "Nuevo turno" opens with the form, the subtitle "Los campos con * son obligatorios." and the footer "Cancelar" (closes) / "Agregar turno". Given "Editar turno", then the modal content is replaced by the form titled "Editar turno" with the appointment's date and time above the subtitle, prefilled, and the footer "Cancelar" (back to the appointment) / "Guardar cambios".
- [ ] Given the form, when it shows, then it has, in this order, two to a row from the `sm` breakpoint up: "Vehículo *" and "Cliente"; "Fecha *" and "Hora *"; "Estado" (edit only) alone; "Motivo" full width. The form has no quick create of anything (no new vehicle, no new client).
- [ ] Given the Vehículo dropdown, when opened, then it is the same shared searchable vehicle dropdown the job form uses (extracted to `components/shared/` or the vehicle domain, and used by both): active vehicles only, filtered as the user types, "Brand Model" with the plate in grey, no quick create, "Elegí un vehículo de la lista." / "Elegí el vehículo.". When editing, the appointment's own vehicle stays selected even if archived, labelled "(Archivado)", and can be changed to an active one.
- [ ] Given the Cliente field, when it shows, then it is read only: the vehicle's owner, "El vehículo no tiene cliente" or "Elegí un vehículo", with the hint "Dueño del vehículo al momento de crear el turno.". It follows the picked vehicle's owner on a new appointment; on an edit it keeps the stored client while the vehicle is unchanged and follows the new vehicle's owner when the vehicle changes. The server decides it from the vehicle, whatever the form sent.
- [ ] Given Fecha, when shown, then it is a date picker prefilled with the clicked day (or today) and a past date is allowed. Given Hora, when shown, then it is a native time field (like a date-time input), free to take any hour and minute with no steps or limits, empty on a new appointment; an empty one shows "Elegí la hora.".
- [ ] Given a missing date or time, a vehicle that matches no option or an empty one, when saved, then the matching error shows under the field and focus moves to the first error ("Elegí la fecha.", "Elegí la hora.").
- [ ] Given Estado (edit only), when shown, then it is a select with the four statuses; choosing Cancelado asks the same confirmation as "Cancelar turno" on save. New appointments are Pendiente.
- [ ] Given Motivo, when typed, then it is optional multi-line text, trimmed (line breaks kept), an empty value is stored as null, placeholder "Ej.: ruido al frenar, service de los 10.000 km".
- [ ] Given a valid form, when saved, then a toast "Turno agregado" or "Cambios guardados" with the line "<model>, dd/mm/aaaa a las hh:mm hs" confirms, the modal closes, the calendar moves to the appointment's date (month or week view as it was) and the appointment's modal does not open. An edit with no changes goes back to the appointment without a request or a toast.
- [ ] Given a vehicle archived meanwhile, when saved, then the form stays open with "El vehículo está archivado." under Vehículo, mapped from the database error.
- [ ] Given the same input sent directly to the server, when the server action runs, then it applies the same Zod schema.

Rules for every screen (design.md: Modals, Forms, Loading, Plates)

- [ ] Given any action that succeeds in an appointment modal, when it finishes, then the modal closes (the whole chain if it was opened from another modal), a toast confirms and the calendar refreshes; it never opens a detail afterwards. When it fails the modal stays open.
- [ ] Given the page, when its data loads, then the title and "Nuevo turno" render right away and the summary and the calendar show a skeleton in the final sizes; the modal and its dropdowns show skeletons while they load.
- [ ] Given the page and its modals, when used, then they meet design.md's accessibility rules: keyboard-only operation with a visible focus ring, focus trapped in modals and returned to what opened them, the popover operable by keyboard, field errors linked to their fields, toasts and range changes announced, status never conveyed by color alone, and animations still with reduced motion.
- [ ] Given a plate in any format, when drawn in a modal, then it is the shared `PlateDisplay`; in calendar cards, popovers and dropdowns it is plain text.

Reuse and standardization

- [ ] Given the page, when built, then it reuses `DetailModal`, `DetailList`, `StatusBadge`, `PlateDisplay`, `WhatsappButton`, `SearchableSelect`, `FormRow`, `FIELD_WIDTH`, `useLoadedData`, `ActionResult` and the shared job modal. New generic pieces (the calendar with its month and week views and the day popover, the date and time pickers, the vehicle dropdown extracted from the job form) live in `components/shared/` or `lib/`, are generic, and have Vitest tests.

Isolation and database

- [ ] Given two shops, when a user of one reads, creates or edits appointments through this page, then they never see or change the other shop's data (RLS, covered again for any new view column).
- [ ] Given an appointment's reason, when handled, then it is read through `appointment_decrypted`, never logged and never put in the URL.
- [ ] Given a save, when it runs, then it is a single-table write through the Data API (no quick create, so no database function is needed), and the database rule "no new appointments on archived vehicles" is mapped to its message.
- [ ] Given the calendar, when it reads, then the database provides the vehicle, the client and the appointment's latest non-archived job as columns of a `security_invoker` view (`appointment_list`), computed only when selected and never stored: no personal data is copied into plaintext columns.

## Out of scope

- Creating a vehicle or a client from the appointment form (changed from the original description; same as the job form).
- Archiving appointments and showing `enabled` anywhere.
- Working hours, durations, overlap checks and reminders.
- The Inicio page (it will reuse the calendar and the job modal with its own spec).
- Editing or deleting the job from the appointment other than through the job modal.
- Any automatic status change of the appointment when its job changes.

## Docs to update when implemented

- [design.md](../../docs/design.md#quick-create-inside-a-dropdown): the appointment form joins the job form as an exception to quick create.
- [design.md](../../docs/design.md#archive): state that appointments are not archived from the app.
- [design.md](../../docs/design.md#clients-on-records): the client follows the vehicle when it changes on an edit.

## Open questions

- None.
