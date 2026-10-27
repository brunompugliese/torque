# Torque — Design

How the app looks and behaves. Every page follows these conventions; each page's own behavior is defined in its spec in `specs/`. Code-level rules (tokens, components, data access) are in [conventions.md](conventions.md); the data model is in [db_schema.sql](../db_schema.sql).

## Principles

- **Vehicle-centric.** The vehicle is the main record. Clients, appointments and jobs hang off it. A client is an optional contact attached to vehicles.
- **One shop per account.** Users only see their own shop's data.
- **Desktop-first.** Designed for a computer at the shop's front desk. Smaller screens must still work (stacked layouts, tables scrolling sideways).
- **Spanish only.** All UI text in Spanish (Argentina).
- **Time zone:** fixed to Argentina (UTC−3) for every date and time, including which day counts as today.
- **Nothing is deleted.** Records are archived instead (see [Archive](#archive)).
- **Four rules every screen follows**, new ones included (set by the owner, 2026-10-21): every action closes its modal and toasts ([Modals](#modals)); forms use two columns, each field as wide as its values need ([Forms](#forms)); every plate is drawn the same and takes the same room ([Plates](#visual-identity)); a list shows its skeleton on every search, sort and page, not only the first load ([Loading](#loading)).

## Visual identity

Neutral black, white and greys, so status colors are the only strong color on screen. Light theme only, even if the user's system is in dark mode.

**Base palette**

| Role | Color | Use |
| --- | --- | --- |
| Page background | #FAFAFA | Behind panels |
| Surface | #FFFFFF | Panels, modals, inputs, cards |
| Text | #09090B | Body text and values |
| Secondary text | #6B6B74 | Labels, hints, metadata, empty values |
| Muted fill | #F4F4F5 | Row hover, selected items, read-only fields |
| Border | #E4E4E7 | Panels, tables, inputs |
| Primary | #18181B, text #FAFAFA | Primary buttons, current navbar item, today marker, focus ring |
| Destructive | #B91C1C | Cancel actions, field errors |
| Warning | fill #FFFBEB, border #FCD34D, text #78350F | Closing-a-job warning |
| Plate blue | #1E4FB8 | Top band of the plate drawing |

**Job status colors.** Badge = tinted fill + dark text + a border in the text color at 20% (the same for every status). No dot inside the badge; the dot color is for the calendar's card edges.

| Status | Fill | Text | Dot |
| --- | --- | --- | --- |
| Pendiente | #FFFBEB | #92400E | #F59E0B |
| Presupuesto enviado | #EFF6FF | #1E40AF | #3B82F6 |
| Presupuesto aceptado | #ECFEFF | #155E75 | #06B6D4 |
| En progreso | #F5F3FF | #5B21B6 | #8B5CF6 |
| Completado | #F0FDF4 | #166534 | #22C55E |
| Entregado | #F8FAFC | #1E293B | #334155 |
| Cancelado | #FEF2F2 | #991B1B | #EF4444 |

**Appointment status colors.** Calendar cards: a white card with a 4px left edge in the status color (Pendiente), a solid green border with diagonal lines over white ("////", Confirmado), or a filled card with the edge (Completado, Cancelado). The legend under the calendar draws each status as a small square that says the same: a plain amber square (Pendiente), a solid green border with diagonal lines (Confirmado), the Completado card's solid fill with a solid green border, and a plain red square (Cancelado).

| Status | Card | Badge (fill / text / dot) |
| --- | --- | --- |
| Pendiente | White card, edge #F59E0B | #FFFBEB / #92400E / #F59E0B |
| Confirmado | White card, solid border #22C55E, diagonal lines in #22C55E at 45%, no edge | #F0FDF4 / #166534 / #22C55E |
| Completado | Fill #F0FDF4, border #BBF7D0, edge #22C55E, text #166534, not struck through | #F0FDF4 / #166534 / #22C55E |
| Cancelado | Fill #FEF2F2, border #FECACA, edge #EF4444, text #991B1B, struck through | #FEF2F2 / #991B1B / #EF4444 |

These values are implemented as tokens in `src/app/globals.css` ([conventions.md](conventions.md#colors-and-theming)).

**Typography.** Geist, with a system sans-serif fallback. Base 14px, line height 1.5.

| Element | Size / weight |
| --- | --- |
| Page title | 28px bold |
| Section and panel title | 16px semibold |
| Modal title | 18px semibold |
| Body, table cells, inputs | 14px regular |
| Labels, buttons | 13px medium |
| Hints, metadata, badges | 12px |
| Table column headers | 12px medium, secondary text; the sorted column in text color |

Numbers (money, km, times, DNI) use tabular figures so columns align.

**Shape and spacing.** Panels and modals 10–12px corner radius; buttons and inputs 34–36px tall, 8px radius; badges fully rounded. Page padding 32px (16px on small screens), 24px between panels. Shadows only on floating elements: navbar, modals, popovers, dropdown lists, toasts.

**Plates.** In tables and modal titles the plate is drawn as an Argentine Mercosur plate: white, black border, blue top band, bold spaced characters ("AB 123 CD"). Old-format plates ("ABC 123") use the same drawing. **Every plate is drawn identically and takes the same room on screen** (a fixed width that fits the longest, "AB 123 CD", with the characters centered), whatever its format: only the characters differ, so a column of plates lines up. In calendar cards, dropdowns and running text the plate is plain text.

**Logo.** The shop's logo (white on black) in a 40px rounded square, followed by the shop's name in 17px bold.

## Copy and naming

- **Voice.** Plain Argentine Spanish with "vos". Short, direct, no system words. Imperatives in voseo: "Elegí", "Ingresá", "Probá", "Tocá".
- **Domain terms.** Vehículo, patente, cliente, turno, trabajo, presupuesto, servicio, kilometraje, cédula verde, VTV. Never "orden", "registro" or "usuario" for clients.
- **Buttons.** Verb + object, sentence case: "Agregar vehículo", "Guardar cambios", "Confirmar turno", "Editar trabajo", "Archivar". Neutral: "Cancelar", "Volver".
- **Required fields.** "\*" after the label, explained once per form by the subtitle "Los campos con \* son obligatorios." Optional fields have no tag.
- **Hints.** One line under the field, only when it helps.
- **Errors.** Say what to do: "Ingresá la patente.", "Elegí un modelo de la lista.", "Ya hay un vehículo con esta patente."
- **Empty values.** "—" in tables; a short phrase in details: "Sin cliente", "Sin cargar", "Sin trabajos", "Sin turnos".
- **Counts.** Singular and plural agree: "1 turno", "2 turnos".

**Formats**

| Data | Format | Example |
| --- | --- | --- |
| Date | dd/mm/aaaa, the only date format: never relative ("Hoy", "Ayer", "Hace 3 días"), never with month or weekday names, also inside sentences | 13/10/2026 |
| Time | 24 h | 08:30 ("08:30 hs" inside sentences) |
| Money | pesos, dot thousands; optional decimals with a comma, up to 2, shown only when entered | $ 605.000 · $ 12.500,50 |
| Kilometers | dot thousands + "km" | 112.500 km |
| DNI | up to 8 digits, dot thousands | 28.456.123 |
| Phone | 10 digits, area code first, formatted as typed | 11 1234-5678 · 221 123-4567 |
| Plate | uppercase, spaced | AB 123 CD, ABC 123 |

**Stored values.** Plates are stored uppercase without spaces; DNI as digits only. The database normalizes both on write. Phones are stored already formatted ("11 1234-5678"): the app formats them as they are typed and on save.

## Accessibility

WCAG 2.1 AA on every page. In practice:

- Everything works with the keyboard alone, with a visible focus ring.
- Every input has a visible label. Icon-only buttons have an accessible name ("Cerrar", "7 días siguientes", "Descartar cliente nuevo").
- Status is never conveyed by color alone: badges have text and calendar cards expose their status to screen readers.
- Text and badges meet AA contrast against their background.
- Modals trap focus, close with Esc and return focus to what opened them.
- Dropdowns and popovers support arrow keys and Enter, and close with Esc or a click outside.
- List ranges ("Mostrando 1–25 de 140"), toasts and calendar range changes are announced to screen readers.
- Sortable table headers announce their sort direction.
- Changing page moves focus to the new page title.
- Field errors are linked to their field; on save, focus moves to the first error.
- Animations respect the reduced-motion setting.
- Loading regions are announced once ("Cargando…") and marked `aria-busy` (see [Loading](#loading)).

## Layout and navigation

- **Pages and addresses:** Ingresar (`/login`), Inicio (`/inicio`), Vehículos (`/vehiculos`), Clientes (`/clientes`), Turnos (`/turnos`), Trabajos (`/trabajos`), Servicios (`/servicios`). Each page has its own address; the browser's Back button works.
- **Header:** logo + the shop's name on the left (the name stored in the database for the shop ID in the user's session token); the logged-in user's name and "Cerrar sesión" on the right. It scrolls away with the page; it is not fixed.
- **Navbar:** floating bar fixed at the bottom center, always visible, with an icon and label per page: Inicio, Vehículos, Clientes, Turnos, Trabajos, Servicios. The current page is highlighted (dark fill). Every page leaves enough bottom space that nothing is hidden behind it.
- **Content width:** max 1280px, centered, identical on every page. The scrollbar space is always reserved so changing pages never shifts the layout.
- **Page top:** page title, a one-line summary below it, and the page's main button on the right ("Agregar vehículo", "Nuevo turno", …). On list pages the summary is the total (active + archived) and the archived count, always both: "15 servicios en total, 1 archivado." · "1 servicio en total, 0 archivados."
- **No global search.** Each page searches its own records.

## Shared patterns

### List pages

- Toolbar: search, filters, "Mostrar archivados" switch (off by default), active filters as removable chips. No result count in the toolbar: the pagination line under the table already says how many match.
- **Filters** (Trabajos): each is a toolbar button that opens a small panel. A checklist filter shows the number of records each choice would list for the current search and archived switch (not for its own selection); a date filter has "Desde" and "Hasta" days, either optional, both included, and a "Desde" after "Hasta" shows its error and is not applied. A filter that is applied shows "Limpiar" in its panel, which clears only that filter. Active filters appear as removable chips ("Entregado", "Actualizado: 01/09/2026 al 30/09/2026"), changing any filter returns to page 1, and an empty result offers "Limpiar búsqueda y filtros". An applied filter's panel ends with a "Limpiar" button that clears just that filter.
- Table: every column sortable by clicking its header (click again to reverse). Text left-aligned, numbers right-aligned, plate drawing centered in its own column; a header aligns like its column. Clicking a row opens its detail modal. On narrow screens the table scrolls sideways, and the column that holds the record's name keeps a minimum width so the name stays readable.
- Dates in table cells are dd/mm/aaaa in secondary text color, on one line.
- Column headers look different from rows so nobody mistakes them for data: smaller, medium weight, secondary text color (see [Typography](#visual-identity)). Every sortable header always shows an up/down arrow icon after its label, so it reads as clickable in both directions. The sorted column's header switches to text color and its icon becomes a single arrow pointing the current direction (up A–Z / ascending, down Z–A / descending).
- Lists open with no column sorted: every header is in secondary text with its up/down icon, and rows come in the page's default order (set in its spec). The first click on a header sorts by it ascending; clicking it again reverses it; clicking another header sorts by that one ascending.
- Lists and tables over cards.
- States: a loading skeleton whenever data loads, including every search, sort and page change (see [Loading](#loading)); an error message with "Reintentar" if it fails; an empty state with a title, a hint and a way out ("No encontramos vehículos" · "Probá con otra patente…" · "Borrar búsqueda").
- Pagination is standard on every list: 25 rows per page, loaded from the server one page at a time, never the whole table. Controls under the table: "Mostrando 1–25 de 140" on the left; "Anterior", page numbers and "Siguiente" on the right. Search, filters and sorting apply to the full data set on the server; changing any of them returns to page 1.

### Loading

Mandatory on every page, modal and component that loads data.

- While data loads, a **skeleton** shows the shape of what's coming: grey blocks (muted fill) in the place and size of the final content, so nothing jumps when it arrives. A list shows its toolbar and table header plus placeholder rows; a modal shows its header and label/value placeholders.
- **A list shows its skeleton every time it loads, not only the first.** Searching, sorting, paging, toggling "Mostrar archivados" and "Reintentar" all replace the table's rows with placeholder rows until the new ones arrive, so the user sees that something is happening; the old rows never linger as if nothing had changed. The toolbar (with the text being typed) and the table header (with its sort buttons, so the keyboard focus isn't lost) stay in place, and the pagination line returns with the results. Applies to every list page, present and future.
- Static parts that need no data (page title, buttons, labels) render right away; only the data is a skeleton.
- The blocks pulse gently; with reduced motion they stay still.
- Screen readers hear one "Cargando…" for the region (`aria-busy`), not each block.
- Spinners are only for an action in progress inside a button ("Ingresando…"), never for loading a page or a list.

### Calendar

A page that is a calendar (Turnos; [Inicio](#inicio) reuses its week) is not a list: no search, no pagination, no archived switch.

- **Header:** the period as title in dd/mm/aaaa, never with month names ("01/10/2026 al 31/10/2026" for a month, "12/10/2026 al 18/10/2026" for a week); a "Mes / Semana" toggle (month by default), "Hoy" (disabled when the view already holds today) and previous / next arrows (a month, or 7 days). The weekday labels over the month grid are column headers, not dates.
- **Month:** Monday-first grid, days of other months greyed, today with a dark circle on its number. Days are tall (a day is a target, not a number) and the pointer is a hand over the whole day. A record is one line (time in bold + its name, cut with "…" when it doesn't fit) styled by status; a day shows 3, then "+N más" opens a popover titled with the day's date that lists them all and closes with its X, Esc, a click outside or scrolling. **Week:** today and the next 6 days; a day lists 5 records, then "+N más" with the same list.
- **Creating:** clicking an empty part of a day, or its "+" button (visible on hover or keyboard focus), opens the form on that day. After saving, the calendar goes to the saved record's day.
- **State in the URL:** `?vista=semana&fecha=2026-10-12` (both absent at their defaults). Only the visible days are loaded, with the calendar's skeleton and an error with "Reintentar".
- **Modal chain:** a record opened from a day's "+N más" list has no "Volver" (going back would only close the modal): closing the modal, with the X or after an action, leaves the list open again with the focus on the record.

### Inicio

The home page is two existing screens on one page, with the title "Inicio", a summary ("3 turnos en los próximos 7 días, 12 trabajos abiertos.": today and the next 6 days, Cancelado left out, and the active jobs that are not Entregado or Cancelado), and no buttons in its header: "Nuevo turno" is on the right of the "Turnos" heading and "Nuevo trabajo" on the right of the "Trabajos" heading. Everything on it works exactly as on Turnos and Trabajos, with their modals and actions.

- **"Turnos":** the calendar's week view (today and the next 6 days) without the "Mes / Semana" toggle. The week is not kept in the URL (the jobs list owns the address bar), so a reload returns to today's week.
- **"Trabajos":** the Trabajos table with the search and the Estado filter, and without the Fecha filter and the archived switch (archived jobs are never listed). With nothing ticked it lists every job that is not Entregado or Cancelado, whatever its age. The Estado dropdown still lists all seven statuses; "Entregado (últ. 30 días)" and "Cancelado (últ. 30 días)" add the jobs in those statuses last updated in the last 30 days (today and the 29 before it, Argentina time), and their counts cover only that window. A ticked one is a chip with the same text. The window is applied on the server, never taken from the URL.
- **Empty:** with no open jobs and nothing searched: "No hay trabajos abiertos" · "Los trabajos pendientes o en curso aparecen acá." · "Nuevo trabajo".

### Search

Filters as you type. Ignores case and accents, and also matches with spaces, dots and dashes removed ("ae 482", "AE482", "suarez", "35.123.456"). Search always includes archived records: while the search box has text, matching archived records are listed too (greyed, with the "Archivado" badge) even with "Mostrar archivados" off. Encrypted fields are searched through the `search_text` column of the decrypted views (see [architecture.md](architecture.md#sensitive-data)).

### Detail modal

- Header: title (record identity), its badges (status, "Archivado"), subtitle, then the X.
- Body: label/value pairs, then related lists. A tall modal scrolls inside the window; its header and footer stay.
- Footer: "Creado el dd/mm/aaaa" in small grey text on the left; on the right "Volver" (when the modal was opened from another modal), then the actions — "Archivar" / "Desarchivar" and "Editar …". A modal with a form shows its own footer ("Cancelar" / "Guardar").
- **Editable status:** where a job's status shows as a pill (list rows, the job modal header) it is a dropdown of the seven statuses in the neutral style, not each status' color, unless the job is closed or archived. Changing it follows the form's rules (final prices fill or clear with the phase, closing asks first) and confirms with a toast. The dropdown arrow is inside the pill; a closed job's pill has a lock inside instead, with no text hint.
- The X always closes every modal in the chain.

### Modal to modal

A modal opened from another modal (client → vehicle, vehicle → job, appointment → job) has "Volver", which returns to the previous modal with focus on the item you came from. Once an action succeeds the whole chain closes (see [Modals](#modals)).

### Modals

**Every action closes the modal.** Creating, editing, archiving, unarchiving and assigning one record to another (a vehicle to a client, a client to a vehicle) all end the same way, on every page and in every modal, present and future:

- When the action succeeds the modal closes (the whole chain, if it was opened from another modal), a toast confirms ("Cliente agregado" · name) and the list behind refreshes. The detail modal does not open afterwards.
- When it fails the modal stays open: field errors under their fields, or an error message for the whole form.
- Only moving around doesn't close: "Cancelar" and "Volver" go back one step (or close, for a form opened from a list), and an edit that changed nothing goes back to the detail without a request or a toast.
- A result that needs the user's attention keeps the modal open to say so: assigning several vehicles when some already had a client assigns the rest, toasts, and stays on the step with "Algunos vehículos ya tenían un cliente."

### Forms

- Open inside the same modal. Subtitle "Los campos con \* son obligatorios."; in edit mode the record name goes above it.
- **Two columns.** From the `sm` breakpoint up, fields sit two to a row (Nombre next to Apellido, Teléfono next to DNI, Patente next to Año, Marca next to Modelo); below it they stack. A field that takes a long value (an email, a free text, a searchable dropdown with long options) is alone in its row, full width. The modal keeps its width; the rows do the work.
- **Each field is only as wide as its longest value.** A four-digit year is not as wide as an email: year, plate, DNI, phone and VIN get a width that fits their maximum length, and names stay at half a row. Use the shared widths (`FIELD_WIDTH` in `components/shared/form-layout.tsx`) and add one there for a new kind of value, never an ad hoc width in a form. A repeated line (a job's services) takes its columns from `LINE_ITEM_COLUMNS` in the same file.
- Errors inline under each field on save; focus moves to the first error (in the order you see them, row by row).
- Footer: "Cancelar" + primary action ("Agregar …" / "Guardar cambios"). Cancel in edit mode returns to the detail modal; in add mode it closes or returns to the step that opened it.
- After saving the modal closes and a toast confirms (see [Modals](#modals)).
- No "enabled" switch in forms; archiving is an action (below).

### Searchable dropdowns

Every pick from a list (brand, model, client, vehicle, service) is a field you type into to filter. Arrow keys + Enter select. Options show main text + grey secondary when needed to tell them apart (plate for vehicles, phone for clients); once picked the field shows "Fiat Cronos (AD 915 TB)". Text that doesn't match an option is rejected on save ("Elegí … de la lista.").

### Quick create inside a dropdown

The last option is always "+ Crear … nuevo", except in the job and appointment forms, which have no quick create: a job's or an appointment's client is the vehicle's owner, a job's services come from the catalog and its vehicle is picked from the existing ones. It hides the dropdown and opens an inline "… nuevo" section in the same form, with an X to discard it. Text the user typed is carried over (a name to Nombre/Apellido, a number to Teléfono or Patente); a value picked from the list is not. One save creates both records with one toast.

### Archive

Vehicles, clients, jobs and services are archived, never deleted. Archiving sets `enabled = false`; the UI never shows the word "habilitado". Appointments are the exception in the app: they have no archive action and no archived state on screen; a booking that won't happen is Cancelado (and can be reactivated).

- "Archivar" is in the detail modal header, next to "Editar". It always asks for confirmation: "¿Archivar este vehículo?" + "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras." + "Cancelar" / "Archivar".
- Archived records show an "Archivado" badge and greyed rows; "Desarchivar" restores them immediately, without confirmation.
- **Standard for every archivable entity** (the archive case of [Modals](#modals)): once archiving (after its confirmation) or unarchiving succeeds, the detail modal closes and a toast confirms ("Cliente archivado" · name). The list refreshes behind it. If the action fails the modal stays open with an error toast. Cancelling the confirmation changes nothing and keeps the modal open.
- New records always start active.

### Confirmations

Asked before: archiving, cancelling an appointment, setting a job to Entregado or Cancelado, and renaming a service that is already on jobs. Not asked for reversible changes (confirming an appointment, changing a job to an open status, unarchiving).

### Toasts

Bottom right, about 3 seconds, after every save or status change: title + one line ("Turno agregado" · "Fiat Cronos, 14/10/2026 a las 09:00 hs.").

## Global business rules

Rules marked **(DB)** are also enforced by the database; the app must still prevent them in the UI and map the database error to a message.

### Job statuses

Seven, in this order (also their sort order): Pendiente, Presupuesto enviado, Presupuesto aceptado, En progreso, Completado, Entregado, Cancelado (`pendiente`, `presupuesto_enviado`, `presupuesto_aceptado`, `en_progreso`, `completado`, `entregado`, `cancelado`).

- Any status can be set at any time; no transition order is enforced.
- New jobs start as Pendiente.
- Usual flow: Pendiente → Presupuesto enviado → Presupuesto aceptado → En progreso → Completado → Entregado. Cancelado can happen at any point; a rejected quote is recorded as Cancelado.
- **Quote phase:** Pendiente (not quoted yet), Presupuesto enviado, Presupuesto aceptado. **Work phase:** En progreso, Completado, Entregado. A cancelled job keeps the prices of the phase it was in.
- **Closed:** Entregado and Cancelado. Once saved, a closed job can never be edited again (the shop asked for this explicitly), nor can its items. It can still be archived. **(DB)**
- Every status change is recorded in the job's status history with the previous status, new status, user and date/time. The history can't be edited. **(DB)**

### Appointment statuses

Pendiente, Confirmado, Completado, Cancelado (`pendiente`, `confirmado`, `completado`, `cancelado`). New appointments start as Pendiente. Completado is set manually, never by the job. Cancelled appointments can be reactivated (back to Pendiente). Any appointment can still be edited, whatever its status.

The appointment's status is a pill in its modal's header that works like a job's: it opens a dropdown with the four statuses and any of them can be chosen at any time (the list is in the app's neutral style, and a toast confirms: "Turno confirmado", "Turno completado", "Turno cancelado", "Estado actualizado" for Pendiente). Cancelling asks first (also from the edit form); the other changes are reversible and ask nothing. The footer has only "Editar turno" (and "Creado el").

A job can be created from an appointment ("Crear trabajo"): it takes the appointment's vehicle, its vehicle's owner as client, the reason as observations and the latest recorded km, with no services and status Pendiente. It is hidden for a cancelled appointment and disabled while the vehicle is archived. An appointment shows its latest non-archived job ("Ver trabajo") instead.

### Prices

1. Each service in a job has a quoted unit price (required) and a final unit price.
2. In the quote phase only the quoted price is shown and edited.
3. In the work phase, the quoted price of existing services is read-only (it's what the client accepted) and a final price appears, prefilled with the quoted one. It's only edited if the price changed.
4. Services added during the work phase still need a quoted price; their final price starts as a copy of it.
5. Quoted total = Σ quantity × quoted unit price, always. Final total = Σ quantity × final unit price, in the work phase only. Both are calculated by the app, live in the form, and saved with the job.
6. Lists show the final total labelled "Final" when it exists, otherwise the quoted total labelled "Presupuestado".

Services carry no price; prices are set per job item.

### Sending the quote

"Enviar presupuesto" sits on the right of the "Servicios" heading in the job modal's view (editable or read only, so also on Inicio); it is not in the edit form. It opens the client's WhatsApp chat (the same link rule as the "WhatsApp" button) with the quote already written, and the user taps Send. It never changes the job: no status change, no history entry, no toast; the shop updates the status by hand.

- **Enabled** for Pendiente, Presupuesto enviado, Presupuesto aceptado and Cancelado (so a rejected quote can be resent after a change), when the job has a client with a phone and at least one service. The reason it is disabled shows in a tooltip (hover, keyboard focus on its wrapper) and is linked with `aria-describedby`; the first failing row wins: "No disponible en este estado", "Cargá un cliente con teléfono", "Cargá al menos un servicio". While the services load it is disabled with no reason; if they fail to load it is not shown.
- **Archived job, client or vehicle:** clicking asks first ("Hay registros archivados", one line per archived record, "Cancelar" / "Confirmar"); only "Confirmar" opens the chat.
- **Message** (Spanish, voseo; real line breaks; built from the saved job): "Hola {first name}, te paso el presupuesto para tu {brand} {model} ({plate}):", one bullet per service in saved order ("• {service}: {line total}", with "(xN)" only when N > 1; archived services by their plain name), "Total: {quoted total}", "Cualquier duda avisanos. ¡Gracias!" and "— {shop name}" (the name in the top bar; left out if missing). Quoted prices only, never the final ones, in the app's money format.
- Look: the shared WhatsApp button's (token colors, 28 px high) with a paper-plane icon; disabled it is muted at 70% opacity.

### Kilometers

A job's km is prefilled with the vehicle's latest recorded km (from its previous jobs). It can't be lower than that value. **(DB)** If the vehicle has no previous km, any whole number ≥ 0 is accepted.

### Clients on records

- Vehicles: optional owner.
- Appointments: the client is the vehicle's owner at the moment the appointment is created. Nobody picks it (the form shows it read only). It stays while the appointment's vehicle does, even if the owner changes later, and follows the new vehicle's owner when an edit changes the vehicle. An archived owner stays and shows as "(Archivado)".
- Jobs: the vehicle's owner, or none. Nobody picks it (the job form shows it read only). An archived owner can't be put on a new job, so the job is saved with no client and the form says so beforehand; a job that already has it keeps it.
- An archived client stays linked to their vehicles and shows as "Nombre Apellido (Archivado)" wherever a vehicle shows its client. Archiving a client never changes their vehicles.

### Archived records

- Archived vehicles can't get new appointments or jobs. **(DB)**
- Archived clients can't be picked for new jobs **(DB)**; they stay selectable as vehicle owners, labelled "(Archivado)".
- Archived services can't be added to jobs **(DB)**; jobs that already use them keep them.

### Uniqueness (per shop)

Plate per vehicle. DNI per client, when given. **(DB)**

Service name, compared the way search compares (ignoring case, accents, spaces, dots and dashes). Checked by the app only, on save; a duplicate from two simultaneous saves is accepted.

Every uniqueness check compares against active and archived records alike; the error says when the match is archived ("Ya hay un servicio archivado con este nombre.").
