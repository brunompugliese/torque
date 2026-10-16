-- =============================================================================
-- MECHANIC SHOP APP — DATABASE SCHEMA
-- Vehicle-centric, multi-tenant-ready, single shop seeded for now.
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

create table shop (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- One row per person. id matches auth.users(id) 1:1.
create table profile (
  id         uuid primary key references auth.users(id),
  shop_id    uuid not null references shop(id),
  role       text not null check (role in ('owner', 'mechanic', 'receptionist')),
  full_name  text not null,
  enabled    boolean not null default true, -- disable to revoke access without deleting the auth user
  created_at timestamptz not null default now(),
  unique (id, shop_id) -- lets other tables enforce "same shop as this profile" via composite FK
);

-- Columns marked (encrypted) are written as plaintext and stored as
-- ciphertext by trg_client_encrypt; read them through client_decrypted.
-- See ENCRYPTION AT REST below.
create table client (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shop(id),
  name         text not null, -- (encrypted)
  surname      text,          -- (encrypted)
  dni          text,          -- (encrypted) digits only
  dni_hash     text,          -- keyed hash of dni; set by trigger, never sent by clients
  phone_number text not null, -- (encrypted)
  email        text,          -- (encrypted)
  enabled      boolean not null default true, -- false = archived ("Archivar" in the UI)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (shop_id, dni_hash), -- DNI unique per shop; NULLs don't collide, so dni can stay optional
  unique (id, shop_id)        -- lets other tables enforce "same shop as this client" via composite FK
);

-- Global catalog, shared across all shops on purpose (not tenant-scoped).
-- No RLS: readable by anyone, writable only by logged-in users (see grants below).
create table brand (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  enabled boolean not null default true
);
create unique index idx_brand_name_ci on brand (lower(name));

-- Global catalog like brand: shared across shops, no RLS, same grants.
create table model (
  id       uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brand(id),
  name     text not null,
  enabled  boolean not null default true,
  unique (id, brand_id) -- lets vehicle enforce "model belongs to this brand" via composite FK
);
create unique index idx_model_brand_name_ci on model (brand_id, lower(name)); -- one name per brand, case-insensitive; also serves brand_id lookups

-- brand+model is intentionally NOT unique: many vehicles share a brand and model.
-- Only the plate identifies a vehicle (unique per shop).
create table vehicle (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shop(id),
  client_id  uuid, -- optional: a vehicle doesn't require a known owner
  plate      text not null, -- (encrypted) uppercase, no spaces
  plate_hash text not null, -- keyed hash of plate; set by trigger, never sent by clients
  brand_id   uuid not null references brand(id),
  model_id   uuid not null,
  year       int,
  vin        text,          -- (encrypted)
  enabled    boolean not null default true, -- false = archived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, plate_hash), -- prevents the same physical car getting a duplicate row
  unique (id, shop_id),         -- lets other tables enforce "same shop as this vehicle" via composite FK
  foreign key (client_id, shop_id) references client (id, shop_id), -- client must belong to the same shop as the vehicle
  foreign key (model_id, brand_id) references model (id, brand_id)  -- model must belong to the vehicle's brand
);

-- Controlled vocabulary of job types. No price here on purpose —
-- job_item is the source of truth for what was actually charged.
create table service (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shop(id),
  name        text not null,
  description text,
  enabled     boolean not null default true, -- false = archived: can't be added to jobs, existing items keep it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, shop_id) -- lets job_item enforce "same shop as this service" via composite FK
);

create table appointment (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shop(id),
  vehicle_id uuid not null,
  client_id  uuid, -- the vehicle's owner when the appointment was created (set by the app); optional
  date       date not null,
  time       time not null,
  reason     text, -- (encrypted) free text that can contain personal details
  status     text not null default 'pendiente'
             check (status in ('pendiente', 'confirmado', 'completado', 'cancelado')), -- completado is set by hand; cancelado can go back to pendiente
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id), -- lets job enforce "same shop as this appointment" via composite FK
  foreign key (vehicle_id, shop_id) references vehicle (id, shop_id), -- vehicle must belong to the same shop as the appointment
  foreign key (client_id, shop_id)  references client (id, shop_id)  -- client must belong to the same shop as the appointment
);

