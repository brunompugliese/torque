# 005 — Clients page: Requirements

**Status:** Approved

## Problem

Clients (the contacts attached to vehicles) can only be created in the Supabase dashboard. Staff need to list, search, add, edit, archive and unarchive clients from the app at `/clientes`, see each client's vehicles, and attach vehicles that have no owner yet.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access: anyone in the shop can manage its clients.

## User stories

- As a staff member, I want to see the shop's clients in a sortable, searchable list, so that I can find one quickly.
- As a staff member, I want to search by name, surname, DNI, phone or email, so that I can find a client with whatever the customer tells me.
- As a staff member, I want to add and edit a client's data, so that I can reach them about their vehicle.
- As a staff member, I want to open a client's WhatsApp chat from the app, so that I don't copy the number by hand.
- As a staff member, I want to see which vehicles a client has, so that I know what they own.
- As a staff member, I want to attach a vehicle that has no owner to a client, so that the vehicle record is complete.
- As a staff member, I want to archive a client who no longer comes, so that they stop cluttering the list while their vehicles keep them.
- As a staff member, I want to be told when a DNI is already taken, even by an archived client, so that a client isn't duplicated.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (list pages, search, detail modal, modal to modal, forms, archive, confirmations, toasts, uniqueness) and reuses the list-page kit built in [spec 004](../004-services/requirements.md). The criteria below are what this page adds or must specifically verify.

Page and list

