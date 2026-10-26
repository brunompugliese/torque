-- =============================================================================
-- DCL — grants for public.appointment_list (spec 008).
-- Same as the other views: read-only for authenticated, nothing for anon.
-- =============================================================================

grant select on public.appointment_list to authenticated;
revoke all on public.appointment_list from anon;
revoke insert, update, delete, truncate, references, trigger, maintain on public.appointment_list from authenticated;
