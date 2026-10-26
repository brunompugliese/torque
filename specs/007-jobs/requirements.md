# 007 — Jobs page: Requirements

**Status:** Approved (by the owner in conversation, 2026-10-22)

## Problem

Jobs, the shop's actual work (quote, work and delivery of a vehicle), can't be created or managed from the app: the database has them (`job`, `job_item`, `job_status_history`, closed-job and km rules) but there is no screen. Staff need to list, search, filter, create, edit, archive and unarchive jobs at `/trabajos`, price their services through the quote and work phases, and follow every status change.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access: anyone in the shop can manage its jobs.

## User stories

- As a staff member, I want to see every job in a sortable, searchable list, so that I can find one quickly.
- As a staff member, I want to filter jobs by status and by last-update date, so that I can see what is open or what changed in a period.
- As a staff member, I want to create a job for a vehicle, so that its work is recorded from the first quote.
- As a staff member, I want to add services with a quoted price and, once the work starts, a final price, so that the job shows what was agreed and what was charged.
- As a staff member, I want every status change logged and visible, so that I know who moved a job and when.
- As a staff member, I want closed jobs (Entregado, Cancelado) to be locked, so that delivered work can't be altered by accident.
- As a staff member, I want to archive a job entered by mistake, so that it stops cluttering the list while its history stays.
- As a staff member, I want to open a job from a vehicle's history, so that I can move between a car and its work.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (list pages, search, detail modal, modal to modal, modals, forms, searchable dropdowns, quick create, archive, confirmations, toasts, job statuses, prices, kilometers, clients on records, archived records) and reuses the kit built in specs [004](../004-services/requirements.md), [005](../005-clients/requirements.md) and [006](../006-vehicles/requirements.md). The criteria below are what this page adds or must specifically verify. Where this spec and the docs ever disagree, the docs win.

Page and list