create table job (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references shop(id),
  vehicle_id     uuid not null, -- every job is on a vehicle
  client_id      uuid,          -- who to talk to about THIS job, optional
  assigned_to    uuid,          -- user who is creating the job
  appointment_id uuid,          -- optional: not every job starts from a booking
  status         text not null default 'pendiente'
                 check (status in (
                   'pendiente', 'presupuesto_enviado', 'presupuesto_aceptado',
                   'en_progreso', 'completado', 'entregado', 'cancelado'
                 )), -- listed in display/sort order; order of transitions is NOT enforced, by choice.
                     -- A rejected quote is recorded as cancelado. entregado and cancelado are
                     -- closed: the row can then only be archived (trg_job_closed_guard).
  observations   text, -- (encrypted) free text that can contain personal details
  kilometers     integer check (kilometers >= 0), -- odometer when the job was opened; kept per job (not on vehicle) to preserve mileage history.
                                                  -- Can't be lower than the vehicle's previous jobs (trg_job_kilometers)
  quoted_total   numeric, -- Σ quantity × quoted_unit_price, calculated by the app
  final_total    numeric, -- Σ quantity × final_unit_price, work phase only, calculated by the app
  enabled        boolean not null default true, -- false = archived
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, shop_id), -- lets job_item enforce "same shop as this job" via composite FK
  foreign key (vehicle_id, shop_id)     references vehicle (id, shop_id),     -- vehicle must belong to the same shop as the job
  foreign key (client_id, shop_id)      references client (id, shop_id),     -- client must belong to the same shop as the job
  foreign key (assigned_to, shop_id)    references profile (id, shop_id),    -- assignee must belong to the same shop as the job
  foreign key (appointment_id, shop_id) references appointment (id, shop_id) -- appointment must belong to the same shop as the job
);

