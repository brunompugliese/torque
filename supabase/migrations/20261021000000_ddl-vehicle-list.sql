-- =============================================================================
-- DDL — list columns on vehicle_decrypted (spec 006).
--   * The vehicles page lists, sorts and opens vehicles with their client and
--     last km. The client's data is encrypted and the km lives on jobs, so the
--     values are computed in the view and never stored (no personal data in
--     plaintext columns). A column is only computed when a query selects or
--     sorts by it.
--       last_km              highest km among the vehicle's non-archived jobs:
--                            the same rule as check_job_kilometers, so it is
--                            what a new job's km is prefilled with
--       client_name,
--       client_surname,
--       client_phone_number  the vehicle's client, decrypted (null without one)
--       client_enabled       false when that client is archived
--       client_name_key      normalize_search of name and surname: "Cliente" sort;
--                            null without a client, so those vehicles sort last
--       vehicle_key          normalize_search of brand and model: "Vehículo" sort
--   * `create or replace view` only appends columns, so every existing column,
--     the security_invoker option and the grants stay as they are. RLS applies
--     to vehicle, client and job as the caller.
-- =============================================================================

create or replace view public.vehicle_decrypted
with (security_invoker = true) as
select
  v.id, v.shop_id, v.client_id,
  d.plate, v.brand_id, v.model_id, v.year, d.vin,
  v.enabled, v.created_at, v.updated_at,
  private.normalize_search(concat_ws('|', d.plate, d.vin, concat(b.name, m.name))) as search_text,
  b.name as brand_name,
  m.name as model_name,
  (select max(j.kilometers) from public.job j where j.vehicle_id = v.id and j.enabled) as last_km,
  cd.name         as client_name,
  cd.surname      as client_surname,
  cd.phone_number as client_phone_number,
  c.enabled       as client_enabled,
  nullif(private.normalize_search(concat_ws(' ', cd.name, cd.surname)), '') as client_name_key,
  private.normalize_search(concat_ws(' ', b.name, m.name))      as vehicle_key
from public.vehicle v
join public.brand b on b.id = v.brand_id
join public.model m on m.id = v.model_id
left join public.client c on c.id = v.client_id and c.shop_id = v.shop_id
cross join lateral (
  select
    private.decrypt_text(v.plate) as plate,
    private.decrypt_text(v.vin)   as vin
) d
left join lateral (
  select
    private.decrypt_text(c.name)         as name,
    private.decrypt_text(c.surname)      as surname,
    private.decrypt_text(c.phone_number) as phone_number
) cd on true;
