# 013 — Imprimir trabajo: Requirements

**Status:** Approved (by the owner in conversation, 2026-10-28)

Depends on [012 — Shop branding](../012-shop-branding/requirements.md) (the shop's logo, address and phone).

## Problem

The mechanic has no sheet to work from. The shop prints a work order from another system, with a line per customer request where the mechanic writes by hand. Torque should print an equivalent sheet for any job, in the app's own terms, simpler than the original, with room to write on every service and a signature from the client.

Visual reference: [mockup.html](mockup.html) (A4, fake data, not final).

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access, on every screen that opens the job modal (Trabajos, Vehículos, Turnos, Inicio).

## User stories

- As a receptionist, I want to print a job, so that the mechanic gets a sheet listing what must be done.
- As a mechanic, I want blank lines under every service, so that I can write what I did and tick it off.
- As a receptionist, I want a signature line, so that the client signs what will be done to the vehicle.
- As a shop, I want each job to have a sequential number, so that the sheet and the job can be matched.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (copy, formats, accessibility, modals). Where this spec and the docs disagree, the docs win.

Entry point

- [ ] Given the job modal in view mode (editable or read only, every screen that opens it), when it shows, then it has an "Imprimir" button next to "Enviar presupuesto" with a Phosphor printer icon. It does not show in edit or create mode.
- [ ] Given a job in any status, archived or not, when "Imprimir" is clicked, then the sheet is generated from the saved job and the user can print it or save it as PDF from the browser's print dialog. Nothing in the job changes: no status change, no history entry.
- [ ] Given the job's services are still loading, then the button is disabled; given they failed to load, then it is not shown (the section shows its error).

Job number

- [ ] Given a shop's jobs, then each has a sequential number unique within its shop, assigned by the database on creation, starting at 1, never reused and never changed (archived jobs keep theirs). Two shops count independently, and two jobs created at the same moment never get the same number.
- [ ] Given existing jobs when the migration runs, then they are numbered in creation order.
- [ ] Given a job, then the database stores only the number (an integer, 123); every screen shows it as "N° 000123" (six digits, zero padded; longer numbers grow) through one shared formatter.
- [ ] Given the Trabajos list (and Inicio's, which reuses it), then it has a first column "N°" with the formatted number, sortable like the others (numeric, ascending on the first click). This supersedes spec 007's seven-column criterion.
- [ ] Given the job modal, then its header shows "N° 000123" next to the plate and vehicle name.
- [ ] Given the list's search box, when "123" or "000123" is typed, then the job with that number is found (the placeholder adds "número"); search stays case, accent and punctuation insensitive for the rest.

Sheet content (A4, black and white, no prices)

- [ ] Given the sheet, then the header has the shop's logo (the app's logo when it has none), name, address and phone (spec 012), the title "N° 000123" (no word "Trabajo") and "Creado el dd/mm/aaaa". A missing address or phone is left out, not shown empty.
- [ ] Given the sheet, then the data block has: "Patente" (plain spaced text, not the plate drawing), "Vehículo" (brand, model and year), "Cliente" and "Teléfono", and "Kilometraje" (dot thousands + "km"). The status is not shown. Missing values read "Sin cliente" and "Sin cargar".
- [ ] Given the services, then each is a numbered block, in saved order, with its name (an archived service by its plain name), "x N" and a "Hecho" checkbox in its header, and below it the label "Trabajo realizado" with blank space to write in (about the height of three lines, no ruled lines).
- [ ] Given a job with no services, then the section reads "Sin servicios cargados." with no blocks.
- [ ] Given the sheet, then "Observaciones" is a bordered box after the services and above the signature area, always blank, for the mechanic to write in. The job's own observations are not printed.
- [ ] Given any amount of services, then a block is never split across pages, and the observations box and the signature area ("Firma del cliente" and "Aclaración") sit together at the end of the last page.
- [ ] Given the sheet, then no price, total or final value appears anywhere on it, and the footer shows the shop's name and "Impreso el dd/mm/aaaa" (Argentina time). The browser's own header and footer (its date, the page title, the app's address, page numbers) are not printed: the sheet's date is the only one, and the client never sees the app's address.

Accessibility and quality

- [ ] Given the button, then it is keyboard operable with a visible focus ring and the icon hidden from screen readers.
- [ ] Given the sheet, then text is black on white, readable when printed in black and white, at 11 pt or larger except small labels (12 px).

Isolation

- [ ] Given two shops, when a user prints a job, then only that shop's data is used (the sheet is built from data read under RLS). Personal data is never logged or put in a URL.

## Out of scope

- Prices, totals, payments, invoices, discounts and stock.
- Printing several jobs at once, and printing from the list.
- The fluids and billing block and the pickup/approval boxes of the original sheet.
- A per-shop template, a numbering format per shop, languages other than Spanish, and sending the sheet from the server.

## Open questions

- None.

## Decisions taken with the owner (2026-10-28)

- Format: the browser's print view with print CSS (no PDF library); from its dialog the user prints or saves as PDF.
- Blank writing space per service (first three ruled lines, then the owner asked to take the lines out, 2026-10-28).
- Patente as plain text; no status on the sheet; observations in a box above the signature, always blank.
- The number shows as "N° 000123" on the sheet, in the Trabajos list (new first column), in the job modal's header and in the search; the database stores only the integer.
- Header with the shop's logo, address and phone, and a sequential job number; the logo and branding data are their own spec (012), also used by the app's header.
