# 004 — Services page: Design

**Status:** Approved (by the owner in conversation, 2026-10-19)
**Requirements:** [requirements.md](requirements.md)

## Summary

`/servicios` is the first real list page, so it builds the shared list-page kit (table, toolbar, pagination, states, skeletons, detail modal, confirmation, URL state, list query) generic in `components/shared/`, `hooks/` and `lib/`, and the services page is a thin composition of it.

The page is a Server Component. The list state lives in the URL (`?buscar=&archivados=1&orden=creado&sentido=desc&pagina=2`), so search, sort and paging run on the server and a link reopens the same list. The first render streams inside `<Suspense>` boundaries with skeleton fallbacks; after that, list changes update the URL shallowly (`history.replaceState`) and fetch only the matching rows through the `searchServices` Server Action, without re-rendering the page. The service modal is client state opened from the row already loaded, so opening it costs no request. Writes are Server Actions that call `revalidatePath`, so the updated list comes back in the same response.

Cheap on the free tier: normalization happens once per write (trigger), reads are plain indexed column filters, and the counts use `head` queries.

## Database

One migration, `ddl-service-search`:

- `service.name_key text not null`: `private.normalize_search(name)`. Used to sort (case/accent-insensitive) and for the app's uniqueness lookup.
- `service.search_text text not null`: `private.normalize_search(name || '|' || description)`. Used by search.
- `private.normalize_service()` + `trg_service_normalize` (`before insert or update`): always recomputes both columns, so values sent by a client are overwritten. Security invoker; `normalize_search` is already executable by `authenticated`, and trigger functions don't need `EXECUTE` at fire time (same as the encryption triggers).
- Generated columns aren't possible: `normalize_search` is `stable` (it uses `unaccent`), and generated columns need `immutable` functions.
- Backfill existing rows with `trg_service_updated_at` disabled, so `updated_at` isn't touched; then `set not null`.
- `idx_service_shop_name_key on service (shop_id, name_key)`: serves the sort and the uniqueness lookup.
- No uniqueness constraint (owner's decision). No new grants: the columns are covered by the table's existing grants and RLS.

- Migrations: `<ts>_ddl-service-search.sql`.
- RLS impact: none; `service` keeps `tenant_isolation`. Tests confirm search and the new columns stay per shop.

## Frontend

### Route

```
src/app/(app)/servicios/
  page.tsx      # Server: requireSession, parse URL params, compose sections in Suspense
  loading.tsx   # Whole-page skeleton for navigation into the route
```

`page.tsx` renders:

1. `PageHeader` with the title, the summary inside `<Suspense>` (one-line skeleton), and the "Agregar servicio" button.
2. The list (`ServicesListView`: toolbar, table, pagination) in one `<Suspense>` with the toolbar and table skeletons as fallback. It's rendered once with the server's first page; later list changes keep it mounted, so the search box keeps focus.

The first render runs the list page (with `count`), the total count and the archived count, shared through `cache()`. Each later search, sort or page change runs only the list query (`searchServices`); the catalog total (for the empty states) comes from the first render and is refreshed when a save revalidates the page.

### URL state (`useListUrl`)

Params: `buscar`, `archivados` (`1`), `orden` (column id: `nombre` → `name_key`, `creado` → `created_at`; absent = no header marked, rows by `name_key`), `sentido` (`desc`; absent = ascending), `pagina` (absent = 1). Clicking the sorted column flips its direction; any other column, including the first click on any header, starts ascending.

Columns: "Servicio" (name in medium weight, description below in secondary text, truncated) and "Creado el" (shared `TableDate`: `DATE_FORMAT`, secondary text, no wrap). Any change but paging resets to page 1. Search is debounced (200 ms). The URL is updated with `history.replaceState` (no server render); `useListResults` fetches the rows and drops answers that arrive after a newer request.

### Interactions

- Row click / Enter / Space opens the service modal with that row.
- "Agregar servicio" opens the modal in create mode. On success, the modal switches to the new service (view mode), a toast confirms and the list refreshes via `revalidatePath`.
- Edit replaces the modal content with the form; Cancel goes back to view.
- Rename: the action answers `renameNeedsConfirmation` when the normalized name changed and the service is on a job item; the form shows the confirmation and resends with `confirmRename: true`.
- Archive: confirmation, then action; Unarchive: action directly.
- Uniqueness errors come back as field errors and land on Nombre with focus.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `Skeleton` | `components/ui/skeleton.tsx` | New (shadcn), pulse only with `motion-safe` |
| `Dialog`, `AlertDialog`, `Switch`, `Badge`, `Table`, `Textarea` | `components/ui/` | New (shadcn); overlays use `bg-foreground/10` (token rule) |
| `LoadingRegion` | `components/shared/loading-region.tsx` | New: `aria-busy` wrapper, one "Cargando…" |
| `DataTable` + `DataTableSkeleton` | `components/shared/data-table.tsx` | New: columns config, sortable headers with `aria-sort` styled per design.md (12px medium secondary text, sorted one in text color, up/down arrow until sorted), clickable keyboard rows, muted rows |
| `ListToolbar` + `ListToolbarSkeleton` | `components/shared/list-toolbar.tsx` | New: search, archived switch, count slot |
| `PaginationBar` | `components/shared/pagination-bar.tsx` | New |
| `ListEmpty`, `ListError` | `components/shared/list-states.tsx` | New |
| `ArchivedBadge` | `components/shared/archived-badge.tsx` | New |
| `DetailModal` | `components/shared/detail-modal.tsx` | New: header (title, badge, subtitle, actions, close), body, footer ("Creado el", "Volver") |
| `DetailList` | `components/shared/detail-list.tsx` | New: label/value pairs |
| `TableDate` | `components/shared/table-date.tsx` | New: a date in a table cell per design.md |
| `ConfirmDialog` | `components/shared/confirm-dialog.tsx` | New |
| `PageHeader` | `components/shared/page-header.tsx` | Extended: `description` accepts a node; title 28px bold per design.md |
| App layout | `app/(app)/layout.tsx` | Fixed: content width 1280px per design.md (was 1024px) |
| `NAV_ITEMS` | `lib/navigation.ts` | Extended: Servicios (`ToolboxIcon`) |
| `useListUrl` | `hooks/use-list-url.ts` | New |
| `useListResults` | `hooks/use-list-results.ts` | New: server rows first, then fetch-only updates |
| `parseListParams`, `toListSearch`, `LIST_PAGE_SIZE` | `lib/list/params.ts` | New |
| `pageWindow` | `lib/list/pagination.ts` | New: page numbers with gaps |
| `applyListQuery` | `lib/list/query.ts` | New: search on `search_text`, archived filter (off when searching), sort, range |
| `normalizeSearch`, `toSearchPattern` | `lib/search/normalize.ts` | New: app twin of `private.normalize_search` (conventions.md) |
| `findByKey`, `existsWhere` | `lib/data/lookups.ts` | New: one-row uniqueness lookup, existence check |
| `ActionResult` | `lib/actions/result.ts` | New: `{ ok: true, data } \| { ok: false, error, fieldErrors? }` |
| `DATE_FORMAT`, `APP_TIME_ZONE` | `lib/format/date.ts` | New; `i18n/request.ts` sets the time zone |
| `requiredTextField`, `optionalTextField` | `lib/validation/fields.ts` | Extended |
| Service schema, queries, actions | `features/service/` | New |
| `ServicesPanel` (modal provider), `ServicesTable`, `ServicesToolbar`, `ServiceModal`, `ServiceForm`, summary/count sections | `features/service/components/` | New |

Server data (`features/service/queries.ts`): `listServices(params)` and `getServiceCounts()`, wrapped in `cache()`, rows parsed with a Zod row schema (types aren't generated yet).

Actions (`features/service/actions.ts`): `createService`, `updateService`, `setServiceArchived`. Queries per save: create 2 (lookup, insert); edit without a rename 2 (current row, update); edit with a rename 4 (current, lookup, existence, update).

## Validation

`serviceFormSchema` (`features/service/schemas.ts`), used by the form and the actions:

- `name`: `requiredTextField("nameRequired")`: trimmed, inner whitespace collapsed to one space, required.
- `description`: `optionalTextField`: trimmed, empty → `null`, line breaks kept.

Uniqueness runs only in the action (it needs the database): `findByKey(service, name_key = normalizeSearch(name), excluding self)` → `nameTaken` or `nameTakenArchived` field error.

## UI text

`messages/es.json`:

- `nav.services`
- `common`: archived, archive, unarchive, cancel, back, close, createdOn, requiredFields, loading, unexpectedError, archiveConfirmBody
- `list`: showArchived, pagination labels, sort announcements, error/retry, clearSearch
- `validation.nameRequired`
- `services`: title, summary, count, columns, search placeholder, empty states, modal, form, confirmations, toasts, errors

Counts use ICU plurals.

## Tests

- RLS (pgTAP), `supabase/tests/06_services.sql`: `name_key` and `search_text` set on insert and update by the database, client-sent values overwritten, the same key for names that differ in case/accents/spaces/dots/dashes, search by name and description, archived rows found by key lookup, other shop's services never found, alphabetical order by `name_key`, both columns `not null`, the index exists. (The backfill runs before the fixtures exist, so it's verified by reading the migration, not by a test.)
- Unit (Vitest): every `lib/` helper, the hook, every shared component (including skeletons: `aria-busy`, one announcement), schema, actions (mocked Supabase: uniqueness, rename confirmation, archive, validation on the server), service components (modal flows, form errors), navigation and `PageHeader` updates.

## Risks and alternatives

- **App twin of `normalize_search`** may differ from `unaccent` for rare characters. The JS version strips combining marks after NFD, which matches `unaccent` for Spanish. Rejected: an RPC for the lookup (one more database function to maintain for no visible gain).
- **Race on uniqueness:** two simultaneous saves can duplicate a name. Accepted by the owner.
- **Modal from row data** can show stale data if another user edits the service meanwhile; saving returns the fresh row. Rejected: fetching on open (one extra request per click).
- **`count: "exact"`** costs a count per list request; fine at a shop's scale.
