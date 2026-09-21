-- =============================================================================
-- DCL — grants and revokes for objects created in the DDL migration.
-- =============================================================================

revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

revoke execute on function public.is_current_profile_enabled() from public, anon;
grant execute on function public.is_current_profile_enabled() to authenticated;

grant select on public.brand to anon, authenticated;
grant insert, update, delete on public.brand to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.brand from anon;
revoke truncate, references, trigger on public.brand from authenticated;

grant select on public.shop to authenticated;

grant select, insert, update, delete on public.profile     to authenticated;
grant select, insert, update, delete on public.client      to authenticated;
grant select, insert, update, delete on public.vehicle     to authenticated;
grant select, insert, update, delete on public.service     to authenticated;
grant select, insert, update, delete on public.appointment to authenticated;
grant select, insert, update, delete on public.job         to authenticated;
grant select, insert, update, delete on public.job_item    to authenticated;

grant select on public.job_status_history to authenticated;