- [ ] Given `/trabajos`, when it loads, then it replaces the placeholder and shows the title "Trabajos", the summary "N trabajos en total, M archivados." (N counts active and archived; singular and plural agree, "0 archivados" always shown, e.g. "1 trabajo en total, 0 archivados.") and the "Nuevo trabajo" button.
- [ ] Given the list, when it loads, then it has seven columns: "Patente" (plate drawing, centered), "Vehículo" (brand + model, with the year below in secondary color, and an "Archivado" badge on archived rows), "Cliente" (name + surname, with the suffix "(Archivado)" if archived; "Sin cliente" when none), "Estado" (the status pill, a dropdown with the seven statuses while the job is open and active; a plain pill when it is closed or archived), "Kilometraje" (dot thousands + "km", right-aligned, tabular figures; "—" when empty), "Total" (right-aligned) and "Actualizado" (dd/mm/aaaa, styled per design.md's table date standard).
- [ ] Given the "Total" column, when a row shows, then it shows the final total labelled "Final" when the job has one, otherwise the quoted total labelled "Presupuestado"; a job with no total shows "—".
- [ ] Given the list, when it loads, then no header is marked as sorted and rows come by last update, newest first (the page's default order).
- [ ] Given any of the seven headers, when clicked, then the list sorts by it ascending on the first click ("Actualizado" oldest first), reverses on the second, and the header shows the sorted look and announces its direction, per design.md.
- [ ] Given a sort, when it runs, then "Patente" sorts by the plate, "Vehículo" by brand, then model, then year (ignoring case and accents), "Cliente" by name and then surname (ignoring case and accents), "Estado" by the status order of design.md, "Kilometraje" by numeric value and "Total" by the displayed amount (final if any, otherwise quoted).
- [ ] Given a sort by Cliente, Kilometraje or Total, when some jobs have no value, then those jobs come last in both directions.
- [ ] Given more than 25 jobs, when the list shows, then it is paginated, searched, filtered and sorted on the server over the whole table, per the shared pattern.
- [ ] Given loading, an error or no results, when the list shows, then it shows the shared states. No results for a search or filters: "No encontramos trabajos" · "Probá con otra patente, marca, modelo o cliente." · "Limpiar búsqueda y filtros". No jobs at all: "Todavía no hay trabajos" · "Creá el primero para registrar el trabajo de un vehículo." · "Nuevo trabajo".
- [ ] Given a row, when it is clicked (or activated with the keyboard), then the job modal opens with actions.

Search and filters

- [ ] Given the toolbar, when it shows, then it has the search box (placeholder "Buscar por patente, marca, modelo o cliente"), the filters "Estado" and "Fecha", and the "Mostrar archivados" switch (off by default); there is no result count.
- [ ] Given a search term, when typed, then jobs whose vehicle plate, brand or model, or whose client's name or surname, match are listed, ignoring case, accents, spaces, dots and dashes ("ae 482" and "AE482" find the same plate).
- [ ] Given a search term and "Mostrar archivados" off, when archived jobs match, then they are listed too, greyed and with the "Archivado" badge.
- [ ] Given a search term, when typed, then it is kept in component state and sent in the Server Action's body, never put in the URL (architecture.md "Never in URLs"); the URL holds only the filters, the archived switch, sort and page.
- [ ] Given the "Estado" filter, when opened, then it is a checklist of the seven statuses in their order, each with its count; the counts reflect the current search (and the archived switch) and ignore the Estado selection itself. Selecting several statuses lists jobs in any of them.
- [ ] Given the "Fecha" filter, when opened, then it has "Desde" and "Hasta" and applies to the day of the job's last update (Argentina time, both days included). Either can be left empty. When "Desde" is later than "Hasta", then "La fecha “Desde” no puede ser posterior a “Hasta”." shows and the filter isn't applied.
- [ ] Given active filters, when they show, then each is a removable chip ("Entregado", "Actualizado: 01/09/2026 al 30/09/2026"; a single bound reads "Actualizado: desde 01/09/2026" / "Actualizado: hasta 30/09/2026"), with an accessible name that says what removing it does. Any filter, search or sort change returns to page 1.
- [ ] Given filters or a search that match nothing, when "Limpiar búsqueda y filtros" is clicked, then the search text and every filter are cleared.

Job modal

- [ ] Given a job, when its modal opens, then it shows instantly from the row already loaded with the list; the header shows the plate drawing and "Brand Model Year" (just "Brand Model" without a year), then the status pill and the "Archivado" badge when archived; there is no "Actualizado" line. The footer has "Creado el dd/mm/aaaa" and, on the right, "Volver" (when opened from another modal), "Archivar" / "Desarchivar" and "Editar trabajo" (docs/design.md: Detail modal).
- [ ] Given a closed job (Entregado or Cancelado), when its modal opens, then "Editar trabajo" is hidden, "Archivar" / "Desarchivar" stays, the status is a pill with a lock icon inside it (no arrow, no text under the title; a screen reader still hears "Cerrado, no se puede editar").
- [ ] Given the job modal, when it opens, then the details show, two to a row from the `sm` breakpoint up: "Cliente" (name + surname, with "(Archivado)" if archived, the phone as plain text with the shared `WhatsappButton`, or "Sin cliente"; read only, the name does not open the client modal), "Kilometraje" ("Sin cargar" when empty) and "Observaciones" ("Sin observaciones" when empty, the whole row). The responsable is not shown anywhere.
- [ ] Given the job modal, when it loads its services and history, then each section shows the shared skeleton (`aria-busy`, one "Cargando…") in the final sizes, and an error with "Reintentar" if it fails.
- [ ] Given a job in the quote phase (Pendiente, Presupuesto enviado, Presupuesto aceptado), when the "Servicios" table shows, then its columns are "Servicio", "Cant." and "Precio" (unit price), with the total in the last row. In the work phase (En progreso, Completado, Entregado) the columns are "Servicio", "Cant.", "Presupuestado" and "Final", with both totals in the last row. A Cancelado job shows the columns of the phase it was in: work phase when its items have final prices, otherwise quote phase.
- [ ] Given a job with no services, when the table shows, then it says "Todavía no hay servicios cargados."
- [ ] Given the job, when the "Historial de estados" shows, then it is a vertical timeline, newest first. Each entry has the new status as its pill and the user's name and the date and time (dd/mm/aaaa hh:mm hs); no "desde …" or "(creación)" text. The line connecting the entries is continuous from the first node to the last.
- [ ] Given the footer, when it shows, then it has "Creado el dd/mm/aaaa" (Argentina time) and "Volver" only when the modal was opened from another modal.
- [ ] Given one job modal for the whole app, when it is opened from Trabajos, Turnos or a vehicle's history, then it has the actions above; when it is opened from Inicio, then it has the same actions too (changed by [spec 009](../009-home/requirements.md); it was read only here before). Inicio and Turnos adopt it in their own specs.
- [ ] Given a vehicle's "Historial de trabajos" (spec 006), when a job row is clicked or activated with the keyboard, then the job modal opens with "Volver" back to the vehicle (and the row's focus restored). This supersedes spec 006's "not clickable" criterion. After any action on the job the whole chain closes, and the X closes every modal in the chain.

New and edit job

- [ ] Given "Nuevo trabajo", when clicked, then a modal titled "Nuevo trabajo" opens with the form, the subtitle "Los campos con * son obligatorios." and the footer "Cancelar" (closes) / "Agregar trabajo".
- [ ] Given "Editar trabajo", when clicked, then the modal content is replaced by the form titled "Editar trabajo", with the vehicle's plate and name above the subtitle and the fields prefilled; the footer is "Cancelar" (back to the job modal) / "Guardar cambios".
- [ ] Given the form, when it shows, then it has, in this order: "Vehículo *" and "Cliente" side by side, "Estado *" and "Kilometraje" side by side, "Observaciones" and the services editor. There is no responsable field (the creator is recorded by the database and never changes) and no Turno field: a job created here has no appointment, and editing keeps the one it has.
- [ ] Given a valid form, when saved, then the job is created, a toast "Trabajo agregado" · "<plate>, <brand model>" confirms and the modal closes (the list refreshes behind it). An edit saves with a toast "Cambios guardados" · "<plate>, <brand model>". An edit with no changes goes back to the job without a request or a toast.
- [ ] Given a job and its services, when saved, then the job, its services and its status are saved in one database transaction (one request): if any part fails, nothing is saved. The quoted total (always) and the final total (work phase only) are calculated by the app and saved with the job.
- [ ] Given a save with a different status, when it succeeds, then the database logs one status history entry (previous status, new status, user, date and time). The app writes no history itself.

Vehículo and Cliente

- [ ] Given the Vehículo dropdown, when opened, then it lists active vehicles only, filtered as the user types (plate, brand, model), each option showing "Brand Model" and the plate in grey; once picked the field shows "Fiat Cronos (AD 915 TB)". It has no quick create. Text that matches no option shows "Elegí un vehículo de la lista."; empty shows "Elegí el vehículo.".
- [ ] Given a job being edited whose vehicle is archived, when the form shows, then that vehicle stays selected and is shown labelled "(Archivado)". The vehicle can still be changed to an active one.
- [ ] Given the Cliente field, when it shows, then it is read only: it shows the vehicle's owner (name and surname), or "Sin cliente" when the vehicle has none. Nobody picks a job's client: there is no list and no quick create.
- [ ] Given a vehicle picked, when it has an active owner, then Cliente shows that owner (without any hint); when the vehicle changes, Cliente follows the new vehicle's owner, and the appointment resets to "Sin turno".
- [ ] Given a vehicle whose owner is archived, when it is picked for a new job, then Cliente shows "Sin cliente" with the hint "El dueño del vehículo (Nombre Apellido) está archivado: el trabajo se guarda sin cliente.", because the database refuses an archived client on a new job; the job is saved with no client.
- [ ] Given a job being edited whose client is its vehicle's archived owner, when the form shows, then that client stays, labelled "(Archivado)", and keeps being saved unchanged (the database only checks a client when it changes), with no hint.
- [ ] Given a save, when the action runs, then the job's client is decided on the server from the vehicle's owner (whatever the form sent), so a job's client can only be its vehicle's owner or none.

Estado

- [ ] Given the Estado field, when shown, then it is a select with the seven statuses in order, defaulting to Pendiente on a new job; any status can be chosen at any time.
- [ ] Given Entregado or Cancelado chosen, when the form shows, then the warning (design.md warning colors) "Al guardar como entregado, el trabajo queda cerrado y no se va a poder editar más." shows under Estado ("cancelado" for Cancelado).
- [ ] Given a save that sets Entregado or Cancelado, when the user saves, then a confirmation asks "¿Cerrar el trabajo?" + "Va a quedar como entregado y no se va a poder editar más." ("cancelado" for Cancelado) + "Cancelar" (back to the form, nothing saved) / "Guardar y cerrar" (saves). Changes to any open status ask nothing.
- [ ] Given the work phase, when the user switches the status into it in the form, then every service row with an empty final price gets its quoted price as the final price.
- [ ] Given a job that was in the work phase, when the status is switched to the quote phase and saved, then its final prices and final total are cleared (final prices exist only in the work phase).

Kilometraje

- [ ] Given a new job, when a vehicle is picked, then Kilometraje is prefilled with the vehicle's latest recorded km and the hint "Último registrado: 68.400 km" shows (no hint, no prefill and any whole number ≥ 0 accepted when the vehicle has none).
- [ ] Given a km lower than the latest recorded, when saved, then "No puede ser menor que el último kilometraje registrado (68.400 km)." shows under Kilometraje and focus moves there. The latest recorded is the highest km among the vehicle's non-archived jobs created before this one (all of them for a new job), the same rule the database enforces; a database rejection maps to the same message.
- [ ] Given Kilometraje, when typed, then it accepts only digits (a whole number), shown with dot thousands.

Turno

- [ ] Given a job created from this page, when saved, then it has no appointment; a job that already has one keeps it, unless its vehicle is changed (an appointment belongs to the vehicle).

Observaciones

- [ ] Given Observaciones, when typed, then it is a multi-line optional text; it is trimmed (line breaks kept) and an empty value is stored as null. No length limit.

Services editor

- [ ] Given the editor, when it shows in the quote phase, then there is one header row ("Servicio *", "Cant.", "Precio unit. *", "Subtotal") and each service is one line of the same columns: "Servicio *" (searchable dropdown of the shop's active services; no quick create), "Cant." (whole number ≥ 1, default 1), "Precio unit. *" (editable, "$" prefix), "Subtotal" (quantity × price) and a trash button (accessible name "Quitar servicio"). Below the `sm` breakpoint the cells stack, each with its visible label. A job can be saved without services.
- [ ] Given the editor in the work phase, when it shows, then the columns of the header and of every line are "Servicio *", "Cant.", "Presup. unit." (read only for rows that already existed on the saved job, editable for rows added in this form), "Final unit." (editable, prefilled with the quoted price), "Subtotal" (quantity × final price) and the trash button.
- [ ] Given "Agregar servicio", when clicked, then an empty row is added and its Servicio field gets the focus.
- [ ] Given price inputs, when typed, then they accept digits and a comma with up to two decimals ("12500,50"); whole amounts need none; $0 is allowed. Totals keep the decimals and show per design.md's money format.
- [ ] Given the totals under the table, when a price, quantity or row changes, then they update live: "Total" in the quote phase, "Presupuestado" and "Final" in the work phase.
- [ ] Given a row without a service, when saved, then "Elegí un servicio." shows under it; text that matches no option shows "Elegí un servicio de la lista."; a row without a price shows "Ingresá el precio."; the same for an empty final price. Focus moves to the first error in the order the fields appear.
- [ ] Given a saved job with an archived service, when edited, then that row keeps showing the service (labelled "(Archivado)") and can be saved unchanged; an archived service can't be picked for another row.

Closing and database rules

- [ ] Given a job that became closed (by someone else or in another tab) while a form was open, when saved, then the form stays open with the message "Este trabajo ya está cerrado y no se puede editar.".
- [ ] Given the database rules of design.md, when they reject a save (archived vehicle, archived client, archived service, km below the previous), then the app shows a field or form message for it instead of a generic error.
- [ ] Given the same input sent directly to the server, when the server action runs, then it applies the same Zod schemas.

Archive and unarchive

- [ ] Given "Archivar", when clicked (on any job, closed ones included), then a confirmation asks "¿Archivar este trabajo?" + "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras. Su kilometraje deja de contar como último kilometraje del vehículo." + "Cancelar" / "Archivar".
- [ ] Given the confirmation, when "Archivar" is confirmed, then the modal closes (the archive standard in design.md; the list refreshes and the job leaves it unless "Mostrar archivados" is on) and a toast "Trabajo archivado" · "<plate>, <brand model>" confirms.
- [ ] Given an archived job, when "Desarchivar" is clicked, then it is restored immediately, without confirmation, the modal closes and a toast "Trabajo desarchivado" · "<plate>, <brand model>" confirms.

Rules for every screen (docs/design.md: Modals, Forms, Loading, Plates)

- [ ] Given any action that succeeds in a job modal (create, edit, archive, unarchive), when it finishes, then the modal closes (the whole chain if it was opened from another modal), a toast confirms and the list behind refreshes; the detail never opens afterwards. When it fails the modal stays open.
- [ ] Given the job modal (view, form and its loading state), when it shows, then it is the wide variant of the dialog (`DetailModal` `wide`), so the form uses the horizontal space; its fields sit two to a row from the `sm` breakpoint up and stack below it (Vehículo next to Cliente, Estado next to Kilometraje); long values (Observaciones, the services editor) are full width; field widths come from `FIELD_WIDTH`; Kilometraje takes the full width of its column, like Cliente.
- [ ] Given a plate in any format, when drawn, then it is the shared `PlateDisplay`.
- [ ] Given the list, when a search, a filter, a sort, a page change, the archived switch or "Reintentar" loads new rows, then the table shows placeholder rows (not the old rows) until they arrive, announced once as "Cargando…" with `aria-busy`; the toolbar keeps the text being typed and the header keeps its sort buttons.
- [ ] Given `/trabajos` while its data loads, when it shows, then the title and "Nuevo trabajo" render right away and the summary and the table show a skeleton in the final sizes, so nothing shifts. Every dropdown's options show the shared skeleton or a disabled state while they load.

Accessibility

- [ ] Given the page and its modals, when used, then they meet design.md's accessibility rules: keyboard-only operation with a visible focus ring, focus trapped in modals and returned to what opened them, sort direction announced, filters operable by keyboard and their chips removable by keyboard, field errors (including those inside the services editor) linked to their fields with focus on the first error, toasts and the pagination range announced, the status never conveyed by color alone (badge text; the lock icon has text), the timeline readable by screen readers as a list, and animations still with reduced motion.

Reuse and standardization

- [ ] Given the page, when built, then it reuses the list-page kit and shared pieces (`DataTable`, `ListUrlToolbar`, `ListSearchProvider`, `PaginationBar`, `ListNoRows`, `DetailModal`, `DetailList`, `ArchiveConfirmDialog`, `useArchiveFlow`, `ArchivedBadge`, `TableDate`, `PlateDisplay`, `WhatsappButton`, `StatusBadge`, `SearchableSelect`, `FormRow`, `FIELD_WIDTH`, `useListResults`, `applyListQuery`, `useLoadedData`, `formatKm`, `formatMoney`). New generic pieces (the filter controls and their chips, the date-range filter, the money and quantity input rules, the status timeline, the services editor row if it can serve other screens) live in `components/shared/` or `lib/`, are generic and have their own Vitest tests.

Isolation and database

- [ ] Given two shops, when a user of one lists, searches, filters, reads, creates, edits or archives jobs, services or history through this page, then they never see or change the other shop's data (RLS, covered again for every new view column and function).
- [ ] Given the job list, when read, then the database provides the search text and the sort and display values (vehicle, client, status order, displayed total) as columns of a `security_invoker` view, computed only when selected and never stored: no personal data is copied into plaintext columns.
- [ ] Given a job saved with its services, when the function that saves it runs, then it runs as the caller (RLS and the encryption triggers apply), has explicit grants (not executable by `anon`), is atomic, saves the items before the status so the closed-job guard accepts a close, and reports the rules above in a way the app maps to the messages above.
- [ ] Given personal and vehicle-identifying data, when handled, then it is never logged and never put in the URL (conventions.md).

## Out of scope

- Inicio and Turnos (the read-only job modal and the job form's entry points from them arrive with their own specs); the modal built here is the one they will use.
- Showing or changing the responsable (`assigned_to`): the database records the creator and the UI doesn't show it.
- Quick create of anything from the job form (vehicle, client, service): a job's client is its vehicle's owner or none, and services come from the catalog (changed 2026-10-23).
- Deleting a job (only archiving), and editing a closed job.
- Printing or sending the quote, payments, invoices, discounts, taxes and stock.
- Prices on services (they live on job items), and a "Usado en" count on services.
- Length limits on observations and service names.
- Enforcing a status order (any status can be set at any time, by decision).

## Decisions taken with the owner (2026-10-22)

- List columns: Patente · Vehículo (brand and model with the year below) · Cliente · Estado · Kilometraje · Total · Actualizado.
- Estado counts reflect the current search.
- $0 is allowed; an empty price shows "Ingresá el precio.".
- The responsable is not shown.
- Where the original page description conflicted with the docs, the docs won: dates are never relative ("Actualizado hoy 21:47" became "Actualizado dd/mm/aaaa hh:mm hs"), the summary is "N trabajos en total, M archivados." (not "abiertos"), the client's phone is plain text with the WhatsApp button (no phone link), the closing confirmation of design.md applies on top of the inline warning, and the list opens with no header marked.
- From the docs: final prices exist only in the work phase, a cancelled job keeps the phase it was in, a default client that is archived leaves Cliente empty, quick create of the last dropdown option applies to client and service (the vehicle has none, as specified), and vehicle-history rows open the job modal.

- Changed later (2026-10-23): the job form has no quick create at all. The client is read only (the vehicle's owner, or none, with a hint when the owner is archived), without the "Por defecto, el dueño del vehículo." hint, and services can only be picked from the catalog. This supersedes the criteria and decisions above about the client dropdown, "+ Crear cliente nuevo" and "+ Crear servicio nuevo". The database function still accepts a new client and new services; the app never sends them.

- Changed later (2026-10-23, layout): the job modal is wide; Vehículo and Cliente share a row; there is no Turno field (a job created here has no appointment); each service is one line under one header row. This supersedes the criteria about the Turno select and the services editor's two-line rows.

- Changed later (2026-10-23, no Turno): the job modal does not show the appointment either, only the form lacked it before. A job can still be linked to an appointment in the database (Turnos will use it).

- Changed later (2026-10-23, pill and filters): the dropdown arrow and the lock are icons inside the pill (`StatusBadge` `trailing`), never drawn by the table, so any page that shows the job list reuses them (Inicio). A filter that is applied (Estado, Fecha) shows a "Limpiar" button in its panel that clears only that filter.

- Changed later (2026-10-23, inline status): the status pill is editable without opening the job.
  - **Dropdown:** the pill opens a list of the seven statuses in the app's neutral (primary) style, not each status' color, in the Trabajos list and in the job modal's header. A closed (Entregado, Cancelado) or archived job, and a read-only modal, show a plain pill.
  - **Rules:** it is the same save as the form with the saved services (`setJobStatus`). Moving into the work phase gives every service its quoted price as the final one, moving back to the quote phase clears the final prices, and closing asks "¿Cerrar el trabajo?" first. The status history logs it.
  - **Result:** a toast "Estado actualizado" · "<plate>, <brand model>". From the modal the whole modal closes, like any action. If it is refused (closed meanwhile, a database rule) the old status stays and an error toast shows.
  - **Detail modal, every modal in the app:** the header no longer holds the actions; "Archivar" and "Editar" sit in the footer, on the right after "Volver". The job modal drops its "Actualizado" subtitle and its "Estado" detail.

## Open questions

- None.
