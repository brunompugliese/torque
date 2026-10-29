# 013 — Imprimir trabajo: Tasks

**Status:** Approved (by the owner in conversation, 2026-10-28)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [ ] **1. Job number in the database**
  - Do: migration `20261029000000_ddl-job-number.sql` (`shop.last_job_number`, `job.number`, backfill in creation order, constraints, `trg_job_set_number`, `trg_job_number_immutable`); update `db_schema.sql`.
  - Verify: the "Database tests" workflow builds the database from the migrations.
- [ ] **2. Number in `job_list`**
  - Do: migration `20261029000001_ddl-job-list-number.sql` (`number` as the last column, zero-padded number in `search_text`); update `db_schema.sql`.
  - Verify: the workflow builds the database from the migrations.
- [ ] **3. Database tests**
  - Do: `supabase/tests/12_job_number.sql` and its row in `supabase/tests/README.md` (per-shop numbering, caller's number ignored, number immutable, archived keeps it, no gap on rollback, `job_list.number` and the search).
  - Verify: the "Database tests" workflow passes.
- [ ] **4. Owner applies the migrations**
  - Do: the project owner runs `npx supabase db push` on `torque-dev` (never the agent).
  - Verify: the owner checks in the dashboard that the existing jobs are numbered 1, 2, 3… in creation order per shop and that `last_job_number` matches the highest.
- [x] **5. Number formatter**
  - Do: `formatJobNumber` in `src/lib/format/job-number.ts`; Vitest tests.
  - Verify: tests cover padding, longer numbers and the "N° " prefix.
- [x] **6. Number in the job data**
  - Do: `number` in `JOB_LIST_COLUMNS` and `jobListRowSchema`; `numero` in `JOB_SORT_COLUMNS`; add `number` to the test fixtures that build a `JobListItem`.
  - Verify: schema and list tests pass; `npm test` and `npm run lint` pass.
- [x] **7. Number on screen**
  - Do: first column "N°" in `JobsTable` and its skeleton, search placeholder, number in the job modal's title and edit subtitle, messages; update spec 007's design note about the seven columns.
  - Verify: tests cover the column, its sort, the placeholder and the modal title; `npm test` passes.
- [x] **8. Sheet data**
  - Do: `buildSheet` in `src/features/job/sheet.ts` and `getJobSheet` in `queries.ts`; Vitest tests.
  - Verify: tests cover missing values, no price, services order, archived service name, no job observations and the query's error path.
- [x] **9. Sheet page**
  - Do: `JobSheet`, `PrintControls`, `src/app/imprimir/[id]/page.tsx`, `sheet.css`, `jobs.print.*` messages; light tokens for the sheet's subtree.
  - Verify: component and page tests (blocks, writing space, empty state, observations box, signature, no price, invalid id → not found, auto print once); `npm run build` passes.
- [x] **10. Print button**
  - Do: `PrintJobButton` and its place next to "Enviar presupuesto" in `job-detail-sections.tsx`; messages; Vitest tests.
  - Verify: tests cover the link, disabled while loading, any status, read-only modal; the "Enviar presupuesto" tests still pass.
- [ ] **11. Owner prints a real sheet**
  - Do: with `npm run dev` (after task 4), the owner opens a job's modal, clicks "Imprimir" and checks the sheet in Chrome and Firefox: the print dialog opens by itself, a job with many services spills onto a second page without cutting a block, the observations box and the signature stay together at the end, "Guardar como PDF" works and names the file after the number, a shop without a logo shows the app's mark, and another shop's job id gives a 404.
  - Verify: the owner confirms each point; anything that looks wrong goes back to task 9.
- [ ] **12. Docs**
  - Do: update `docs/design.md` (job number, print sheet), `docs/architecture.md` (counter and triggers, the `/imprimir` route, structure), `db_schema.sql` if anything changed since tasks 1–2, and set the spec statuses to `Done` once tasks 3, 4 and 11 pass.
  - Verify: docs match the implemented behavior. (Docs written; the statuses wait for the CI and the owner's checks.)
