-- =============================================================================
-- DDL — shop branding (spec 012).
--   * A shop gets an address, a phone number and a logo, all optional, for the
--     app's header and for what the app prints for the shop.
--   * logo_path is the logo's path inside the private shop-logos bucket (created
--     in the next migration), always "<shop id>/<file>". The check makes it
--     impossible to point a shop at another shop's folder, even by a typo in the
--     dashboard.
--   * No grants change: authenticated already has table-level SELECT on shop,
--     and no policy allows writes, so only service_role (the dashboard) can set
--     these columns.
-- =============================================================================

alter table public.shop
  add column if not exists address   text,
  add column if not exists phone     text,
  add column if not exists logo_path text;

alter table public.shop drop constraint if exists shop_logo_path_in_own_folder;
alter table public.shop
  add constraint shop_logo_path_in_own_folder
  check (logo_path is null or logo_path like id::text || '/%');
