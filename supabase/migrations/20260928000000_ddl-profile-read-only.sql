-- =============================================================================
-- DDL — profile becomes read-only for the authenticated role.
-- Profiles are managed only from the Supabase dashboard (service_role), so
-- users can list their shop's profiles but never create, edit or delete them
-- (prevents self-promotion to 'owner' or re-enabling a disabled profile).
-- =============================================================================

drop policy if exists tenant_isolation on profile;
drop policy if exists tenant_isolation_select on profile;
create policy tenant_isolation_select on profile
  for select using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  ); -- read-only: no policy allows insert/update/delete, so those are denied by default
