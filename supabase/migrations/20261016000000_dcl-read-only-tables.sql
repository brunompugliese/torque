-- =============================================================================
-- DCL — shop and job_status_history become read-only at grant level too.
-- They were read-only through RLS alone (no write policy), so writes matched
-- zero rows instead of failing. Projects whose default privileges grant
-- INSERT/UPDATE/DELETE to authenticated (the Supabase default) kept those
-- grants. Revoking them makes writes fail with "permission denied", the same
-- as profile (20260928000001_dcl-profile-read-only.sql). Found by spec 003.
-- =============================================================================

revoke insert, update, delete on public.shop, public.job_status_history from authenticated;
