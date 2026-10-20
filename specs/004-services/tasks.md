# 004 — Services page: Tasks

**Status:** Approved (by the owner in conversation, 2026-10-19)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [ ] **1. Database: normalized name and search text**
  - Do: migration `ddl-service-search` (columns, trigger, backfill, index); `db_schema.sql`; `supabase/tests/06_services.sql`; tests README.
  - Verify: `npx supabase test db` passes (CI, or locally with Docker).
  - Written; not run yet (Docker isn't running locally). Pending the CI run on the PR.
- [x] **2. Shared helpers**
  - Do: `lib/search/normalize.ts`, `lib/list/params.ts`, `lib/list/pagination.ts`, `lib/list/query.ts`, `lib/data/lookups.ts`, `lib/actions/result.ts`, `lib/format/date.ts` (+ time zone in `i18n/request.ts`), `requiredTextField`/`optionalTextField` in `lib/validation/fields.ts`, `hooks/use-list-url.ts`.
  - Verify: Vitest tests for each.
- [x] **3. UI primitives and shared components**
  - Do: shadcn `skeleton`, `dialog`, `alert-dialog`, `switch`, `badge`, `table`, `textarea` (token-only overlays, reduced-motion pulse); `LoadingRegion`, `DataTable` + skeleton, `ListToolbar` + skeleton, `PaginationBar`, `ListEmpty`/`ListError`, `ArchivedBadge`, `DetailModal`, `DetailList`, `ConfirmDialog`; `PageHeader` extended; layout width; shared messages.
  - Verify: Vitest tests for each component; theme-token test passes.
- [x] **4. Navigation**
  - Do: Servicios in `NAV_ITEMS` and `nav.services`.
  - Verify: navigation and floating-nav tests.
- [x] **5. Service data layer**
  - Do: `features/service/schemas.ts`, `queries.ts`, `actions.ts`; `services` messages.
  - Verify: schema and action tests (validation on the server, uniqueness active/archived/self, rename confirmation, archive/unarchive, unexpected errors).
- [x] **6. Services page**
  - Do: `app/(app)/servicios/page.tsx` + `loading.tsx`; `features/service/components/*` (panel/modal provider, table, toolbar, summary, count, modal, form).
  - Verify: component tests (list states, row opens modal, create/edit/rename/archive/unarchive flows, toasts, errors on Nombre); `npm test`, `npm run lint`, `npm run build`.
- [x] **7. Docs**
  - Do: `docs/architecture.md` (service columns and trigger, list kit, structure), `docs/conventions.md` if conventions changed, spec statuses to `Done` (once task 1 is verified).
  - Verify: docs match the implemented behavior.
