-- =============================================================================
-- DDL — private Storage bucket for shop logos (spec 012).
--   * shop-logos is private: no public URL exists. The app reads a logo with the
--     user's session (GET /logo) and the policy below decides, so tenant
--     isolation stays in the database.
--   * The bucket itself enforces what can be uploaded: PNG, JPG or WebP, up to
--     512 KB. "Square, 512 x 512 px" is guidance for the project owner
--     (docs/environments.md), not enforced.
--   * Objects live under a folder named after their shop's id
--     ("<shop id>/logo.png"), matching shop.logo_path.
--   * Read: a user can read only files in their own shop's folder, and only
--     while their profile is enabled (the same rule as the tables).
--   * Write: there is deliberately no insert, update or delete policy, so
--     Storage denies them to anon and authenticated. The project owner uploads
--     in the dashboard (service_role bypasses RLS).
--   * No dcl file: Supabase owns the grants on the storage schema.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-logos',
  'shop-logos',
  false,
  524288,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shop_logos_read_own on storage.objects;
create policy shop_logos_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'shop_id')
    and public.is_current_profile_enabled()
  );
