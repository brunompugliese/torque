-- =============================================================================
-- DCL — profile becomes read-only for the authenticated role.
-- Revoked at grant level too, so writes fail even if a permissive policy is
-- added by mistake later.
-- =============================================================================

revoke insert, update, delete on public.profile from authenticated;
