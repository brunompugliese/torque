-- =============================================================================
-- DDL — the job number in public.job_list (spec 013).
--   * number: the job's number, a new column at the end (a view can only grow there).
--     "N°" sort of the jobs page.
--   * search_text now also holds the number zero-padded to six digits, so "123" and
--     "000123" find the job. job_status_counts reads search_text and follows with no
--     change. It is a substring match, like every other search term.
--   * Grants stay as they are: create or replace keeps them.
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
  private.normalize_search(concat_ws('|', lpad(j.number::text, 6, '0'), vd.plate, concat(b.name, m.name), concat(cd.name, cd.surname))) as search_text,
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
  coalesce(j.final_total, j.quoted_total) as total_amount,
  j.number
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
