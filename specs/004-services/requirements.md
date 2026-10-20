# 004 — Services page: Requirements

**Status:** Approved (by the owner in conversation, 2026-10-19)

## Problem

Jobs are built from the shop's catalog of services (`service`), but there is no screen to manage that catalog. Today services can only be created in the Supabase dashboard. Staff need to list, search, add, edit, archive and unarchive services from the app at `/servicios`.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access: anyone in the shop can manage its services.

## User stories

- As a staff member, I want to see the shop's services in alphabetical order, so that I can find one quickly.
- As a staff member, I want to search services by name or description, so that I can find one without scrolling.
- As a staff member, I want to add a service, so that it can be used on jobs.
- As a staff member, I want to edit a service's name and description, so that the catalog stays accurate.
- As a staff member, I want to be warned before renaming a service that is already on jobs, so that I don't change past jobs by accident.
- As a staff member, I want to archive a service the shop no longer offers, so that it can't be added to new jobs while past jobs keep it.
- As a staff member, I want to be told when a name is already taken, even by an archived service, so that the catalog has no duplicates.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (list pages, search, detail modal, forms, archive, confirmations, toasts, uniqueness). The criteria below are what this page adds or must specifically verify.

Navigation

- [ ] Given the navbar, when it shows, then it has a "Servicios" item after "Trabajos" linking to `/servicios`, highlighted on that page (today `NAV_ITEMS` stops at Trabajos and the route doesn't exist, although design.md lists it).

Page and list

- [ ] Given `/servicios`, when it loads, then it shows the title "Servicios", the summary "N servicios en total, M archivados." (N counts active and archived; singular and plural agree, e.g. "1 servicio en total, 1 archivado."; "0 archivados" is always shown), and the "Agregar servicio" button.
- [ ] Given the list, when it loads, then it has two columns: "Servicio" (the name, the description below in grey cut to one line with "…" (nothing when empty), and an "Archivado" badge on archived rows) and "Creado el" (a date, styled per design.md's table date standard: dd/mm/aaaa, Argentina time, secondary text color).
- [ ] Given the table headers, when they show, then they follow design.md's column header standard: 12px medium in secondary text, the sorted column in text color with a single arrow for its direction, the other sortable header with an up/down arrow.
- [ ] Given the "Creado el" header, when clicked, then the list sorts by creation date, oldest first; clicking again reverses it. Clicking "Servicio" goes back to A–Z.
- [ ] Given the list, when it loads, then it is sorted by name A–Z, ignoring case and accents ("aceite" and "Alineación" sort as a, a), so "Servicio" shows as the sorted column; clicking its header reverses it, and the header announces its sort direction.
- [ ] Given "Mostrar archivados" is on, when the list shows, then archived services are greyed and sorted alphabetically among the active ones (not grouped at the end).
- [ ] Given more than 25 services, when the list shows, then it is paginated on the server per the shared pattern; search and sort run on the server over the whole catalog.
- [ ] Given the toolbar, when it shows, then it has only the search box, the "Mostrar archivados" switch and the result count ("3 de 15 servicios"); there are no filters.
- [ ] Given loading, an error or no results, when the list shows, then it shows the shared states. No results for a search: "No encontramos servicios" · "Probá con otro nombre o descripción." · "Borrar búsqueda". No services at all: "Todavía no hay servicios" · "Agregá el primero para usarlo en los trabajos." · "Agregar servicio".
- [ ] Given a row, when it is clicked (or activated with the keyboard), then the service modal opens.

Search

- [ ] Given the search box, when it shows, then its placeholder is "Buscar por nombre o descripción".
- [ ] Given a search term, when typed, then services whose name or description match are listed, ignoring case, accents, spaces, dots and dashes ("alineacion" finds "Alineación"; "CAMBIO-DE aceite" finds "Cambio de aceite").
- [ ] Given a search term and "Mostrar archivados" off, when archived services match, then they are listed too, greyed and with the "Archivado" badge.

Service modal

- [ ] Given a service, when its modal opens, then the header shows the name (+ "Archivado" badge if archived), no subtitle, and the actions "Archivar" / "Desarchivar" and "Editar servicio".
- [ ] Given a service, when its modal opens, then the body shows "Descripción" with the description, or "Sin descripción".
- [ ] Given a service, when its modal opens, then the footer shows "Creado el dd/mm/aaaa" (Argentina time).

Add

- [ ] Given "Agregar servicio", when clicked, then a modal titled "Agregar servicio" opens with the form: "Nombre *" (text, required) and "Descripción" (multi-line, optional, hint "Qué incluye. Se muestra en el catálogo."), the subtitle "Los campos con * son obligatorios." and the footer "Cancelar" (closes) / "Agregar servicio".
- [ ] Given a valid form, when saved, then the service is created active, its modal opens, and a toast "Servicio agregado" · "<name>" confirms.
- [ ] Given a new service, when the job form's service dropdown is opened later, then the service is available (no extra work needed: the dropdown reads the same table).

Edit

- [ ] Given "Editar servicio", when clicked, then the modal content is replaced by the form titled "Editar servicio", with the service name above the subtitle and the fields prefilled; the footer is "Cancelar" (back to the service modal) / "Guardar cambios".
- [ ] Given a valid edit, when saved, then the modal returns to the service with the changes and a toast "Cambios guardados" · "<name>".
- [ ] Given an archived service, when edited, then it can be edited like an active one.
- [ ] Given an edit with no changes (after trimming and collapsing spaces), when saved, then the modal goes back to the service without a request or a toast.

Rename confirmation

- [ ] Given an edit where the name changed (after normalization: not just case, accents, spaces, dots or dashes) and the service is on at least one job item, when saved, then a confirmation asks "¿Cambiar el nombre del servicio?" + "Este servicio ya se usó en trabajos. El nombre nuevo se va a ver en todos, incluso en los entregados." + "Cancelar" (back to the form, nothing saved) / "Cambiar nombre" (saves).
- [ ] Given an edit where only the description changed, or the service is on no job item, when saved, then it saves without confirmation.
- [ ] Given the "is it used" check, when it runs, then it is a single existence query (stops at the first job item), not a count.

Validation and uniqueness

- [ ] Given an empty or whitespace-only name, when saved, then "Ingresá el nombre." shows under Nombre and focus moves there.
- [ ] Given a name and description, when saved, then the name is trimmed with inner runs of spaces collapsed to one, and the description is trimmed (line breaks kept); an empty description is stored as null. No length limits.
- [ ] Given a name that matches an active service's name ignoring case, accents, spaces, dots and dashes, the same normalization as search ("cambio de  aceíte" and "Cambiodeaceite" both match "Cambio de aceite"), when saved, then "Ya hay un servicio con este nombre." shows under Nombre.
- [ ] Given a name that matches an archived service's name, when saved, then "Ya hay un servicio archivado con este nombre." shows under Nombre.
- [ ] Given an edit that keeps the service's own name, when saved, then the service doesn't clash with itself.
- [ ] Given the same input sent directly to the server, when the server action runs, then it applies the same Zod schema and the same uniqueness check.
- [ ] Given the uniqueness check, when it runs, then it is a single query on save; there is no database constraint (a duplicate from two simultaneous saves is accepted, per design.md).

Archive and unarchive

- [ ] Given "Archivar", when clicked, then a confirmation asks "¿Archivar este servicio?" + "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras. No se va a poder agregar a trabajos nuevos. Los trabajos que ya lo tienen no cambian." + "Cancelar" / "Archivar".
- [ ] Given the confirmation, when "Archivar" is confirmed, then the modal shows the "Archivado" badge and "Desarchivar", and a toast "Servicio archivado" · "<name>" confirms; the service leaves the default list and the job form's dropdown.
- [ ] Given an archived service, when "Desarchivar" is clicked, then it is restored immediately, without confirmation, with a toast "Servicio desarchivado" · "<name>".

Loading

- [ ] Given `/servicios` while its data loads, when it shows, then the title and "Agregar servicio" render right away, and the summary, toolbar count and table show a skeleton with the table header and placeholder rows in the final sizes, so nothing shifts when data arrives.
- [ ] Given the service modal, when it opens, then it shows instantly from the row already loaded with the list (no extra request, so no loading state). Modals that load their own data (future related lists) use the shared skeleton.
- [ ] Given any skeleton, when inspected, then its region is `aria-busy`, announces "Cargando…" once, and doesn't pulse with reduced motion on.
- [ ] Given the codebase, when the skeletons are inspected, then they are built from shadcn's `Skeleton` and shared composites in `components/shared/`, each beside the component it stands in for.

Reuse and standardization

- [ ] Given the pieces of this page that every list page needs, when built, then they live in `components/shared/` or `lib/`, know nothing about services and take their text and data from the caller, so Vehículos, Clientes, Turnos and Trabajos reuse them as-is: data table with sortable headers, pagination, toolbar (search box, "Mostrar archivados" switch, result count), list states (skeleton, error with "Reintentar", empty), "Archivado" badge, detail modal shell (header actions, label/value body, "Creado el" footer, modal-to-modal "Volver"), confirmation dialog, archive/unarchive flow, list-page summary text, list query helper (search, sort, page, archived), and the "already exists" uniqueness check.
- [ ] Given existing code, when this page is built, then it reuses it instead of duplicating it: `PageHeader` (extended with the summary and aligned with design.md's page title, 28px bold; today it renders 24px semibold), `FormAlert`, `FlashToast`/Sonner, shadcn `Field`, `lib/validation/fields.ts`, `requireSession()`, `createServerSupabase()`, and the database's `private.normalize_search` with its matching app helper.
- [ ] Given every new shared component, helper and schema, when tested, then it has Vitest tests of its own, independent of the services page.

Isolation and database

- [ ] Given two shops, when a user of one lists, searches, reads or edits services, then they never see or change the other shop's services (existing RLS, covered again for any new view or column).
- [ ] Given a service written with any name or description, when saved, then the database stores `name_key` (`private.normalize_search(name)`) and `search_text` (`normalize_search` of name and description) itself, overwriting anything the app sends; the app uses `name_key` for sorting and the uniqueness lookup and `search_text` for search.
- [ ] Given existing services, when the migration runs, then their `name_key` and `search_text` are filled without changing `updated_at`.

## Out of scope

- Quick create of a service from the job form's dropdown ("+ Crear servicio nuevo"): belongs to the Trabajos spec.
- A "Usado en" column or count, and a list of the jobs that use a service.
- Prices on services (prices live on job items).
- A database constraint on service-name uniqueness (decided: app check only).
- Length limits on name and description.
- Applying the new global rules (summary format, search including archived, loading skeletons) to other pages: each page's own spec does it, reusing what this spec builds.

## Open questions

- None. Decided with the owner (2026-10-19): app-only uniqueness check against active and archived services, with the same normalization as search (`normalize_search`: case, accents, spaces, dots and dashes ignored), with a distinct message for archived matches; no "Usado en"; alphabetical sort ignoring case and accents with a reversible header; rename confirmation only when the name changes and the service is on jobs, using an existence check, buttons "Cancelar" / "Cambiar nombre"; all roles have the same access; no quick create; existing docs win any conflict; toasts' second line is the service name; summary "N servicios en total, M archivados." as the standard for every list page; search always includes archived, as the standard for every page (no placeholder hint, decided later the same day); empty modal subtitle for now; archive confirmation uses the shared text plus the service-specific sentence; descriptions cut to one line; no length limits; search ignores accents and punctuation; database work keeps free-tier costs low (normalize on write, not on read); loading skeletons are mandatory for every page and component that loads data (design.md, conventions.md); dd/mm/aaaa is the only date format; the list-page building blocks are built generic and shared; column headers follow the design.md standard (styled apart from rows, always-visible sort arrows); a "Creado el" column, sortable, oldest first on the first click; dates in tables use secondary text, as a standard for every table (design.md).
