# Torque — Design

How the app looks and behaves. Every page follows these conventions; each page's own behavior is defined in its spec in `specs/`. Code-level rules (tokens, components, data access) are in [conventions.md](conventions.md); the data model is in [db_schema.sql](../db_schema.sql).

## Principles

- **Vehicle-centric.** The vehicle is the main record. Clients, appointments and jobs hang off it. A client is an optional contact attached to vehicles.
- **One shop per account.** Users only see their own shop's data.
- **Desktop-first.** Designed for a computer at the shop's front desk. Smaller screens must still work (stacked layouts, tables scrolling sideways).
- **Spanish only.** All UI text in Spanish (Argentina).
- **Time zone:** fixed to Argentina (UTC−3) for every date and time, including "Hoy", "Ayer" and relative dates.
- **Nothing is deleted.** Records are archived instead (see [Archive](#archive)).

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

**Job status colors.** Badge = tinted fill + dark text + colored dot.

| Status | Fill | Text | Dot |
| --- | --- | --- | --- |
| Pendiente | #FFFBEB | #92400E | #F59E0B |
| Presupuesto enviado | #EFF6FF | #1E40AF | #3B82F6 |
| Presupuesto aceptado | #ECFEFF | #155E75 | #06B6D4 |
| En progreso | #F5F3FF | #5B21B6 | #8B5CF6 |
| Completado | #F0FDF4 | #166534 | #22C55E |
| Entregado | #F8FAFC | #1E293B | #334155 |
| Cancelado | #FEF2F2 | #991B1B | #EF4444 |

**Appointment status colors.** Calendar cards have a 4px left edge in the status color.

| Status | Card | Badge (fill / text / dot) |
| --- | --- | --- |
| Pendiente | White card, edge #F59E0B | #FFFBEB / #92400E / #F59E0B |
| Confirmado | White card, edge #22C55E | #F0FDF4 / #166534 / #22C55E |
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

Numbers (money, km, times, DNI) use tabular figures so columns align.

**Shape and spacing.** Panels and modals 10–12px corner radius; buttons and inputs 34–36px tall, 8px radius; badges fully rounded. Page padding 32px (16px on small screens), 24px between panels. Shadows only on floating elements: navbar, modals, popovers, dropdown lists, toasts.

**Plates.** In tables and modal titles the plate is drawn as an Argentine Mercosur plate: white, black border, blue top band, bold spaced characters ("AB 123 CD"). Old-format plates ("ABC 123") use the same drawing. In calendar cards, dropdowns and running text the plate is plain text.

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
| Date | dd/mm/aaaa | 13/10/2026 |
| Short date | day + short month + year | 28 sept 2026 |
| Recent date (< 7 days) | relative | Hoy 10:24, Ayer, Hace 3 días |
| Time | 24 h | 08:30 ("08:30 hs" inside sentences) |
| Money | pesos, dot thousands; optional decimals with a comma, up to 2, shown only when entered | $ 605.000 · $ 12.500,50 |
| Kilometers | dot thousands + "km" | 112.500 km |
| DNI | dot thousands | 28.456.123 |
| Plate | uppercase, spaced | AB 123 CD, ABC 123 |

**Stored values.** Plates are stored uppercase without spaces; DNI as digits only. The database normalizes both on write.

## Accessibility

WCAG 2.1 AA on every page. In practice:

- Everything works with the keyboard alone, with a visible focus ring.
- Every input has a visible label. Icon-only buttons have an accessible name ("Cerrar", "7 días siguientes", "Descartar cliente nuevo").
- Status is never conveyed by color alone: badges have text and calendar cards expose their status to screen readers.
- Text and badges meet AA contrast against their background.
- Modals trap focus, close with Esc and return focus to what opened them.
- Dropdowns and popovers support arrow keys and Enter, and close with Esc or a click outside.
- Result counts, toasts and calendar range changes are announced to screen readers.
- Sortable table headers announce their sort direction.
- Changing page moves focus to the new page title.
- Field errors are linked to their field; on save, focus moves to the first error.
- Animations respect the reduced-motion setting.

## Layout and navigation

- **Pages and addresses:** Ingresar (`/login`), Inicio (`/inicio`), Vehículos (`/vehiculos`), Clientes (`/clientes`), Turnos (`/turnos`), Trabajos (`/trabajos`), Servicios (`/servicios`). Each page has its own address; the browser's Back button works.
- **Header:** logo + the shop's name on the left (the name stored in the database for the shop ID in the user's session token); the logged-in user's name and "Cerrar sesión" on the right. It scrolls away with the page; it is not fixed.
- **Navbar:** floating bar fixed at the bottom center, always visible, with an icon and label per page: Inicio, Vehículos, Clientes, Turnos, Trabajos, Servicios. The current page is highlighted (dark fill). Every page leaves enough bottom space that nothing is hidden behind it.
- **Content width:** max 1280px, centered, identical on every page. The scrollbar space is always reserved so changing pages never shifts the layout.
- **Page top:** page title, a one-line summary below it, and the page's main button on the right ("Agregar vehículo", "Nuevo turno", …).
- **No global search.** Each page searches its own records.

## Shared patterns

### List pages

- Toolbar: search, filters, "Mostrar archivados" switch (off by default), active filters as removable chips, result count on the right ("3 de 12 vehículos").
- Table: every column sortable by clicking its header (click again to reverse). Text left-aligned, numbers right-aligned, plate drawing centered in its own column. Clicking a row opens its detail modal.
- Lists and tables over cards.
- States: a loading indicator while data loads; an error message with "Reintentar" if it fails; an empty state with a title, a hint and a way out ("No encontramos vehículos" · "Probá con otra patente…" · "Borrar búsqueda").
- Pagination is standard on every list: 25 rows per page, loaded from the server one page at a time, never the whole table. Controls under the table: "Mostrando 1–25 de 140" on the left; "Anterior", page numbers and "Siguiente" on the right. Search, filters and sorting apply to the full data set on the server; changing any of them returns to page 1.

### Search

Filters as you type. Ignores case and accents, and also matches with spaces, dots and dashes removed ("ae 482", "AE482", "suarez", "35.123.456"). Encrypted fields are searched through the `search_text` column of the decrypted views (see [architecture.md](architecture.md#sensitive-data)).

### Detail modal

- Header: title (record identity), subtitle, then the actions on the right — "Archivar" / "Desarchivar" and "Editar …" — then the X. Actions are at the top so users never scroll to find them.
- Body: label/value pairs, then related lists.
- Footer: "Creado el dd/mm/aaaa" in small grey text on the left; "Volver" on the right when the modal was opened from another modal; status-specific actions (appointments).
- The X always closes every modal in the chain.

### Modal to modal

A modal opened from another modal (client → vehicle, vehicle → job, day list → appointment) has "Volver", which returns to the previous modal with focus on the item you came from. It stays available after editing.

### Forms

- Open inside the same modal. Subtitle "Los campos con \* son obligatorios."; in edit mode the record name goes above it.
- Errors inline under each field on save; focus moves to the first error.
- Footer: "Cancelar" + primary action ("Agregar …" / "Guardar cambios"). Cancel in edit mode returns to the detail modal; in add mode it closes or returns to the step that opened it.
- After saving: the record's detail modal opens and a toast confirms.
- No "enabled" switch in forms; archiving is an action (below).

### Searchable dropdowns

Every pick from a list (brand, model, client, vehicle, service) is a field you type into to filter. Arrow keys + Enter select. Options show main text + grey secondary when needed to tell them apart (plate for vehicles, phone for clients); once picked the field shows "Fiat Cronos (AD 915 TB)". Text that doesn't match an option is rejected on save ("Elegí … de la lista.").

### Quick create inside a dropdown

The last option is always "+ Crear … nuevo". It hides the dropdown and opens an inline "… nuevo" section in the same form, with an X to discard it. Text the user typed is carried over (a name to Nombre/Apellido, a number to Teléfono or Patente); a value picked from the list is not. One save creates both records with one toast.

### Archive

Vehicles, clients, jobs and services are archived, never deleted. Archiving sets `enabled = false`; the UI never shows the word "habilitado".

- "Archivar" is in the detail modal header, next to "Editar". It always asks for confirmation: "¿Archivar este vehículo?" + "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras." + "Cancelar" / "Archivar".
- Archived records show an "Archivado" badge and greyed rows; "Desarchivar" restores them immediately, without confirmation.
- New records always start active.

### Confirmations

Asked before: archiving, cancelling an appointment, and setting a job to Entregado or Cancelado. Not asked for reversible changes (confirming an appointment, changing a job to an open status, unarchiving).

### Toasts

Bottom right, about 3 seconds, after every save or status change: title + one line ("Turno agregado" · "Fiat Cronos, miércoles 14 de octubre a las 09:00 hs.").

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

Pendiente, Confirmado, Completado, Cancelado (`pendiente`, `confirmado`, `completado`, `cancelado`). New appointments start as Pendiente. Completado is set manually. Cancelled appointments can be reactivated (back to Pendiente).

### Prices

1. Each service in a job has a quoted unit price (required) and a final unit price.
2. In the quote phase only the quoted price is shown and edited.
3. In the work phase, the quoted price of existing services is read-only (it's what the client accepted) and a final price appears, prefilled with the quoted one. It's only edited if the price changed.
4. Services added during the work phase still need a quoted price; their final price starts as a copy of it.
5. Quoted total = Σ quantity × quoted unit price, always. Final total = Σ quantity × final unit price, in the work phase only. Both are calculated by the app, live in the form, and saved with the job.
6. Lists show the final total labelled "Final" when it exists, otherwise the quoted total labelled "Presupuestado".

Services carry no price; prices are set per job item.

### Kilometers

A job's km is prefilled with the vehicle's latest recorded km (from its previous jobs). It can't be lower than that value. **(DB)** If the vehicle has no previous km, any whole number ≥ 0 is accepted.

### Clients on records

- Vehicles: optional owner.
- Appointments: the client is the vehicle's owner at the moment the appointment is created. It can't be changed in the appointment.
- Jobs: defaults to the vehicle's owner, can be changed to any active client or left empty.
- An archived client stays linked to their vehicles and shows as "Nombre Apellido (Archivado)" wherever a vehicle shows its client. Archiving a client never changes their vehicles.

### Archived records

- Archived vehicles can't get new appointments or jobs. **(DB)**
- Archived clients can't be picked for new jobs **(DB)**; they stay selectable as vehicle owners, labelled "(Archivado)".
- Archived services can't be added to jobs **(DB)**; jobs that already use them keep them.

### Uniqueness (per shop)

Plate per vehicle. DNI per client, when given. **(DB)**
