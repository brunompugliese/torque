# 006 — Vehicles page: Requirements

**Status:** Approved (by the owner in conversation, 2026-10-21)

## Problem

Vehicles, the main record of the app, can only be created in the Supabase dashboard. Staff need to list, search, add, edit, archive and unarchive vehicles from the app at `/vehiculos`, see each vehicle's job history, and create a vehicle's owner on the spot. The Clientes page also has pieces waiting for this one: "Crear un vehículo nuevo" is greyed out and vehicle rows can't be opened.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access: anyone in the shop can manage its vehicles.

## User stories

- As a staff member, I want to see the shop's vehicles in a sortable, searchable list, so that I can find one quickly.
- As a staff member, I want to search by plate, brand, model or VIN, so that I can find a car with whatever the customer tells me.
- As a staff member, I want to add and edit a vehicle, so that its record is accurate.
- As a staff member, I want to create the owner while adding the vehicle, so that I don't leave the form.
- As a staff member, I want to see a vehicle's owner, VIN, last km and job history, so that I know its story before working on it.
- As a staff member, I want to archive a vehicle that no longer comes, so that it stops cluttering the list while its history stays.
- As a staff member, I want to be told when a plate is already taken, even by an archived vehicle, so that a car isn't duplicated.
- As a staff member, I want to create and open a vehicle from a client's modal, so that I can move between a person and their cars.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (list pages, search, detail modal, modal to modal, forms, searchable dropdowns, quick create, archive, confirmations, toasts, uniqueness) and reuses the kit built in specs [004](../004-services/requirements.md) and [005](../005-clients/requirements.md). The criteria below are what this page adds or must specifically verify.

Page and list

