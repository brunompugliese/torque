-- =============================================================================
-- DDL — public.job_list and public.job_status_counts (spec 007).
--   * The jobs page lists, searches, sorts, filters and opens jobs with their
--     vehicle, client and appointment. The vehicle's plate and the client's data
--     are encrypted and the totals live on the job, so everything the page needs
--     is computed in a view and never stored (no personal data in plaintext
--     columns). A column is only computed when a query selects or sorts by it.
--   * job_decrypted stays as it is: it is the light read of one job's own
--     columns; the joins below should not be paid on every read of it.
--       plate, vehicle_year, brand_name,
--       model_name, vehicle_enabled      the job's vehicle ("Patente", "Vehículo")
--       client_name, client_surname,
--       client_phone_number,
--       client_enabled                   the job's client, decrypted (null without one)
--       appointment_date,
--       appointment_time,
--       appointment_enabled              the linked appointment (null without one)
--       search_text                      normalize_search of plate, brand + model and client
--       vehicle_key                      brand, model and year: "Vehículo" sort
--       client_name_key                  name and surname: "Cliente" sort; null without a
--                                        client, so those jobs sort last
--       status_order                     1–7, the status order of docs/design.md
--       total_amount                     the final total when there is one, otherwise the
--                                        quoted one: "Total" sort
--   * job_status_counts: the number of jobs per status for the Estado filter, in
--     one request. Same filters as the list (search always includes archived
--     records; without a search the archived switch applies) except the Estado
--     selection itself.
--   * Both run as the caller (security_invoker / security invoker): RLS applies to
--     job, vehicle, client and appointment. EXECUTE and SELECT are granted in the
--     matching dcl migration.
-- =============================================================================

create or replace view public.job_list
with (security_invoker = true) as
select
  j.id, j.shop_id, j.vehicle_id, j.client_id, j.appointment_id,
  j.status, jd.observations, j.kilometers, j.quoted_total, j.final_total,
  j.enabled, j.created_at, j.updated_at,
  vd.plate,
  v.year          as vehicle_year,
  b.name          as brand_name,
  m.name          as model_name,
  v.enabled       as vehicle_enabled,
  cd.name         as client_name,
  cd.surname      as client_surname,
  cd.phone_number as client_phone_number,
  c.enabled       as client_enabled,
  a.date          as appointment_date,
  a.time          as appointment_time,
  a.enabled       as appointment_enabled,
  private.normalize_search(concat_ws('|', vd.plate, concat(b.name, m.name), concat(cd.name, cd.surname))) as search_text,
  private.normalize_search(concat_ws(' ', b.name, m.name, v.year::text))                                   as vehicle_key,
  nullif(private.normalize_search(concat_ws(' ', cd.name, cd.surname)), '')                                as client_name_key,
  case j.status
    when 'pendiente'            then 1
    when 'presupuesto_enviado'  then 2
    when 'presupuesto_aceptado' then 3
    when 'en_progreso'          then 4
    when 'completado'           then 5
    when 'entregado'            then 6
    when 'cancelado'            then 7
  end as status_order,
  coalesce(j.final_total, j.quoted_total) as total_amount
from public.job j
join public.vehicle v on v.id = j.vehicle_id and v.shop_id = j.shop_id
join public.brand b on b.id = v.brand_id
join public.model m on m.id = v.model_id
left join public.client c on c.id = j.client_id and c.shop_id = j.shop_id
left join public.appointment a on a.id = j.appointment_id and a.shop_id = j.shop_id
cross join lateral (
  select private.decrypt_text(j.observations) as observations
) jd
cross join lateral (
  select private.decrypt_text(v.plate) as plate
) vd
left join lateral (
  select
    private.decrypt_text(c.name)         as name,
    private.decrypt_text(c.surname)      as surname,
    private.decrypt_text(c.phone_number) as phone_number
) cd on true;

-- p_pattern: the like pattern of the normalized search term (null or empty = no search).
-- p_from / p_to: bounds on updated_at, p_to exclusive (the app sends the start of the day
-- after "Hasta" in Argentina time); null = no bound.
create or replace function public.job_status_counts(
  p_pattern       text,
  p_show_archived boolean,
  p_from          timestamptz,
  p_to            timestamptz
)
returns table (status text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.status, count(*)
  from public.job_list l
  where case
          when coalesce(p_pattern, '') <> '' then l.search_text like p_pattern
          when p_show_archived then true
          else l.enabled
        end
    and (p_from is null or l.updated_at >= p_from)
    and (p_to   is null or l.updated_at <  p_to)
  group by l.status;
$$;
