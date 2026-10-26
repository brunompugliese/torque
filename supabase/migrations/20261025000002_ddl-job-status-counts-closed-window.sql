-- =============================================================================
-- DDL — public.job_status_counts gets a window for the closed statuses (spec 009).
--   * Inicio lists the open jobs of any age and, when asked, the delivered or
--     cancelled ones last updated in the last 30 days, and never archived jobs. Its
--     Estado counts must match, so the function takes two more parameters:
--       p_closed_from   when not null, jobs in entregado or cancelado count only if
--                       updated_at >= p_closed_from; the other statuses are unaffected.
--       p_enabled_only  when true, archived jobs never count, even with a search
--                       (a search normally includes them).
--     Both default to the behavior the Trabajos page relies on.
--   * A function's signature is part of its identity: the old one is dropped and
--     the new one created, so PostgREST never sees two overloads. EXECUTE is granted
--     in the matching dcl migration.
-- =============================================================================

drop function public.job_status_counts(text, boolean, timestamptz, timestamptz);

create or replace function public.job_status_counts(
  p_pattern       text,
  p_show_archived boolean,
  p_from          timestamptz,
  p_to            timestamptz,
  p_closed_from   timestamptz default null,
  p_enabled_only  boolean default false
)
returns table (status text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.status, count(*)
  from public.job_list l
  where (not p_enabled_only or l.enabled)
    and case
          when coalesce(p_pattern, '') <> '' then l.search_text like p_pattern
          when p_show_archived then true
          else l.enabled
        end
    and (p_from is null or l.updated_at >= p_from)
    and (p_to   is null or l.updated_at <  p_to)
    and (p_closed_from is null
         or l.status not in ('entregado', 'cancelado')
         or l.updated_at >= p_closed_from)
  group by l.status;
$$;