-- Line items. Prices are frozen here at the moment they're added
-- so a later rate change can't silently rewrite what a past client
-- was actually quoted or charged.
create table job_item (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null,
  shop_id            uuid not null, -- denormalized from job; set by trigger below, never sent by clients
  service_id         uuid not null, -- mandatory: every line is a named service
  quantity           numeric not null default 1,
  quoted_unit_price  numeric not null,
  final_unit_price   numeric, -- empty in the quote phase; in the work phase prefilled with the quoted price, may differ
  created_at         timestamptz not null default now(),
  foreign key (job_id, shop_id)     references job (id, shop_id),    -- job must belong to the same shop as the job_item (blocks re-pointing job_id to another tenant's job on update)
  foreign key (service_id, shop_id) references service (id, shop_id) -- service must belong to the same shop as the job_item
);

-- Append-only audit trail of job.status changes. No shop_id needed —
-- reached through job_id. No RLS insert/update/delete policy is given
-- to anyone; only the trigger below can write to it.
create table job_status_history (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references job(id),
  old_status  text,
  new_status  text not null,
  changed_by  uuid references profile(id), -- set by the trigger below (auth.uid()), never client-supplied
  changed_at  timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_profile_shop            on profile(shop_id);

create index idx_client_shop             on client(shop_id);

create index idx_vehicle_shop            on vehicle(shop_id);
create index idx_vehicle_client          on vehicle(client_id);
create index idx_vehicle_model           on vehicle(model_id);

create index idx_service_shop            on service(shop_id);

create index idx_appointment_shop        on appointment(shop_id);
create index idx_appointment_shop_date   on appointment(shop_id, date); -- calendar view
create index idx_appointment_vehicle     on appointment(vehicle_id);
create index idx_appointment_client      on appointment(client_id);

create index idx_job_shop                on job(shop_id);
create index idx_job_shop_status         on job(shop_id, status); -- kanban board
create index idx_job_vehicle             on job(vehicle_id);
create index idx_job_client              on job(client_id);
create index idx_job_appointment         on job(appointment_id);

create index idx_job_item_job            on job_item(job_id);
create index idx_job_item_shop           on job_item(shop_id);
create index idx_job_item_service        on job_item(service_id);

create index idx_job_status_history_job  on job_status_history(job_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Generic updated_at bump, applied to every table that has the column.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = '' -- pinned so callers can't shadow now() via search_path
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_client_updated_at      before update on client      for each row execute function set_updated_at();
create or replace trigger trg_vehicle_updated_at     before update on vehicle     for each row execute function set_updated_at();
create or replace trigger trg_service_updated_at     before update on service     for each row execute function set_updated_at();
create or replace trigger trg_appointment_updated_at before update on appointment for each row execute function set_updated_at();
create or replace trigger trg_job_updated_at         before update on job         for each row execute function set_updated_at();

-- Copies shop_id from the parent job so job_item never needs it as client input,
-- and the composite FK to service can enforce tenant isolation.
create or replace function set_job_item_shop_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select shop_id into new.shop_id from public.job where id = new.job_id;
  return new;
end;
$$;

create or replace trigger trg_job_item_set_shop_id before insert on job_item for each row execute function set_job_item_shop_id();

-- Auto-log every job.status change into job_status_history.
create or replace function log_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.job_status_history (job_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif (old.status is distinct from new.status) then
    insert into public.job_status_history (job_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_status_change after insert or update on job for each row execute function log_job_status_change();

-- Blocks login for disabled profiles by syncing to auth.users.banned_until,
-- which Supabase Auth checks on every sign-in/refresh attempt. Fires on
-- insert, and on update only when enabled is part of the SET clause.
create or replace function sync_profile_enabled_to_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.enabled then
    update auth.users set banned_until = null where id = new.id;
  else
    update auth.users set banned_until = now() + interval '100 years' where id = new.id;
  end if;
  return new;
end;
$$;

create or replace trigger trg_profile_enabled_sync
after insert or update of enabled on profile
for each row execute function sync_profile_enabled_to_auth();

-- =============================================================================
-- BUSINESS RULES (triggers)
-- Enforced in the database so a buggy client can't break them. Errors use
-- SQLSTATE 23514 with a stable message the app maps to UI text:
-- job_closed, job_kilometers_below_previous, vehicle_archived,
-- client_archived, service_archived. Security invoker: lookups stay within
-- the caller's shop through RLS.
-- =============================================================================

-- A closed job (entregado, cancelado) can only be archived/unarchived.
-- Compares the whole row except enabled and updated_at; runs before
-- trg_job_encrypt (name order), so it sees what the caller sent.
-- To close a job, save its items first, then the status.
create or replace function public.guard_closed_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('entregado', 'cancelado')
     and (to_jsonb(new) - 'enabled' - 'updated_at') is distinct from (to_jsonb(old) - 'enabled' - 'updated_at') then
    raise exception using errcode = '23514', message = 'job_closed',
      detail = 'A delivered or cancelled job can only be archived or unarchived.';
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_closed_guard before update on public.job
for each row execute function public.guard_closed_job();

-- Items of a closed job can't be added, changed or removed.
create or replace function public.guard_closed_job_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op in ('UPDATE', 'DELETE') and exists (
        select 1 from public.job where id = old.job_id and status in ('entregado', 'cancelado')))
     or (tg_op in ('INSERT', 'UPDATE') and exists (
        select 1 from public.job where id = new.job_id and status in ('entregado', 'cancelado'))) then
    raise exception using errcode = '23514', message = 'job_closed',
      detail = 'Items of a delivered or cancelled job cannot change.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_item_closed_guard before insert or update or delete on public.job_item
for each row execute function public.guard_closed_job_item();

-- A job's km can't be lower than the vehicle's previous jobs: its other
-- non-archived jobs created before this one. Correcting an old job isn't
-- blocked by later ones; archiving a job with a mistyped reading removes it
-- from the check. No previous km → any value >= 0.
create or replace function public.check_job_kilometers()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_km integer;
begin
  if new.kilometers is null then
    return new;
  end if;
  select max(j.kilometers) into previous_km
  from public.job j
  where j.vehicle_id = new.vehicle_id
    and j.id <> new.id
    and j.enabled
    and j.created_at < new.created_at;
  if previous_km is not null and new.kilometers < previous_km then
    raise exception using errcode = '23514', message = 'job_kilometers_below_previous',
      detail = format('Kilometers must be at least %s.', previous_km);
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_kilometers before insert or update of kilometers, vehicle_id on public.job
for each row execute function public.check_job_kilometers();

-- Archived parents: checked only when the reference is set or changed, so
-- existing records keep working after a parent is archived.
-- Archived vehicles get no new appointments or jobs; archived clients can't
-- be put on jobs (they stay valid as vehicle owners); archived services
-- can't be added to jobs.
create or replace function public.check_appointment_parents_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id)
     and exists (select 1 from public.vehicle where id = new.vehicle_id and not enabled) then
    raise exception using errcode = '23514', message = 'vehicle_archived';
  end if;
  return new;
end;
$$;

create or replace trigger trg_appointment_parents_active before insert or update of vehicle_id on public.appointment
for each row execute function public.check_appointment_parents_active();

create or replace function public.check_job_parents_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id)
     and exists (select 1 from public.vehicle where id = new.vehicle_id and not enabled) then
    raise exception using errcode = '23514', message = 'vehicle_archived';
  end if;
  if (tg_op = 'INSERT' or new.client_id is distinct from old.client_id)
     and exists (select 1 from public.client where id = new.client_id and not enabled) then
    raise exception using errcode = '23514', message = 'client_archived';
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_parents_active before insert or update of vehicle_id, client_id on public.job
for each row execute function public.check_job_parents_active();

create or replace function public.check_job_item_service_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.service_id is distinct from old.service_id)
     and exists (select 1 from public.service where id = new.service_id and not enabled) then
    raise exception using errcode = '23514', message = 'service_archived';
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_item_service_active before insert or update of service_id on public.job_item
for each row execute function public.check_job_item_service_active();

-- =============================================================================
-- ENCRYPTION AT REST
-- Encrypted: client.name, surname, dni, phone_number, email; vehicle.plate,
-- vin; appointment.reason; job.observations.
--   * Keys live in Supabase Vault ('torque_data_key', 'torque_hash_key'),
--     created by hand per project (docs/environments.md), never in
--     migrations, and never leave the database.
--   * Clients write plaintext to the tables. A BEFORE trigger normalizes,
--     hashes and encrypts it (pgp_sym_encrypt, AES-256, stored as base64
--     text). On update only changed columns are re-encrypted.
--   * Plate and DNI also get a keyed hash (HMAC-SHA256) of the normalized
--     value; uniqueness per shop is enforced on (shop_id, hash).
--   * Reads go through security_invoker views (<table>_decrypted), which
--     decrypt only rows RLS lets the caller see. client_decrypted and
--     vehicle_decrypted expose search_text, so search, sorting and
--     pagination still run in the database.
--   * Helpers live in the private schema, not exposed by the Data API.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists private;

-- security definer: callers never get access to Vault.
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
  select decrypted_secret into secret from vault.decrypted_secrets where name = secret_name;
  if secret is null then
    raise exception 'Vault secret "%" is missing (see docs/environments.md)', secret_name;
  end if;
  return secret;
end;
$$;

create or replace function private.encrypt_text(plain text)
returns text
language sql
volatile
security definer -- reads the key as the owner
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

-- Executable by authenticated so the security_invoker views can call it; not
-- reachable through the Data API, and RLS decides which ciphertext a caller
-- sees in the first place.
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

-- Lowercase, no accents, no spaces/dots/dashes: "AE 482", "ae482", "Suárez",
-- "35.123.456" all match. The app normalizes the search term the same way.
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

-- On insert every sensitive column is encrypted; on update only changed ones
-- (an unchanged column still holds its ciphertext). Hashes can't be set by
-- clients: they are recomputed or kept from the old row.
create or replace function private.encrypt_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.dni is distinct from old.dni then
    new.dni      := nullif(regexp_replace(new.dni, '\D', '', 'g'), ''); -- digits only
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
    new.plate      := upper(regexp_replace(new.plate, '[^[:alnum:]]', '', 'g')); -- uppercase, no spaces
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

-- Decrypted read views. security_invoker: the caller's RLS and grants on the
-- base tables apply, so a view never shows another shop's rows. Write to the
-- base tables; read back through these views.
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

-- =============================================================================
-- MULTI-TENANCY: custom claim on the JWT
-- NOTE: register this as the "Customize Access Token (Auth) Hook" in the
-- Supabase Dashboard (Authentication > Hooks). Verify the exact event/claims
-- field names against current Supabase docs when wiring this up — the hook
-- API has changed shape before.
-- =============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  user_shop_id uuid;
  user_id_input uuid;
begin
  begin
    user_id_input := (event->>'user_id')::uuid;
  exception when others then
    return event;
  end;

  claims := coalesce(event->'claims', '{}'::jsonb);

  select shop_id into user_shop_id
  from public.profile
  where id = user_id_input
  limit 1;

  if user_shop_id is not null then
    claims := jsonb_set(claims, '{shop_id}', to_jsonb(user_shop_id));
  else
    claims := claims - 'shop_id';
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;

exception when others then
  return event;
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- =============================================================================
-- RLS HELPER FUNCTION
-- SECURITY DEFINER so the internal lookup on profile bypasses RLS — calling
-- this from profile's own policy would otherwise recurse into that same
-- policy and fail with "infinite recursion detected" (42P17).
-- =============================================================================

create or replace function public.is_current_profile_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select enabled from public.profile where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.is_current_profile_enabled() from public, anon;
grant execute on function public.is_current_profile_enabled() to authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Tables with their own shop_id: direct comparison against the JWT claim.
-- job_status_history (no shop_id) reaches the check through job_id. Policies
-- below use FOR ALL for brevity — split into separate SELECT/INSERT/UPDATE/
-- DELETE policies later if you want tighter, per-operation control.
--
-- Bootstrapping note: creating the very first shop + profile for a new
-- tenant cannot go through these policies (a user can't have an enabled
-- profile before their profile row exists), so onboarding must run via
-- service_role (an Edge Function or an admin-side script), not the
-- authenticated client role.
--
-- brand is intentionally excluded: it's a global catalog, not tenant-scoped
-- (see its own grants at the end of this section).
-- =============================================================================

alter table shop enable row level security;
drop policy if exists tenant_isolation_select on shop;
create policy tenant_isolation_select on shop
  for select using (
    id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  ); -- read-only: no policy allows insert/update/delete, so those are denied by default for anon/authenticated

-- profile is read-only for users: profiles are managed only from the Supabase
-- dashboard (service_role). Prevents self-promotion to 'owner' or re-enabling
-- a disabled profile.
alter table profile enable row level security;
drop policy if exists tenant_isolation_select on profile;
create policy tenant_isolation_select on profile
  for select using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  ); -- read-only: no policy allows insert/update/delete

