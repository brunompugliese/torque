# 013 — Imprimir trabajo: Design

**Status:** Approved (by the owner in conversation, 2026-10-28)
**Requirements:** [requirements.md](requirements.md)
## Summary

Each job gets a per-shop sequential number, assigned by the database. The number is shown as "N° 000123" in the Trabajos list (new first column, sortable, searchable), in the job modal's header and on the printed sheet.

The sheet is a page of its own, `/imprimir/<job id>`, outside the `(app)` group so it has no navigation or header. The server builds it from data read under RLS (job, services, shop), and the browser's print dialog does the rest: it prints, or saves as PDF. The "Imprimir" button in the job modal is a link that opens that page in a new tab; the page opens the print dialog by itself once the logo has loaded, and keeps an "Imprimir" button for printing again. No PDF library, nothing stored, nothing logged.

## Database

Two migrations, one concern each, plus `db_schema.sql`.

**`20261029000000_ddl-job-number.sql`**

- `shop.last_job_number integer not null default 0`: the shop's counter.
- `job.number integer`, then `not null`, `check (number > 0)` and `unique (shop_id, number)` once existing rows are numbered.
- Backfill, in the same migration and before the constraints: for each shop, jobs numbered 1, 2, 3… by `created_at, id` (`row_number() over (partition by shop_id order by created_at, id)`), then `shop.last_job_number` set to the shop's highest number. Idempotent: it only touches jobs whose `number` is null.
- `trg_job_set_number`, `before insert on public.job`: `security definer`, `set search_path = ''` (like the other triggers that touch another table). It runs `update public.shop set last_job_number = last_job_number + 1 where id = new.shop_id returning last_job_number into new.number`, ignoring any number the caller sent. The update takes the shop row's lock, so two jobs created at the same moment in one shop wait for each other and never get the same number; shops don't block one another. The counter is in the same transaction as the insert, so a failed insert leaves no gap, and nothing ever decrements it, so a number is never reused.
- `trg_job_number_immutable`, `before update of number on public.job`: raises `23514` (like the other business rules) if `number` changes. Archiving does not touch it.
- No grant changes: `authenticated` keeps its table-level privileges; the guard trigger is what makes the column read-only.

**`20261029000001_ddl-job-list-number.sql`**

- `create or replace view public.job_list` adds `j.number` as the last column (a view can only grow at the end) and puts the zero-padded number (`lpad(j.number::text, 6, '0')`) into `search_text`, so "123" and "000123" find the job. `job_status_counts` reads `search_text`, so the Estado counts follow with no change. Grants stay as they are (`create or replace` keeps them).
- A search for "0" or "00" matches every job below 1000, and "123" also matches a plate such as "AB 123 CD": the search is a substring match by design ([spec 007](../007-jobs/design.md)).

## Frontend

### Number

- `formatJobNumber(number)` in `src/lib/format/job-number.ts`: `123` → `"N° 000123"` (padded to six digits; more digits grow). The one place that knows the format; the list, the modal and the sheet call it.
- `JOB_LIST_COLUMNS` and `jobListRowSchema` read `number` (`JobListItem.number`); `JOB_SORT_COLUMNS` gets `numero: "number"`. The default sort stays "Actualizado", descending.
- `JobsTable`: first column `numero` ("N°"), sortable, left aligned, `tabular-nums` and no wrapping; the skeleton gets the same column. Messages: `jobs.columns.number`; the search placeholder becomes "Buscar por número, patente, marca, modelo o cliente".
- Job modal (`use-job-modal.tsx`, view mode): the title shows the number before the plate: `N° 000123 · [plate] Fiat Cronos 2021` (the number in `text-muted-foreground`, with the visually hidden word "Trabajo" so a screen reader says what it is). The edit-mode subtitle also carries it.

### Sheet

Route and files:

