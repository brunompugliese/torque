-- =============================================================================
-- DCL — grants for public.job_list and public.job_status_counts (spec 007).
-- Same as the other views: read-only for authenticated, nothing for anon. New
-- functions are executable by PUBLIC by default, so it is revoked here.
-- =============================================================================

grant select on public.job_list to authenticated;
revoke all on public.job_list from anon;
revoke insert, update, delete, truncate, references, trigger, maintain on public.job_list from authenticated;

revoke execute on function public.job_status_counts(text, boolean, timestamptz, timestamptz) from public, anon;
grant execute on function public.job_status_counts(text, boolean, timestamptz, timestamptz) to authenticated;