alter table client enable row level security;
drop policy if exists tenant_isolation on client;
create policy tenant_isolation on client
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  )
  with check (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

alter table vehicle enable row level security;
drop policy if exists tenant_isolation on vehicle;
create policy tenant_isolation on vehicle
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  )
  with check (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

alter table service enable row level security;
drop policy if exists tenant_isolation on service;
create policy tenant_isolation on service
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  )
  with check (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

alter table appointment enable row level security;
drop policy if exists tenant_isolation on appointment;
create policy tenant_isolation on appointment
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  )
  with check (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

alter table job enable row level security;
drop policy if exists tenant_isolation on job;
create policy tenant_isolation on job
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  )
  with check (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

-- job_item carries its own shop_id (denormalized from job), so it's checked
-- directly instead of reaching through job_id like job_status_history does.
alter table job_item enable row level security;
drop policy if exists tenant_isolation on job_item;
create policy tenant_isolation on job_item
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  )
  with check (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

-- job_status_history: readable within the tenant, but not writable by
-- anyone directly — only the trigger (security definer) can insert.
alter table job_status_history enable row level security;
drop policy if exists tenant_isolation_select on job_status_history;
create policy tenant_isolation_select on job_status_history
  for select using (
    job_id in (select id from job where shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid)
    and public.is_current_profile_enabled()
  );

-- brand/model: shared catalogs, no RLS. Grants alone control access (see below).
-- Disabled explicitly in case an auto-enable-RLS event trigger turned it on at create time.
alter table brand disable row level security;
alter table model disable row level security;

-- =============================================================================
-- GRANTS
-- This project's default privileges give anon/authenticated only
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on new tables — no SELECT/INSERT/
-- UPDATE/DELETE — so Data API access must be granted explicitly here.
-- TRUNCATE bypasses RLS, so it's revoked everywhere.
-- =============================================================================

-- brand: anyone (even anon) can read; only logged-in users can manage entries.
grant select on public.brand to anon, authenticated;
grant insert, update, delete on public.brand to authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on public.brand from anon;
revoke truncate, references, trigger, maintain on public.brand from authenticated;

-- model: same access as brand.
grant select on public.model to anon, authenticated;
grant insert, update, delete on public.model to authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on public.model from anon;
revoke truncate, references, trigger, maintain on public.model from authenticated;

-- shop, profile and job_status_history are read-only for clients: SELECT is
-- granted and writes are revoked explicitly, because the Supabase default
-- privileges may already have granted them (RLS alone would only make writes
-- match zero rows instead of failing).
grant select on public.shop    to authenticated;
grant select on public.profile to authenticated;
revoke insert, update, delete on public.shop, public.profile, public.job_status_history from authenticated;

grant select, insert, update, delete on public.client      to authenticated;
grant select, insert, update, delete on public.vehicle     to authenticated;
grant select, insert, update, delete on public.service     to authenticated;
grant select, insert, update, delete on public.appointment to authenticated;
grant select, insert, update, delete on public.job         to authenticated;
grant select, insert, update, delete on public.job_item    to authenticated;

grant select on public.job_status_history to authenticated;

-- Tenant tables: nothing for anon, no table-level admin privileges for authenticated.
revoke all on public.shop, public.profile, public.client, public.vehicle, public.service,
              public.appointment, public.job, public.job_item, public.job_status_history
  from anon;
revoke truncate, references, trigger, maintain
  on public.shop, public.profile, public.client, public.vehicle, public.service,
     public.appointment, public.job, public.job_item, public.job_status_history
  from authenticated;

-- Encryption: authenticated may only decrypt and normalize (needed by the
-- security_invoker views); it can never read Vault, encrypt or hash directly.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.decrypt_text(text)     to authenticated;
grant execute on function private.normalize_search(text) to authenticated;

-- Decrypted views: read-only for authenticated, nothing for anon.
grant select on public.client_decrypted, public.vehicle_decrypted,
                public.appointment_decrypted, public.job_decrypted
  to authenticated;
revoke all on public.client_decrypted, public.vehicle_decrypted,
              public.appointment_decrypted, public.job_decrypted
  from anon;
revoke insert, update, delete, truncate, references, trigger, maintain
  on public.client_decrypted, public.vehicle_decrypted,
     public.appointment_decrypted, public.job_decrypted
  from authenticated;
