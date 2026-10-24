-- =============================================================================
-- DCL — EXECUTE grants for public.save_job (spec 007).
-- New functions are executable by PUBLIC by default: revoke it and grant only
-- authenticated (the same as save_vehicle_with_new_client).
-- =============================================================================

revoke execute on function public.save_job(uuid, uuid, uuid, text, integer, uuid, text, numeric, numeric, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_job(uuid, uuid, uuid, text, integer, uuid, text, numeric, numeric, jsonb, jsonb)
  to authenticated;
