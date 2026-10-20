-- =============================================================================
-- DCL — private.normalize_service() is a trigger function only (spec 004).
-- New functions get EXECUTE for PUBLIC by default; nobody needs to call this
-- one directly, the same as the other helpers in the private schema
-- (20261014000001_dcl-encryption.sql). The trigger fires without the grant.
-- =============================================================================

revoke execute on function private.normalize_service() from public, anon, authenticated;
