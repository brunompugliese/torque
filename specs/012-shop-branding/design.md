# 012 — Shop branding: Design

**Status:** Approved (by the owner in conversation, 2026-10-28)
**Requirements:** [requirements.md](requirements.md)

## Summary

`shop` gets three optional columns (address, phone, logo path). The logo is a file in a private Supabase Storage bucket, `shop-logos`, under a folder named after the shop's id; a Storage policy on the JWT `shop_id` claim lets users read only their own shop's folder, and nobody can write through the API (the project owner uploads in the dashboard).

The browser never gets a Storage URL. The app serves the logo itself from `GET /logo`, a route handler that downloads the file with the user's session (so the Storage policy applies) and returns it with a private cache header. A stable same-origin URL avoids signed URLs that expire while a tab stays open, and the same URL serves the header now and the print sheet of [spec 013](../013-print-job/requirements.md). The header draws the logo in a 40px square, falling back to the app's `LogoMark` when the shop has no logo or the image fails.

This changes the requirements' wording in one place: the requirements say "a short-lived signed URL"; the route handler achieves the same isolation (the policy decides, with the user's session) without the expiry problem. If the owner prefers signed URLs, only `GET /logo` and `ShopLogo` change.

## Database

Two migrations, one concern each, plus `db_schema.sql`.

**`20261028000000_ddl-shop-branding.sql`**

```sql
alter table public.shop
  add column address   text,
  add column phone     text,
  add column logo_path text,
  add constraint shop_logo_path_in_own_folder
    check (logo_path is null or logo_path like id::text || '/%');
```

- `address`, `phone`: free text, optional. The owner types them in the dashboard; the app formats the phone when showing it.
- `logo_path`: the object's path inside the bucket, e.g. `<shop id>/logo.png`. The check makes it impossible to point a shop at another shop's folder, even by a typo in the dashboard.
- No grants change: `authenticated` already has table-level `select` on `shop`, read-only, with no insert/update/delete policy, so the new columns are readable by the shop's own users and writable by nobody but `service_role`.

**`20261028000001_ddl-shop-logos-bucket.sql`**

- `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)` for `shop-logos`: `public = false`, `file_size_limit = 524288` (512 KB), `allowed_mime_types = {image/png, image/jpeg, image/webp}`, `on conflict (id) do update` so it can be re-run. The limits are enforced by Storage on every upload, dashboard included. Square shape and 512 × 512 px are guidance for the owner (written in `environments.md`), not enforced.
- One policy on `storage.objects`:

```sql
drop policy if exists shop_logos_read_own on storage.objects;
create policy shop_logos_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'shop_id')
    and public.is_current_profile_enabled()
  );
```

- No insert, update or delete policy exists, so Storage denies them to `anon` and `authenticated`. `service_role` and the dashboard bypass RLS. `anon` has no select policy, so it reads nothing.
- Comment in the file: why the policy mirrors the tables' rule, and why there is no write policy.

- RLS impact: `shop` keeps its policy untouched; the only new policy is the Storage read one above.
- No `dcl` file: Supabase owns the grants on `storage.*`.

## Frontend

**Data.** `getShopName()` in `features/shop/queries.ts` becomes `getShop()`: one query, `select("name, address, phone, logo_path")`, returning `{ name, address, phone, hasLogo }` (never the path: the browser has no use for it) or `null` on error (logged by code only, as today). `hasLogo` is `logo_path !== null`.

**`GET /logo`** (`src/app/logo/route.ts`):

1. `requireSession()`; reads the shop's `logo_path` (RLS).
2. No path → `404`. `supabase.storage.from("shop-logos").download(path)`; any error or missing file → `404`.
3. Success → the file's bytes with its stored `Content-Type` and `Cache-Control: private, max-age=3600` (the logo changes rarely; a replaced logo shows within an hour, or on a hard reload). `private` keeps shared caches out. The global `nosniff` header already applies, and SVG isn't an allowed type, so the image can't carry script.
4. No path, file name or URL is logged.

**Shell.** The `(app)` layout calls `getShop()` once and passes the result to `ShopProvider` (replacing `ShopNameProvider`) and to `TopBar`. `useShop()` returns the whole object so the job modal's print sheet (spec 013) can read name, address, phone and `hasLogo` on the client; `useShopName()` stays as a one-line selector so the quote message needs no change.

**Header** (design.md, Header and Logo). `TopBar` shows, on the left, `ShopLogo` and the shop's name in 17px bold (`truncate`); on the right, `actions` as today. The bar grows from 48px to 64px to hold the 40px square. The app's name is no longer written in the bar: with no shop (or no name), the bar shows `LogoMark` and "Torque", the fallback brand, so it is never empty. The login page is untouched.