- [ ] Given `/vehiculos`, when it loads, then it replaces the placeholder and shows the title "Vehículos", the summary "N vehículos en total, M archivados." (N counts active and archived; singular and plural agree, "0 archivados" always shown, e.g. "1 vehículo en total, 0 archivados.") and the "Agregar vehículo" button.
- [ ] Given the list, when it loads, then it has seven columns: "Patente" (plate drawing, centered), "Vehículo" (brand + model, and an "Archivado" badge on archived rows), "Año" (right-aligned), "VIN" (17 characters), "Cliente" (name + surname, with the suffix "(Archivado)" if the client is archived), "Último km" (dot thousands + "km", right-aligned, tabular figures) and "Creado el" (styled per design.md's table date standard). An empty year, VIN or km shows "—"; a vehicle without a client shows "Sin cliente"; an empty surname shows only the name.
- [ ] Given the list, when it loads, then no header is marked as sorted and rows come A–Z by plate (the page's default order).
- [ ] Given any of the seven headers, when clicked, then the list sorts by it ascending on the first click ("Creado el" oldest first), reverses on the second, and the header shows the sorted look and announces its direction, per design.md.
- [ ] Given a sort, when it runs, then "Patente" sorts by the plate, "Vehículo" by brand and then model (ignoring case and accents), "Cliente" by the client's name and then surname (ignoring case and accents), and "Último km" and "Año" by numeric value.
- [ ] Given a sort by Año, VIN, Cliente or Último km, when some vehicles have no value, then those vehicles come last in both directions.
- [ ] Given more than 25 vehicles, when the list shows, then it is paginated, searched and sorted on the server over the whole table, per the shared pattern.
- [ ] Given the toolbar, when it shows, then it has only the search box (placeholder "Buscar por patente, marca, modelo o VIN") and the "Mostrar archivados" switch; there are no filters and no result count.
- [ ] Given loading, an error or no results, when the list shows, then it shows the shared states. No results for a search: "No encontramos vehículos" · "Probá con otra patente, marca, modelo o VIN." · "Borrar búsqueda". No vehicles at all: "Todavía no hay vehículos" · "Agregá el primero para registrar sus trabajos." · "Agregar vehículo".
- [ ] Given a row, when it is clicked (or activated with the keyboard), then the vehicle modal opens.

Search

- [ ] Given a search term, when typed, then vehicles whose plate, VIN, brand or model match are listed, ignoring case, accents, spaces, dots and dashes ("ab 123 cd" and "AB123CD" find the same plate; "cronos" finds a Fiat Cronos).
- [ ] Given a search term and "Mostrar archivados" off, when archived vehicles match, then they are listed too, greyed and with the "Archivado" badge.
- [ ] Given a search term, when typed, then it is kept in component state and sent in the Server Action's body, never put in the URL (architecture.md "Never in URLs"); the URL holds only the archived switch, sort and page. Reloading the page therefore starts with no search.

Vehicle modal

- [ ] Given a vehicle, when its modal opens, then it shows instantly from the row already loaded with the list; the header shows the plate drawing and "Brand Model Year" (just "Brand Model" when there is no year), plus the "Archivado" badge when archived, and the actions "Archivar" / "Desarchivar" and "Editar vehículo".
- [ ] Given a vehicle, when its modal opens, then the body shows "Cliente", "VIN" and "Último km". Cliente shows the name + surname (with "(Archivado)" if archived) and the phone as plain text with the shared "WhatsApp" button next to it, read only (the name does not open the client modal), or "Sin cliente". VIN and Último km show "Sin cargar" when empty.
- [ ] Given the client's phone, when shown, then the WhatsApp button behaves exactly as in the client modal (same component, link rule and accessible name).
- [ ] Given a vehicle, when its modal opens, then the footer shows "Creado el dd/mm/aaaa" (Argentina time) and "Volver" only when it was opened from a client.
- [ ] Given the "Último km", when computed, then it is the highest km among the vehicle's non-archived jobs (the same rule the database uses to stop a job's km going below the previous ones), and empty when there is none.

Job history

- [ ] Given the vehicle modal, when it opens, then "Historial de trabajos" loads the vehicle's jobs with the shared skeleton (`aria-busy`, one "Cargando…") in the final sizes, and shows an error with "Reintentar" if it fails.
- [ ] Given the history, when shown, then it lists every job of the vehicle, archived ones included (greyed, with the "Archivado" badge), newest first by creation date.
- [ ] Given a job row, when shown, then it has: the date (dd/mm/aaaa) and km of that visit ("—" without km), the services comma-separated cut with "…" when they exceed the column width ("—" when the job has none), the job status badge (shared status colors) and the total.
- [ ] Given a job's total, when shown, then it is the final total labelled "Final" when the job has one, otherwise the quoted total labelled "Presupuestado".
- [ ] Given more than five jobs, when the history shows, then the five most recent are listed and a full-width "Ver todos (N)" button (N = all jobs) expands the rest in place, without a request.
- [ ] Given a vehicle with no jobs, when the history shows, then it says "Este vehículo todavía no tiene trabajos."
- [ ] Given a job row, when shown, then it is not clickable and has no arrow until the Trabajos page exists. *(Superseded by [spec 007](../007-jobs/requirements.md): rows open the job modal, with "Volver".)*

Add and edit

- [ ] Given "Agregar vehículo", when clicked, then a modal titled "Agregar vehículo" opens with the form, the subtitle "Los campos con * son obligatorios." and the footer "Cancelar" (closes) / "Agregar vehículo".
- [ ] Given the form, when it shows, then it has, in this order: "Patente *" (placeholder "AB 123 CD"), "Año" (number), "Marca *" (searchable dropdown), "Modelo *" (searchable dropdown), "VIN" and "Cliente" (searchable dropdown with "+ Crear cliente nuevo", hint "Dejalo vacío si el vehículo no tiene cliente.").
- [ ] Given a valid form, when saved, then the vehicle is created active, a toast "Vehículo agregado" · "<plate>" confirms and the modal closes (the list refreshes behind it).
- [ ] Given "Editar vehículo", when clicked, then the modal content is replaced by the form titled "Editar vehículo", with the plate above the subtitle and the fields prefilled; the footer is "Cancelar" (back to the vehicle modal) / "Guardar cambios".
- [ ] Given a valid edit, when saved, then a toast "Cambios guardados" · "<plate>" confirms and the modal closes.
- [ ] Given an archived vehicle, when edited, then it can be edited like an active one.
- [ ] Given a vehicle that has jobs, when edited, then plate, brand and model can still be changed.
- [ ] Given an edit with no changes (after normalization), when saved, then the modal goes back to the vehicle without a request or a toast.

Plate

- [ ] Given the Patente field, when the user types or pastes, then every character that is not a letter or a digit is dropped, letters are uppercased, it holds at most 7 characters and it is displayed spaced as typed with the shared plate format ("ab123cd" → "AB 123 CD", "abc123" → "ABC 123"). The field stays a text input.
- [ ] Given an empty plate, when saved, then "Ingresá la patente." shows and focus moves there.
- [ ] Given a plate of fewer than 6 characters, when saved, then "Revisá la patente: tiene que tener 6 o 7 caracteres." shows and focus moves there. A plate is always 6 or 7 letters and digits; no further format is checked.
- [ ] Given a plate that another vehicle of the shop already has, when saved, then "Ya hay un vehículo con esta patente." shows under Patente; if that vehicle is archived, "Ya hay un vehículo archivado con esta patente.". An edit that keeps the vehicle's own plate doesn't clash with itself.
- [ ] Given a plate, when saved, then it is stored uppercase without spaces (the database normalizes it).

Year, brand, model and VIN

- [ ] Given Año, when saved, then it is empty or a whole number from 1886 to next year (Argentina time); anything else shows "Ingresá un año entre 1886 y <next year>." and focus moves there.
- [ ] Given the Marca and Modelo dropdowns, when opened, then they list the catalog's enabled brands and the enabled models of the chosen brand, filtered as the user types, with arrow keys + Enter. A brand or model that is archived in the catalog is listed only when the vehicle being edited already uses it.
- [ ] Given no brand chosen, when the form shows, then Modelo is disabled with "Primero elegí la marca"; choosing a brand enables it, and changing the brand clears the model.
- [ ] Given text in a dropdown that matches no option, when saved, then "Elegí una marca de la lista." / "Elegí un modelo de la lista." shows under the field; an empty brand or model shows "Elegí la marca." / "Elegí el modelo.".
- [ ] Given the VIN field, when the user types or pastes, then it is shown uppercase and holds at most 17 characters after trimming and removing hyphens (a pasted "1hg-cm82633a-004352" becomes "1HGCM82633A004352").
- [ ] Given a VIN, when saved, then it is trimmed, hyphens removed and uppercased; empty is stored as null; otherwise it must have exactly 17 letters and digits without "I", "O" or "Q", or `El VIN debe tener 17 caracteres (Sin "I", "O", "Q" ni guiones)` shows and focus moves there. VINs are not unique.
- [ ] Given the form, when the same input is sent directly to the server, then the server action applies the same Zod schema.

Client field

- [ ] Given the Cliente dropdown, when opened, then it lists the shop's clients, archived ones included and labelled "(Archivado)", filtered as the user types by name, surname, DNI, phone or email (ignoring case, accents, spaces, dots and dashes), each option showing the name and the phone in grey. The last option is "+ Crear cliente nuevo". Once picked, the field shows the client's name.
- [ ] Given the Cliente dropdown on an existing vehicle, when the user picks another client or clears it, then it is saved without a confirmation.
- [ ] Given "+ Crear cliente nuevo", when clicked, then the dropdown hides and an inline section "Cliente nuevo" opens in the same form, with an X (accessible name "Descartar cliente nuevo") to discard it, and the fields "Nombre *", "Apellido", "Teléfono *", "DNI" and the hint "Se crea junto con el vehículo. El resto de los datos se completa después desde Clientes.". Text typed in the dropdown carries over to Nombre / Apellido (a name) or Teléfono (a number); a client picked from the list does not.
- [ ] Given the inline section, when it shows, then Teléfono and DNI follow the same input rules and errors as the client form (digits only, phone formatted as typed and exactly 10 digits, DNI up to 8 digits; "Ingresá el nombre.", "Ingresá el teléfono.", "Revisá el teléfono: tiene que tener 10 dígitos.", "Ya hay un cliente con este DNI." / "Ya hay un cliente archivado con este DNI.") through the same shared field rules.
- [ ] Given a valid form with a new client, when saved, then the client and the vehicle are created in one database transaction (one request): if either fails, neither is created. A toast "Vehículo y cliente agregados" · "<plate>" confirms and the modal closes. The client is created active, and its email stays empty.
- [ ] Given a new client and a plate or DNI that is already taken, when saved, then the matching field error shows, the form keeps what the user typed and no client is created.
- [ ] Given an edit, when the form shows, then the inline "Cliente nuevo" section is also available (the vehicle then gets the new client).

Archive and unarchive

- [ ] Given "Archivar", when clicked, then a confirmation asks "¿Archivar este vehículo?" + "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras. No se le pueden crear turnos ni trabajos mientras esté archivado." + "Cancelar" / "Archivar".
- [ ] Given the confirmation, when "Archivar" is confirmed, then the modal closes (archive standard in design.md; the list refreshes and the vehicle leaves it unless "Mostrar archivados" is on) and a toast "Vehículo archivado" · "<plate>" confirms. The vehicle's jobs and client don't change.
- [ ] Given an archived vehicle, when "Desarchivar" is clicked, then it is restored immediately, without confirmation, the modal closes and a toast "Vehículo desarchivado" · "<plate>" confirms.

Clientes integration

- [ ] Given the client modal's add-vehicle first step, when it shows, then "Crear un vehículo nuevo" is enabled (no more "Próximamente") and opens the vehicle form with the Cliente field preselected with this client and locked (read only, no "+ Crear cliente nuevo").
- [ ] Given that form, when saved, then the vehicle is created for the client, a toast "Vehículo agregado" · "<plate>" confirms and the whole chain closes (the client modal too); "Cancelar" goes back one step, to the choice (design.md: in add mode, Cancel returns to the step that opened the form).
- [ ] Given a vehicle row in the client modal, when clicked (or activated with the keyboard), then the vehicle modal opens with "Volver", which returns to the client modal with focus on the row. After an action on the vehicle (editing it, archiving it) the whole chain closes, like any other action; the X closes every modal in the chain too.
- [ ] Given a vehicle opened from a client, when archived or unarchived, then the standard flow applies (the whole chain closes, toast), and the client's vehicles list is fresh the next time it opens.
- [ ] Given the client modal's assign step, when it lists unassigned vehicles, then it keeps working as before.

Rules for every screen (docs/design.md: Modals, Forms, Loading, Plates)

These four were set by the owner on 2026-10-21 and apply to this page, to Servicios and Clientes (changed here), and to every screen to come.

- [ ] Given any action that succeeds in a modal (create, edit, archive, unarchive, assign a vehicle to a client, give a vehicle a client), when it finishes, then the modal closes (the whole chain if it was opened from another modal), a toast confirms and the list behind refreshes; the detail modal never opens afterwards. This changes Servicios (create, edit, rename) and Clientes (create, edit, assign vehicles) too. When it fails the modal stays open. "Cancelar" and "Volver" only go back a step, an edit that changed nothing goes back to the detail without a request, and assigning several vehicles when some already had a client assigns the rest and stays on the step with its message.
- [ ] Given any modal form, when it shows, then its fields sit two to a row from the `sm` breakpoint up (Nombre next to Apellido, Teléfono next to DNI, Patente next to Año, Marca next to Modelo) and stack below it; a long value (an email, a description, the client dropdown) is alone in its row, full width.
- [ ] Given a field whose values are short, when it shows, then it is only as wide as its longest value, with the width from `FIELD_WIDTH`: the year (four digits), the plate, the DNI (8 digits), the phone and the VIN (17 characters) are narrower than a name or an email, and no form writes its own widths.
- [ ] Given a plate in any format (Mercosur, old, motorcycle, any other value), when drawn, then it is the same drawing and takes the same room (one fixed width that fits "AB 123 CD", characters centered): only the characters differ, in tables, modal titles and the vehicle rows alike, and the placeholder in a skeleton has that width too.
- [ ] Given any list (Servicios, Clientes, Vehículos, and every one to come), when a search, a sort, a page change, the archived switch or "Reintentar" loads new rows, then the table shows placeholder rows (not the old rows) until they arrive, announced once as "Cargando…" with `aria-busy`; the toolbar keeps the text being typed and the header keeps its sort buttons (and their keyboard focus); the pagination line comes back with the results.

Loading

- [ ] Given `/vehiculos` while its data loads, when it shows, then the title and "Agregar vehículo" render right away and the summary and the table show a skeleton in the final sizes, so nothing shifts.
- [ ] Given every dropdown's options, when they load, then the field shows the shared skeleton or a disabled state, never an empty list that looks final.
- [ ] Given every skeleton (list, history, dropdown options), when inspected, then its region is `aria-busy`, announces "Cargando…" once, and doesn't pulse with reduced motion on.

Accessibility

- [ ] Given the page and its modals, when used, then they meet design.md's accessibility rules: keyboard-only operation with a visible focus ring, focus trapped in modals and returned to what opened them, sort direction announced, field errors linked to their fields with focus on the first error, toasts and the pagination range announced, dropdowns with arrow keys, Enter and Esc, and animations still with reduced motion.

Reuse and standardization

- [ ] Given the page, when built, then it reuses the list-page kit (`DataTable`, `ListToolbar`/`ListUrlToolbar`, `PaginationBar`, `ListNoRows`, `DetailModal`, `ArchiveConfirmDialog` and `useArchiveFlow`, `ArchivedBadge`, `useListUrl`, `useListResults`, `applyListQuery`, `lookups`, `ActionResult`, `useLoadedData`, `PlateDisplay`, `WhatsappButton`, `VehicleRow`) and the field rules (`phoneField`, `dniField`, `formatPhone`, `dniDigits`). New generic pieces (the searchable dropdown, the plate, VIN and year field rules, the job status badge, `useListUrl` keeping the search out of the URL) live in `components/shared/` or `lib/`, are generic and have their own Vitest tests.

Isolation and database

- [ ] Given two shops, when a user of one lists, searches, reads, creates, edits or archives vehicles, clients or jobs through this page, then they never see or change the other shop's data (RLS, covered again for every new view column and for the new function).
- [ ] Given the vehicle list, when read, then the database provides the sort keys and display values (`last_km`, the client's name, surname, archived flag and sort key, brand and model sort keys) as columns of a `security_invoker` view, computed only when selected and never stored: no personal data is copied into plaintext columns.
- [ ] Given a new vehicle with a new client, when the function that creates both runs, then it runs as the caller (RLS and the encryption triggers apply), has explicit grants (not executable by `anon`), is atomic, and reports a taken plate or DNI in a way the app maps to the field errors above.
- [ ] Given personal and vehicle-identifying data, when handled, then it is never logged and never put in the URL (conventions.md).

## Out of scope

- Opening a job from the history (job modal), and the Trabajos page: job rows stay non-clickable until its spec.
- A "Último trabajo" column (replaced by "Creado el", as in Clientes and Servicios).
- Creating or editing brands and models from the app, and VIN decoding or validation of its check digit.
- Appointments of a vehicle in the modal.
- Opening the client modal from a vehicle's client name.
- Moving the Clientes search out of the URL (it conflicts with architecture.md): a separate follow-up change, done right after this page and tracked in `tasks.md`.
- Length limits other than plate (6–7), VIN (17) and year.

## Open questions

- None. Decided with the owner: plate accepts 6 or 7 letters/digits; the VIN message and rules; the year hint; job history shows archived jobs but "Último km" ignores them; list columns computed in a `security_invoker` view (no stored copies); the client + vehicle creation is a database function (atomic); search stays out of the URL for this page; the Clientes integration ("Crear un vehículo nuevo", opening a vehicle from a client) is part of this spec.
