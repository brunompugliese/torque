-- =============================================================================
-- DCL — EXECUTE on public.save_vehicle_with_new_client (spec 006).
-- New functions are executable by PUBLIC by default: only logged-in users
-- (authenticated) may call this one, never anon.
-- =============================================================================

revoke execute on function public.save_vehicle_with_new_client(uuid, text, uuid, uuid, integer, text, text, text, text, text)
  from public, anon;
grant execute on function public.save_vehicle_with_new_client(uuid, text, uuid, uuid, integer, text, text, text, text, text)
  to authenticated;
