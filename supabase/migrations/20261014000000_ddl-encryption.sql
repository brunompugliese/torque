-- =============================================================================
-- DDL — encryption at rest for personal and vehicle-identifying data.
--
-- Encrypted columns: client.name, surname, dni, phone_number, email;
-- vehicle.plate, vin; appointment.reason; job.observations.
--
-- How it works:
--   * Keys live in Supabase Vault (secrets 'torque_data_key' and
--     'torque_hash_key'), created by hand per project (docs/environments.md),
--     never in migrations. They never leave the database.
--   * Clients write plaintext to the tables as usual. A BEFORE trigger
--     normalizes, hashes and encrypts it, so the tables only hold ciphertext
--     (base64 text). Columns a statement doesn't change are left as they are.
--   * Plate and DNI get a keyed hash (HMAC-SHA256) of the normalized value;
--     uniqueness per shop is enforced on (shop_id, hash).
--   * Reads go through security_invoker views (<table>_decrypted) that decrypt
--     only the rows RLS lets the caller see. The client and vehicle views
--     expose a normalized search_text so search, sorting and pagination keep
--     running in the database.
--   * Helpers live in the private schema, which the Data API doesn't expose.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Reads a Vault secret. security definer: callers never get access to Vault.
create or replace function private.vault_secret(secret_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = secret_name;

  if secret is null then
    raise exception 'Vault secret "%" is missing (see docs/environments.md)', secret_name;
  end if;
  return secret;
end;
$$;

-- security definer so the key is read as the owner, never as the caller.
create or replace function private.encrypt_text(plain text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select case
    when plain is null then null
    else encode(
      extensions.pgp_sym_encrypt(plain, private.vault_secret('torque_data_key'), 'cipher-algo=aes256, s2k-mode=1'),
      'base64'
    )
  end;
$$;

-- security definer for the same reason. Executable by authenticated so the
-- security_invoker views can call it; it's not reachable through the Data API
-- and RLS decides which ciphertext a caller can see in the first place.
create or replace function private.decrypt_text(cipher text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when cipher is null then null
    else extensions.pgp_sym_decrypt(decode(cipher, 'base64'), private.vault_secret('torque_data_key'))
  end;
$$;

-- Keyed hash of an already normalized value, for uniqueness checks.
create or replace function private.blind_index(normalized text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when normalized is null or normalized = '' then null
    else encode(extensions.hmac(normalized, private.vault_secret('torque_hash_key'), 'sha256'), 'hex')
  end;
$$;

-- Search normalization: lowercase, no accents, no spaces, dots or dashes,
-- so "AE 482", "ae482", "Suárez" and "35.123.456" match. The app applies the
-- same normalization to the search term.
create or replace function private.normalize_search(value text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')),
    '[[:space:].-]', '', 'g'
  ));
$$;

-- -----------------------------------------------------------------------------
-- Hash columns and per-shop uniqueness
-- -----------------------------------------------------------------------------

alter table public.client  add column if not exists dni_hash   text; -- set by trigger, never sent by clients
alter table public.vehicle add column if not exists plate_hash text not null; -- set by trigger, never sent by clients

alter table public.client  drop constraint if exists client_shop_id_dni_hash_key;
alter table public.client  add constraint client_shop_id_dni_hash_key unique (shop_id, dni_hash); -- NULLs don't collide: DNI stays optional
alter table public.vehicle drop constraint if exists vehicle_shop_id_plate_hash_key;
alter table public.vehicle add constraint vehicle_shop_id_plate_hash_key unique (shop_id, plate_hash);

-- -----------------------------------------------------------------------------
-- Encryption triggers
-- On insert every sensitive column is encrypted. On update only columns whose
-- value changed are (an unchanged column still holds its ciphertext).
-- -----------------------------------------------------------------------------

create or replace function private.encrypt_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.dni is distinct from old.dni then
    new.dni      := nullif(regexp_replace(new.dni, '\D', '', 'g'), ''); -- stored as digits only
    new.dni_hash := private.blind_index(new.dni);
    new.dni      := private.encrypt_text(new.dni);
  else
    new.dni_hash := old.dni_hash;
  end if;

  if tg_op = 'INSERT' or new.name         is distinct from old.name         then new.name         := private.encrypt_text(new.name);         end if;
  if tg_op = 'INSERT' or new.surname      is distinct from old.surname      then new.surname      := private.encrypt_text(new.surname);      end if;
  if tg_op = 'INSERT' or new.phone_number is distinct from old.phone_number then new.phone_number := private.encrypt_text(new.phone_number); end if;
  if tg_op = 'INSERT' or new.email        is distinct from old.email        then new.email        := private.encrypt_text(new.email);        end if;
  return new;
end;
$$;

create or replace function private.encrypt_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.plate is distinct from old.plate then
    new.plate      := upper(regexp_replace(new.plate, '[^[:alnum:]]', '', 'g')); -- stored uppercase, no spaces
    new.plate_hash := private.blind_index(new.plate);
    new.plate      := private.encrypt_text(new.plate);
  else
    new.plate_hash := old.plate_hash;
  end if;

  if tg_op = 'INSERT' or new.vin is distinct from old.vin then
    new.vin := private.encrypt_text(nullif(upper(trim(new.vin)), ''));
  end if;
  return new;
end;
$$;

create or replace function private.encrypt_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.reason is distinct from old.reason then
    new.reason := private.encrypt_text(new.reason);
  end if;
  return new;
end;
$$;

create or replace function private.encrypt_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.observations is distinct from old.observations then
    new.observations := private.encrypt_text(new.observations);
  end if;
  return new;
end;
$$;

create or replace trigger trg_client_encrypt      before insert or update on public.client      for each row execute function private.encrypt_client();
create or replace trigger trg_vehicle_encrypt     before insert or update on public.vehicle     for each row execute function private.encrypt_vehicle();
create or replace trigger trg_appointment_encrypt before insert or update on public.appointment for each row execute function private.encrypt_appointment();
create or replace trigger trg_job_encrypt         before insert or update on public.job         for each row execute function private.encrypt_job();

-- -----------------------------------------------------------------------------
-- Decrypted read views
-- security_invoker: the caller's RLS policies and grants on the base tables
-- apply, so a view never shows another shop's rows.
-- -----------------------------------------------------------------------------

create or replace view public.client_decrypted
with (security_invoker = true) as
select
  c.id, c.shop_id,
  d.name, d.surname, d.dni, d.phone_number, d.email,
  c.enabled, c.created_at, c.updated_at,
  private.normalize_search(concat_ws('|', concat(d.name, d.surname), d.dni, d.phone_number, d.email)) as search_text
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
  private.normalize_search(concat_ws('|', d.plate, d.vin, concat(b.name, m.name))) as search_text
from public.vehicle v
join public.brand b on b.id = v.brand_id
join public.model m on m.id = v.model_id
cross join lateral (
  select
    private.decrypt_text(v.plate) as plate,
    private.decrypt_text(v.vin)   as vin
) d;

create or replace view public.appointment_decrypted
with (security_invoker = true) as
select
  a.id, a.shop_id, a.vehicle_id, a.client_id, a.date, a.time,
  private.decrypt_text(a.reason) as reason,
  a.status, a.enabled, a.created_at, a.updated_at
from public.appointment a;

create or replace view public.job_decrypted
with (security_invoker = true) as
select
  j.id, j.shop_id, j.vehicle_id, j.client_id, j.assigned_to, j.appointment_id,
  j.status,
  private.decrypt_text(j.observations) as observations,
  j.kilometers, j.quoted_total, j.final_total,
  j.enabled, j.created_at, j.updated_at
from public.job j;