| File | Role |
|---|---|
| `src/app/imprimir/[id]/page.tsx` | Server component. `requireSession()`, validates the id with `jobIdSchema` (invalid → `notFound()`), loads the sheet, renders it. A job that isn't in the user's shop is not found by RLS → `notFound()`. Metadata title "Trabajo N° 000123" so the saved PDF gets a useful name. |
| `src/features/job/sheet.ts` | `buildSheet(job, items, shop, now)`: pure function from the data to what the sheet shows (formatted number, plate, vehicle, client, phone, kilometers, services, dates, missing-value texts). Tested without React. |
| `src/features/job/queries.ts` | `getJobSheet(id)`: `getJobListRow` + `getJobDetail` + `getShop`, all existing and cached per request, plus the vehicle's VIN from `vehicle_decrypted` (`job_list` doesn't carry it; a failed read leaves the VIN out instead of failing the sheet); the history that `getJobDetail` also returns is ignored. |
| `src/features/job/components/job-sheet.tsx` | The A4 sheet. Server component, no state. |
| `src/features/job/components/print-controls.tsx` | Client. Calls `window.print()` once the logo and the fonts have loaded (images that fail count as loaded), and renders the "Imprimir" button, hidden when printing (`print:hidden`). |
| `src/features/job/components/print-job-button.tsx` | The modal's "Imprimir": `<a href="/imprimir/<id>" target="_blank" rel="noopener">` styled like the "Enviar presupuesto" button, with `PrinterIcon`. |
| `src/app/imprimir/sheet.css` | `@page { size: A4; margin: 0 }`. The margin is 0 on purpose: browsers print their own header (date, title) and footer (the page's address, page number) inside the page margin and leave them out when there is none, so the sheet shows only its own date and never the app's address. The sheet keeps its margin itself: 14 mm at the sides and a 12 mm header and footer row in a layout table, which the browser repeats on every page. Imported by the page. |

- Access: the same session rules as every page. A signed-out user is redirected to the login; the job id in the URL is a uuid, not personal data, and no personal data is logged.
- Content follows [requirements.md](requirements.md): header (logo through `ShopLogo`, name, address and phone, "N° 000123", "Creado el"), data block, numbered service blocks with "x N", "Hecho" box and a blank writing space, blank "Observaciones" box, signature and "Aclaración", footer with the shop's name and "Impreso el" (Argentina time, from the server). Phone through the existing phone formatter.
- Print rules: each service block and the observations + signature group use `break-inside: avoid`; the observations box and the signature stay together at the end of the last page. Colors are black on white and borders instead of fills, so it reads in black and white. The app is light-only, so its tokens already give black on white.
- Semantics: the title is the page's `h1`; services are an ordered list; the empty "Hecho" box and the writing lines are decorative (`aria-hidden`), the word "Hecho" is real text.
- Messages: `jobs.print.*` (button, texts of the sheet) in `messages/es.json`.

### The button

In `job-detail-sections.tsx` the services heading's `action` shows `PrintJobButton` next to `QuoteButton`. It is disabled (no `href`, `aria-disabled`) while the services load, and the section already hides the whole action row when they fail to load. It shows in view mode for every status, archived or not, and for read-only modals (Inicio). Nothing changes in the job: no action is called.

Why a link and not a button that calls `window.print()` on the current page: the modal and the app's chrome would print with it, and blocking them needs print CSS on every screen. A page of its own prints exactly the sheet, keeps the print rules in one place, and a link opened by a click isn't blocked as a popup.

## Tests

- pgTAP `supabase/tests/12_job_number.sql`: a shop's jobs get 1, 2, 3; a second shop starts at 1 and the two don't affect each other; a number sent by the caller is ignored; archiving keeps the number; changing the number fails with `23514`; a rolled-back insert leaves no gap; `job_list` exposes `number` and its `search_text` finds "000123". The backfill and the lock can't be exercised on the empty CI database: the backfill is checked by the owner on `torque-dev` (task 4), and the lock is the row lock of a single `update`.
- Vitest: `formatJobNumber`; the schema and the sort column; `JobsTable` (column, sort, skeleton); the modal title; `buildSheet` (every missing value, no price anywhere, order of the services, archived service by its plain name, no job observations); `JobSheet` (blocks, blank space and no ruled lines per service, "Sin servicios cargados.", observations box, signature, no price); `PrintControls` (prints after the images settle, once); `PrintJobButton` (href, disabled while loading, in every status); the page (invalid id → not found).
- The existing fixtures that build a `JobListItem` get `number`.

## Risks and alternatives

- **The counter row is a lock.** Two shops never wait for each other and creating a job takes one more row update. Rejected: `max(number) + 1` (races, needs a retry loop); a sequence per shop (one object per tenant); a global sequence (numbers wouldn't be sequential per shop).
- **Backfill on existing data.** It runs once, in the migration, in creation order. The owner checks it on `torque-dev` before production.
- **Print layout varies by browser.** Chrome, Edge and Firefox honor `@page` and `break-inside`; the owner prints a real sheet (and a PDF) as the manual check of task 9. Rejected: a PDF library or a server-side PDF (more code, fonts and design limits, nothing the print view can't do here).
- **Auto print.** If the user cancels the dialog, the page stays with its "Imprimir" button.
