-- =============================================================================
-- DDL — sort keys on client_decrypted, brand and model names on
-- vehicle_decrypted (spec 005).
--   * The clients page sorts every column on the server. The values are
--     encrypted in the table, so the keys are computed in the view from the
--     decrypted values and are never stored (no personal data in plaintext
--     columns). A key is only computed when a query selects or sorts by it.
--       name_key   normalize_search of name and surname: A–Z ignoring case,
--                  accents, spaces, dots and dashes
--       dni_number DNI as a number, so 7-digit DNIs sort before 8-digit ones
--       phone_key  the phone's digits, whatever the format it was typed in
--       email_key  lowercase email
--   * The client modal lists a client's vehicles, so vehicle_decrypted also
--     exposes the brand and model names it already joins for search_text.
--   * `create or replace view` only appends columns, so every existing column,
--     the security_invoker option and the grants stay as they are.
-- =============================================================================

create or replace view public.client_decrypted
with (security_invoker = true) as
select
  c.id, c.shop_id,
  d.name, d.surname, d.dni, d.phone_number, d.email,
  c.enabled, c.created_at, c.updated_at,
  private.normalize_search(concat_ws('|', concat(d.name, d.surname), d.dni, d.phone_number, d.email)) as search_text,
  private.normalize_search(concat_ws(' ', d.name, d.surname))                                       as name_key,
  case when d.dni ~ '^\d+$' then d.dni::numeric end                                                 as dni_number,
  regexp_replace(d.phone_number, '\D', '', 'g')                                                     as phone_key,
  lower(d.email)                                                                                    as email_key
from public.client c
cross join lateral (
  select
    private.decrypt_text(c.name)         as name,
    private.decrypt_text(c.surname)      as surname,
    private.decrypt_text(c.dni)          as dni,
    private.decrypt_text(c.phone_number) as phone_number,
    private.decrypt_text(c.email)        as email
) d;

create or replace view public.vehicle_decrypted
with (security_invoker = true) as
select
  v.id, v.shop_id, v.client_id,
  d.plate, v.brand_id, v.model_id, v.year, d.vin,
  v.enabled, v.created_at, v.updated_at,
  private.normalize_search(concat_ws('|', d.plate, d.vin, concat(b.name, m.name))) as search_text,
  b.name as brand_name,
  m.name as model_name
from public.vehicle v
join public.brand b on b.id = v.brand_id
join public.model m on m.id = v.model_id
cross join lateral (
  select
    private.decrypt_text(v.plate) as plate,
    private.decrypt_text(v.vin)   as vin
) d;