- [ ] Given `/clientes`, when it loads, then it replaces the placeholder and shows the title "Clientes", the summary "N clientes en total, M archivados." (N counts active and archived; singular and plural agree, "0 archivados" is always shown, e.g. "1 cliente en total, 0 archivados.") and the "Agregar cliente" button.
- [ ] Given the list, when it loads, then it has five columns: "Cliente" (name + surname, and an "Archivado" badge on archived rows), "DNI" (dot thousands, tabular figures), "Teléfono" (as entered), "Email" and "Creado el" (styled per design.md's table date standard). An empty DNI, phone or email shows "—"; an empty surname shows only the name.
- [ ] Given the list, when it loads, then no header is marked as sorted and rows come A–Z by name and then surname, ignoring case and accents.
- [ ] Given any of the five headers, when clicked, then the list sorts by it ascending on the first click ("Creado el" oldest first), reverses on the second, and the header shows the sorted look and announces its direction, per design.md.
- [ ] Given a sort by DNI, when it runs, then DNIs sort by numeric value (a 7-digit DNI comes before an 8-digit one), not as text.
- [ ] Given a sort by DNI, Teléfono or Email, when some clients have no value, then those clients come last in both directions.
- [ ] Given more than 25 clients, when the list shows, then it is paginated, searched and sorted on the server over the whole table, per the shared pattern.
- [ ] Given the toolbar, when it shows, then it has only the search box (placeholder "Buscar por nombre, apellido, DNI, teléfono o email") and the "Mostrar archivados" switch; there are no filters and no result count.
- [ ] Given loading, an error or no results, when the list shows, then it shows the shared states. No results for a search: "No encontramos clientes" · "Probá con otro nombre, DNI, teléfono o email." · "Borrar búsqueda". No clients at all: "Todavía no hay clientes" · "Agregá el primero para asociarlo a sus vehículos." · "Agregar cliente".
- [ ] Given a row, when it is clicked (or activated with the keyboard), then the client modal opens.

Search

- [ ] Given a search term, when typed, then clients whose name, surname, DNI, phone or email match are listed, ignoring case, accents, spaces, dots and dashes ("35.123.456" and "35123456" find the same DNI; "1112345678" finds "11 1234-5678").
- [ ] Given a search term and "Mostrar archivados" off, when archived clients match, then they are listed too, greyed and with the "Archivado" badge.

Client modal

- [ ] Given a client, when its modal opens, then it shows instantly from the row already loaded with the list; the header shows name + surname (+ "Archivado" badge) and the actions "Archivar" / "Desarchivar" and "Editar cliente".
- [ ] Given a client, when its modal opens, then the body shows "DNI" (dot thousands, or "Sin cargar"), "Teléfono" and "Email" (or "Sin cargar").
- [ ] Given the phone, when shown, then it is plain text as entered (no call link), with an icon-only button next to it: the WhatsApp icon in a WhatsApp green token (AA non-text contrast in light and dark), no visible text, accessible name "Escribir por WhatsApp", that opens `https://wa.me/<number>` in a new tab (`rel="noopener noreferrer"`). The button always shows, whatever the phone is. The number is built from the phone like this: digits only, leading zeros dropped, and `549` added unless it already starts with `54`. This rule is a first version, to be adjusted from real use.
- [ ] Given a client, when its modal opens, then the footer shows "Creado el dd/mm/aaaa" (Argentina time).
- [ ] Given the client modal, when it opens, then "Vehículos" loads the client's vehicles with the shared skeleton (`aria-busy`, one "Cargando…") in the final sizes, and shows them in the order the database returns, without pagination.
- [ ] Given a vehicle row, when shown, then it has the plate drawn as a plate, brand + model, year (secondary color), VIN or "Sin VIN" (secondary color) and an "Archivado" badge if archived. Rows are not clickable and have no arrow until the Vehículos page exists.
- [ ] Given a client with no vehicles, when the modal shows, then the list says "Este cliente todavía no tiene vehículos."

Plate drawing

- [ ] Given a plate, when drawn by the shared `PlateDisplay`, then it is white with a black border, the blue top band (`--plate-band`) and bold spaced characters: "AB123CD" as "AB 123 CD" and "ABC123" as "ABC 123"; any other value is shown uppercase as stored. It works in light and dark themes and exposes the plate as text to screen readers.

Add vehicle from a client

- [ ] Given "Agregar vehículo" in the client modal, when clicked, then a first step shows two large rows: "Asignar un vehículo existente" and "Crear un vehículo nuevo". Only one flow is shown at a time.
- [ ] Given the first step, when it shows, then "Crear un vehículo nuevo" is greyed out and not actionable, with the subtitle "Próximamente", until the Vehículos spec builds the vehicle form.
- [ ] Given the first step, when it opens, then it loads the vehicles with no client once, with the shared skeleton (`aria-busy`, one "Cargando…"), and "Asignar un vehículo existente" shows the subtitle "Vehículos sin cliente" (no count). With none, the row is greyed out with "No hay vehículos sin cliente".
- [ ] Given "Asignar un vehículo existente", when clicked, then it lists the vehicles with no client (archived ones included with their badge) in the order they came, five per page, each with a checkbox, the plate drawing, brand + model, year and VIN, plus "Anterior" / "Siguiente" and a "Mostrando 1–5 de N" line. Each checkbox has an accessible name (the plate and the brand + model) and the whole row toggles it.
- [ ] Given that list, when it shows, then it has a search box ("Buscar por patente, marca, modelo o VIN") that filters it in memory, ignoring case, accents, spaces, dots and dashes, and returns to page 1; it makes no request. No matches: "No encontramos vehículos" and "Borrar búsqueda".
- [ ] Given selected vehicles, when the user searches or changes page, then the selection is kept, and the button shows how many are selected: "Asignar vehículo" for one or none, "Asignar N vehículos" for several.
- [ ] Given no selection, when the button is clicked, then "Elegí al menos un vehículo." shows.
- [ ] Given a selection, when the button is clicked, then every selected vehicle's client becomes this client in one request, the client modal reopens with them listed and a toast confirms: "Vehículo asignado" · "<plate>" for one, "Vehículos asignados" · "N vehículos" for several.
- [ ] Given an archived client, when assigning, then it works like for an active one (archived clients stay valid owners).
- [ ] Given selected vehicles that got a client meanwhile, when the user assigns, then those are not overwritten, the others are assigned, and the step shows "Algunos vehículos ya tenían un cliente." (or "Este vehículo ya tiene un cliente." when it was the only one) and refreshes its list.
- [ ] Given any step, when "Volver" is clicked, then it goes back one step, ending at the client modal.

Add

- [ ] Given "Agregar cliente", when clicked, then a modal titled "Agregar cliente" opens with the form, the subtitle "Los campos con * son obligatorios." and the footer "Cancelar" (closes) / "Agregar cliente".
- [ ] Given the form, when it shows, then it has: "Nombre *" (text), "Apellido" (text), "Teléfono *" (phone keyboard, placeholder "11 1234-5678"), "DNI" (numeric keyboard) and "Email" (email keyboard).
- [ ] Given a valid form, when saved, then the client is created active, its modal opens and a toast "Cliente agregado" · "<name surname>" confirms.

Edit

- [ ] Given "Editar cliente", when clicked, then the modal content is replaced by the form titled "Editar cliente", with the client name above the subtitle and the fields prefilled (DNI without dots); the footer is "Cancelar" (back to the client modal) / "Guardar cambios".
- [ ] Given a valid edit, when saved, then the modal returns to the client with the changes and a toast "Cambios guardados" · "<name surname>".
- [ ] Given an archived client, when edited, then it can be edited like an active one.
- [ ] Given an edit with no changes (after normalization), when saved, then the modal goes back to the client without a request or a toast.

Validation and uniqueness

- [ ] Given an empty or whitespace-only name, when saved, then "Ingresá el nombre." shows under Nombre and focus moves there. Same for the phone: "Ingresá el teléfono.".
- [ ] Given the text fields, when saved, then name and surname are trimmed with inner runs of spaces collapsed to one, the phone is trimmed and loses hyphens (other characters stay as entered), and an empty surname, DNI or email is stored as null. No length limits.
- [ ] Given a DNI, when saved, then dots and spaces are ignored and it is stored as digits; anything else that is not a digit shows "Revisá el DNI.".
- [ ] Given an email, when saved, then it is trimmed and must have a valid format: "Revisá el formato del email.".
- [ ] Given a DNI that another client of the shop already has, when saved, then "Ya hay un cliente con este DNI." shows under DNI; if that client is archived, "Ya hay un cliente archivado con este DNI.". An edit that keeps the client's own DNI doesn't clash with itself.
- [ ] Given the same input sent directly to the server, when the server action runs, then it applies the same Zod schema and the DNI uniqueness (enforced by the database).

Archive and unarchive

- [ ] Given "Archivar", when clicked, then a confirmation asks "¿Archivar este cliente?" + "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras. Sus vehículos no cambian y lo siguen mostrando como “(Archivado)”." + "Cancelar" / "Archivar".
- [ ] Given the confirmation, when "Archivar" is confirmed, then the modal shows the "Archivado" badge and "Desarchivar", and a toast "Cliente archivado" · "<name surname>" confirms. The client's vehicles don't change.
- [ ] Given an archived client, when "Desarchivar" is clicked, then it is restored immediately, without confirmation, with a toast "Cliente desarchivado" · "<name surname>".

Loading

- [ ] Given `/clientes` while its data loads, when it shows, then the title and "Agregar cliente" render right away, and the summary and the table show a skeleton in the final sizes, so nothing shifts.

Accessibility

- [ ] Given the page and its modals, when used, then they meet design.md's accessibility rules: keyboard-only operation with a visible focus ring, focus trapped in modals and returned to what opened them, sort direction announced, field errors linked to their fields with focus on the first error, toasts and the pagination range announced, text and the WhatsApp icon at AA contrast, and animations still with reduced motion.
- [ ] Given every skeleton (list, vehicles in the modal, vehicles to assign), when inspected, then its region is `aria-busy`, announces "Cargando…" once, and doesn't pulse with reduced motion on.

Reuse and standardization

- [ ] Given the page, when built, then it reuses the list-page kit from spec 004 (`DataTable`, `ListToolbar`, `PaginationBar`, list states, `DetailModal`, `ConfirmDialog`, `ArchivedBadge`, `useListUrl`, `useListResults`, `applyListQuery`, `lookups`, `ActionResult`) and extends it only where this page needs it (nulls last when sorting; a numeric sort). Anything new that another page can use (`PlateDisplay`, the in-memory filter and pager, the phone and DNI field rules, the WhatsApp link builder) lives in `components/shared/` or `lib/`, is generic and has its own Vitest tests.

Isolation and database

- [ ] Given two shops, when a user of one lists, searches, reads, edits or assigns vehicles to clients, then they never see or change the other shop's data (existing RLS, covered again for any new view column).
- [ ] Given the client list, when sorted by name, then the database provides the sort key (`name_key` on `client_decrypted`, `normalize_search` of name and surname), so sorting never depends on how the encrypted values look.
- [ ] Given vehicle rows, when read, then the database provides the brand and model names on `vehicle_decrypted`, so the app doesn't join the catalogs by hand.
- [ ] Given personal data, when handled, then it is never logged and never put in the URL (conventions.md); the URL holds only the search text, sort and page, like Servicios.

## Out of scope

- A "Último trabajo" column: replaced by "Creado el" (decided with the owner).
- A call (`tel:`) link on the phone.
- The vehicle form, the vehicle modal, the Vehículos page, and therefore "Crear un vehículo nuevo" and opening a vehicle from a client (arrive with the Vehículos spec).
- Jobs and appointments of a client in the modal.
- Quick create of a client from other forms' dropdowns (belongs to their specs).
- Length limits on any field and a phone format check.
- Rename confirmations: changing a client's data never asks for one.

## Open questions

- None. Decided with the owner: "Agregar vehículo" stays enabled and only "Crear un vehículo nuevo" is greyed out; "Revisá el DNI." for non-numeric DNI input; assigning supports several vehicles at once (checkboxes); the WhatsApp button always shows, icon only; no count in the first step.
