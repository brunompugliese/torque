-- =============================================================================
-- DDL — public.appointment_list (spec 008).
--   * The Turnos calendar shows each appointment with its vehicle and client and
--     links it to its job. The vehicle's plate, the client's data and the reason
--     are encrypted, so everything the page needs is computed in a view and never
--     stored (no personal data in plaintext columns). A column is only computed
--     when a query selects it.
--   * appointment_decrypted stays as it is: it is the light read of one
--     appointment's own columns; the joins below should not be paid on every read.
--       reason                           decrypted free text
--       plate, vehicle_year, brand_name,
--       model_name, vehicle_enabled      the appointment's vehicle
--       client_name, client_surname,
--       client_phone_number,
--       client_enabled                   the stored client, decrypted (null without one)
--       job_id                           the latest non-archived job of the appointment
--                                        ("Ver trabajo"); null without one
--   * Runs as the caller (security_invoker): RLS applies to appointment, vehicle,
--     client and job. SELECT is granted in the matching dcl migration.
-- =============================================================================

create or replace view public.appointment_list
with (security_invoker = true) as
select
  a.id, a.shop_id, a.vehicle_id, a.client_id, a.date, a.time,
  ad.reason,
  a.status, a.enabled, a.created_at, a.updated_at,
  vd.plate,
  v.year          as vehicle_year,
  b.name          as brand_name,
  m.name          as model_name,
  v.enabled       as vehicle_enabled,
  cd.name         as client_name,
  cd.surname      as client_surname,
  cd.phone_number as client_phone_number,
  c.enabled       as client_enabled,
  lj.id           as job_id
from public.appointment a
join public.vehicle v on v.id = a.vehicle_id and v.shop_id = a.shop_id
join public.brand b on b.id = v.brand_id
join public.model m on m.id = v.model_id
left join public.client c on c.id = a.client_id and c.shop_id = a.shop_id
cross join lateral (
  select private.decrypt_text(a.reason) as reason
) ad
cross join lateral (
  select private.decrypt_text(v.plate) as plate
) vd
left join lateral (
  select
    private.decrypt_text(c.name)         as name,
    private.decrypt_text(c.surname)      as surname,
    private.decrypt_text(c.phone_number) as phone_number
) cd on true
left join lateral (
  select j.id
  from public.job j
  where j.appointment_id = a.id and j.shop_id = a.shop_id and j.enabled
  order by j.created_at desc, j.id desc
  limit 1
) lj on true;