**`ShopLogo`** (client, `components/shared/shop-logo.tsx`): props `src` (optional), `size` (40). With `src`, a rounded-xl square with a border and white background holding `<img src alt="" width height>` with `object-contain`, `loading="eager"` and fixed size so nothing shifts; on `onError` it switches to the fallback for good. Without `src`, or after an error, it renders `LogoMark` with the Phosphor `WrenchIcon` (the same mark as the login page). Decorative: `alt=""`, the name sits beside it. A plain `<img>` is used on purpose: Next's image optimizer is for remote or build-time images, and this one is a private, already-sized file behind the session (`@next/next/no-img-element` disabled on that line with the reason).

**Print sheet (spec 013)** will use `src="/logo"` the same way; nothing to do here.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `shop` columns, bucket, policy | `supabase/migrations/20261028…` | New |
| `getShop()` (was `getShopName`) | `src/features/shop/queries.ts` | Extended |
| `ShopProvider`, `useShop`, `useShopName` | `src/features/shop/shop-context.tsx` (replaces `shop-name-context.tsx`) | Extended / renamed |
| `GET /logo` | `src/app/logo/route.ts` | New |
| `ShopLogo` | `src/components/shared/shop-logo.tsx` | New, generic |
| `TopBar` | `src/components/shared/top-bar.tsx` | Extended (logo + name, 64px, fallback) |
| `LogoMark` | `src/components/shared/logo-mark.tsx` | Reused |
| `formatPhone` | `src/lib/format/` | Reused (the header doesn't show address or phone; the 013 sheet does) |
| `(app)` layout | `src/app/(app)/layout.tsx` | Extended |

Doc updates when done: `docs/design.md` (Logo: a shop's logo in a square with the app's mark as fallback; Header), `docs/architecture.md` (access matrix and a Storage paragraph, the `/logo` route, `ShopProvider`, structure), `docs/environments.md` (new-project checklist: bucket comes from the migration; upload the logo and fill in address and phone in step 7), `db_schema.sql`, `supabase/tests/README.md`.

## Validation

No user input exists: nothing is written from the app. The owner's dashboard input is constrained by the database (`logo_path` check) and the bucket (type and size). The shop row is parsed with a small Zod schema in `getShop()` (`name` string, the rest `string | null`) like the other queries, so an unexpected shape degrades to the fallback instead of throwing.

## UI text

No new visible text: the logo is decorative and the name is data. The fallback brand uses the existing `app.name` message.

## Tests

- **RLS (pgTAP)** `supabase/tests/11_shop_branding.sql`:
  - `shop` returns its own `address`, `phone` and `logo_path` to its users and nothing of the other shop; disabled profile and `anon` see nothing; insert, update and delete on `shop` still rejected.
  - `shop_logo_path_in_own_folder`: a `logo_path` outside the shop's folder is rejected, one inside or null accepted (as admin).
  - The bucket exists, is private, with the 512 KB limit and the three image types.
  - With one object per shop in `storage.objects` (inserted as admin): `user_a` sees only shop A's, `user_b` only B's, a disabled profile and `anon` none; insert, update and delete as `authenticated` are rejected.
- **Unit (Vitest):**
  - `ShopLogo`: image with `src`, empty `alt`, fixed size; fallback without `src`; fallback after an `error` event.
  - `TopBar`: logo + name; fallback brand without shop; actions on the right (updating the existing tests).
  - `getShop`: maps the row to `{ name, address, phone, hasLogo }`, never exposes the path, returns `null` on error, tolerates a malformed row.
  - `GET /logo`: `404` without a path and on a download error; `200` with the file's content type and `private` cache header on success; never logs the path.
  - `ShopProvider`: `useShop` and `useShopName`.
  - `(app)` layout test (if one exists) passes the shop to the provider.

## Risks and alternatives

- **CI may not have the `storage` schema.** The workflow builds the database with `supabase db start`, which starts only Postgres; the `storage.buckets` / `storage.objects` tables are created by the Storage service. If they're missing the migration fails in CI. First task of `tasks.md` is a check: if they're missing, CI switches to `supabase start` limited to the services needed (database and Storage). Decide after the check, before writing the policy tests.
- **Cache staleness.** A replaced logo can show the old one for up to an hour. Acceptable for something that changes almost never; `max-age` is one constant if it must change.
- **Alternatives rejected:**
  - Public bucket: any logo readable by anyone with the URL; breaks tenant isolation in the database.
  - Private bucket with a policy for any authenticated user: lets one shop read another's logo, no gain.
  - Signed URLs from the layout: they expire while a tab stays open (the logo breaks after the expiry), and each page load makes a new URL, defeating the browser cache.
  - A `logo_url` column pointing at an external host: no isolation control, and the file depends on a third party.
  - Storing the image in the table (`bytea` / base64): bloats every `shop` read, which happens on every page.
