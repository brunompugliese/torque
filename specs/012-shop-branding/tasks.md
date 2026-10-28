# 012 — Shop branding: Tasks

**Status:** Approved (by the owner in conversation, 2026-10-28)
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [ ] **1. Shop columns**
  - Do: migration `20261028000000_ddl-shop-branding.sql` (`address`, `phone`, `logo_path` and the `shop_logo_path_in_own_folder` check); update `db_schema.sql`.
  - Verify: the "Database tests" workflow builds the database from the migrations.
- [ ] **2. Logos bucket and policy**
  - Do: migration `20261028000001_ddl-shop-logos-bucket.sql` (private `shop-logos` bucket with its size and type limits, `shop_logos_read_own` policy, no write policy); update `db_schema.sql`.
  - Verify: the workflow builds the database from the migrations.
- [ ] **3. Database tests**
  - Do: `supabase/tests/11_shop_branding.sql` and its row in `supabase/tests/README.md`: per-shop reads of the new columns, `shop` still read only, the `logo_path` check, the bucket's settings, and per-shop reads of `storage.objects` with `anon`, disabled profile and every write rejected.
  - Verify: the "Database tests" workflow passes.
- [ ] **4. Owner applies the migrations**
  - Do: the project owner runs `npx supabase db push` on `torque-dev` (never the agent), then regenerates the types if the project has them.
  - Verify: the owner sees the new columns and the `shop-logos` bucket in the dashboard.
- [x] **5. Shop query**
  - Do: `getShop()` in `src/features/shop/queries.ts` replaces `getShopName()` (Zod-parsed row, `{ name, address, phone, hasLogo }`, never the path, `null` on error) and update its callers; Vitest tests.
  - Verify: tests cover the mapping, no path exposed, error and malformed row; `npm test` and `npm run lint` pass.
- [x] **6. Shop context**
  - Do: `ShopProvider`, `useShop` and `useShopName` in `src/features/shop/shop-context.tsx`, replacing `shop-name-context.tsx`; update the quote code that uses the name; Vitest tests.
  - Verify: the quote button and message tests pass (only their provider changed); the context tests cover both hooks.
- [x] **7. Logo route**
  - Do: `GET /logo` in `src/app/logo/route.ts` (session, `logo_path`, Storage download, content type, `private, max-age=3600`, `404` without a logo or on error, nothing logged); Vitest tests.
  - Verify: tests cover `404` without a path, `404` on a download error, `200` with content type and cache header, and no path in the logs.
- [x] **8. ShopLogo**
  - Do: `src/components/shared/shop-logo.tsx` (square with `<img src="/logo">`, `LogoMark` and `WrenchIcon` fallback without `src` and after an `error`); Vitest tests.
  - Verify: tests cover the image (empty `alt`, fixed size), the fallback without `src` and after an `error` event.
- [x] **9. Header**
  - Do: `TopBar` shows `ShopLogo` + the shop's name (17px bold, 64px bar) and the app's mark and name when there is no shop; the `(app)` layout calls `getShop()` and feeds `ShopProvider` and `TopBar`; update the top bar tests.
  - Verify: `npm test`, `npm run lint` and `npm run build` pass; with no logo set, the header shows the wrench and the shop's name.
- [ ] **10. Owner uploads a logo**
  - Do: the project owner uploads a square PNG to `shop-logos/<shop id>/` in the dashboard and sets `logo_path`, `address` and `phone` on a shop.
  - Verify: with `npm run dev`, the logo shows in the header for a user of that shop, a user of another shop sees only the fallback, and a broken `logo_path` shows the fallback.
- [ ] **11. Docs**
  - Do: update `docs/design.md` (Logo, Header), `docs/architecture.md` (access matrix, Storage and `/logo`, `ShopProvider`, structure), `docs/environments.md` (bucket comes from the migration; logo, address and phone in the data step) and set the spec statuses to `Done`.
  - Verify: docs match the implemented behavior.
