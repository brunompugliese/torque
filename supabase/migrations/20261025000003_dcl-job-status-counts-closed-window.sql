-- =============================================================================
-- DCL — grants for public.job_status_counts with p_closed_from (spec 009).
-- The new signature starts executable by PUBLIC, so it is revoked here.
-- =============================================================================

revoke execute on function public.job_status_counts(text, boolean, timestamptz, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.job_status_counts(text, boolean, timestamptz, timestamptz, timestamptz, boolean) to authenticated;
