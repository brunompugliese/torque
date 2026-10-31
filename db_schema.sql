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
  address    text, -- optional; set in the dashboard (shops are read-only for users)
  phone      text, -- optional; set in the dashboard, formatted by the app when shown
  logo_path  text, -- path inside the private shop-logos bucket, always "<shop id>/<file>"
  last_job_number integer not null default 0, -- the shop's job counter: the highest job.number given so far (trg_job_set_number)
  created_at timestamptz not null default now(),
  constraint shop_logo_path_in_own_folder -- a shop can't point at another shop's folder, even by a typo
    check (logo_path is null or logo_path like id::text || '/%')
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
-- No RLS: readable by logged-in users, insert-only for them, nothing for anon (see grants below).
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
  name_key    text not null, -- normalize_search(name), set by trg_service_normalize: A–Z sort and the app's "name taken" lookup (no unique constraint, by decision)
  search_text text not null, -- normalize_search(name|description), set by trg_service_normalize: search
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
  number         integer not null check (number > 0), -- sequential within the shop, set by trg_job_set_number (a number sent by the caller is
                                                      -- ignored), never reused, never changed (trg_job_number_immutable). The app shows it as "N° 000123"
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
  unique (shop_id, number), -- one number per job within a shop
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
create index idx_service_shop_name_key   on service(shop_id, name_key); -- A–Z sort and name lookup

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

-- Gives every new job the next number of its shop (spec 013). One UPDATE of the shop row: its
-- row lock makes two jobs created at the same moment in one shop wait for each other, so they
-- never share a number; other shops are not blocked. The counter moves in the insert's
-- transaction, so a failed insert leaves no gap, and nothing decrements it. security definer:
-- users can't update shop. Ignores any number the caller sent.
create or replace function public.set_job_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shop
  set last_job_number = last_job_number + 1
  where id = new.shop_id
  returning last_job_number into new.number;
  return new;
end;
$$;

create or replace trigger trg_job_set_number before insert on public.job
for each row execute function public.set_job_number();

-- The number never changes. Error 23514 job_number_immutable.
create or replace function public.guard_job_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.number is distinct from old.number then
    raise exception using errcode = '23514', message = 'job_number_immutable',
      detail = 'The number of a job cannot change.';
  end if;
  return new;
end;
$$;

create or replace trigger trg_job_number_immutable before update of number on public.job
for each row execute function public.guard_job_number();

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

-- service is not encrypted, but its name and description are normalized on
-- every write so sorting, search and the "name taken" lookup are plain column
-- filters. Overwrites whatever a client sends. Not generated columns:
-- normalize_search is stable (unaccent), not immutable.
create or replace function private.normalize_service()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name_key    := private.normalize_search(new.name);
  new.search_text := private.normalize_search(concat_ws('|', new.name, new.description));
  return new;
end;
$$;

create or replace trigger trg_service_normalize before insert or update on public.service
for each row execute function private.normalize_service();

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
  private.normalize_search(concat_ws('|', concat(d.name, d.surname), d.dni, d.phone_number, d.email)) as search_text,
  -- Sort keys of the clients page, computed here from the decrypted values and never stored:
  private.normalize_search(concat_ws(' ', d.name, d.surname)) as name_key,   -- A–Z ignoring case/accents
  case when d.dni ~ '^\d+$' then d.dni::numeric end           as dni_number, -- 7-digit DNIs before 8-digit
  regexp_replace(d.phone_number, '\D', '', 'g')               as phone_key,  -- digits only
  lower(d.email)                                              as email_key
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
  m.name as model_name,
  -- List columns (spec 006), computed only when a query selects or sorts by them and never stored.
  -- last_km: highest km among the non-archived jobs, the same rule as check_job_kilometers.
  (select max(j.kilometers) from public.job j where j.vehicle_id = v.id and j.enabled) as last_km,
  cd.name         as client_name,
  cd.surname      as client_surname,
  cd.phone_number as client_phone_number,
  c.enabled       as client_enabled,
  nullif(private.normalize_search(concat_ws(' ', cd.name, cd.surname)), '') as client_name_key, -- "Cliente" sort; null without a client (sorts last)
  private.normalize_search(concat_ws(' ', b.name, m.name))      as vehicle_key      -- "Vehículo" sort
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

-- Creates a client and a vehicle (or updates a vehicle) in one transaction, for the vehicle
-- form's "+ Crear cliente nuevo": a failed vehicle (taken plate) leaves no orphan client.
-- p_vehicle_id null creates, otherwise updates that vehicle. Returns the vehicle's id.
-- security invoker (the default): RLS, composite FKs and the encryption triggers apply as the
-- caller. The shop comes from the JWT claim; the app never sends it.
-- Errors: 23505 vehicle_plate_taken | client_dni_taken, P0002 vehicle_not_found.
create or replace function public.save_vehicle_with_new_client(
  p_vehicle_id   uuid,
  p_plate        text,
  p_brand_id     uuid,
  p_model_id     uuid,
  p_year         integer,
  p_vin          text,
  p_name         text,
  p_surname      text,
  p_phone_number text,
  p_dni          text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shop       uuid := ((select auth.jwt()) ->> 'shop_id')::uuid;
  v_client     uuid;
  v_vehicle    uuid;
  v_constraint text;
begin
  insert into public.client (shop_id, name, surname, phone_number, dni)
  values (v_shop, p_name, p_surname, p_phone_number, p_dni)
  returning id into v_client;

  if p_vehicle_id is null then
    insert into public.vehicle (shop_id, client_id, plate, brand_id, model_id, year, vin)
    values (v_shop, v_client, p_plate, p_brand_id, p_model_id, p_year, p_vin)
    returning id into v_vehicle;
  else
    update public.vehicle
    set client_id = v_client, plate = p_plate, brand_id = p_brand_id, model_id = p_model_id,
        year = p_year, vin = p_vin
    where id = p_vehicle_id
    returning id into v_vehicle;

    if v_vehicle is null then
      raise exception using errcode = 'P0002', message = 'vehicle_not_found';
    end if;
  end if;

  return v_vehicle;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    raise exception using errcode = '23505', message = case
      when v_constraint like '%plate_hash%' then 'vehicle_plate_taken'
      when v_constraint like '%dni_hash%'   then 'client_dni_taken'
      else 'unique_violation'
    end;
end;
$$;

revoke execute on function public.save_vehicle_with_new_client(uuid, text, uuid, uuid, integer, text, text, text, text, text)
  from public, anon;
grant execute on function public.save_vehicle_with_new_client(uuid, text, uuid, uuid, integer, text, text, text, text, text)
  to authenticated;

create or replace view public.appointment_decrypted
with (security_invoker = true) as
select
  a.id, a.shop_id, a.vehicle_id, a.client_id, a.date, a.time,
  private.decrypt_text(a.reason) as reason,
  a.status, a.enabled, a.created_at, a.updated_at
from public.appointment a;

-- The Turnos calendar (spec 008): an appointment with its vehicle, client and latest job, all
-- computed here and never stored (no personal data in plaintext columns). A column is only
-- computed when a query selects it. appointment_decrypted stays the light read.
--   job_id  the latest non-archived job linked to the appointment ("Ver trabajo"); null without one
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

create or replace view public.job_decrypted
with (security_invoker = true) as
select
  j.id, j.shop_id, j.vehicle_id, j.client_id, j.assigned_to, j.appointment_id,
  j.status,
  private.decrypt_text(j.observations) as observations,
  j.kilometers, j.quoted_total, j.final_total,
  j.enabled, j.created_at, j.updated_at
from public.job j;

-- The jobs page (spec 007): a job with its vehicle, client and appointment, plus the search text
-- and sort keys, all computed here and never stored (no personal data in plaintext columns). A
-- column is only computed when a query selects or sorts by it. job_decrypted stays the light read.
--   search_text      normalize_search of the number (six digits, zero padded), plate, brand + model and client name
--   number           the job's number: "N°" sort (spec 013)
--   vehicle_key      brand, model and year: "Vehículo" sort
--   client_name_key  name and surname: "Cliente" sort; null without a client (sorts last)
--   status_order     1–7, the status order of docs/design.md
--   total_amount     the final total when there is one, otherwise the quoted one: "Total" sort
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

-- Jobs per status for the Estado filter, in one request. Same filters as the list (a search always
-- includes archived records; without one the archived switch applies) except the Estado selection.
-- p_pattern: like pattern of the normalized search term (null/empty = none). p_from / p_to: bounds
-- on updated_at, p_to exclusive (the start of the day after "Hasta", Argentina time); null = none.
-- p_closed_from (Inicio, spec 009): when not null, entregado / cancelado jobs count only if updated_at
-- >= p_closed_from; the other statuses are unaffected; null = no such window. p_enabled_only: archived
-- jobs never count, even with a search (Inicio).
-- security invoker: RLS applies as the caller.
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

revoke execute on function public.job_status_counts(text, boolean, timestamptz, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.job_status_counts(text, boolean, timestamptz, timestamptz, timestamptz, boolean) to authenticated;

-- Saves a job, its services and its status in one transaction, for the job form (spec 007); it can
-- also create the client and some services on the spot. p_job_id null creates, otherwise updates.
-- p_items: [{ id?, service_id?, new_service?: {name, description}, quantity, quoted_unit_price,
-- final_unit_price }] in the order typed: items with an id are updated, without are inserted (one at
-- a time with clock_timestamp(), because now() is the same for the whole transaction and the order
-- of the services is created_at), and the job's items missing from the list are deleted. The quoted
-- price of an existing item is kept while the job is in the work phase (en_progreso, completado).
-- Order: new client, items, job. The job comes last because guard_closed_job_item looks at the stored
-- status ("to close a job, save its items first, then the status"); a job created directly as
-- entregado/cancelado is inserted as pendiente and closed after its items (two history entries).
-- The job is always updated, so updated_at moves when only the items changed.
-- security invoker: RLS, composite FKs, encryption and the business-rule triggers apply as the
-- caller. The shop comes from the JWT claim. Totals are calculated by the app. Returns the job's id.
-- Errors: the 23514 rules of the triggers, 23505 client_dni_taken, P0002 job_not_found |
-- job_item_not_found. A taken service name is checked by the app (no constraint, by decision).
create or replace function public.save_job(
  p_job_id         uuid,
  p_vehicle_id     uuid,
  p_client_id      uuid,
  p_status         text,
  p_kilometers     integer,
  p_appointment_id uuid,
  p_observations   text,
  p_quoted_total   numeric,
  p_final_total    numeric,
  p_items          jsonb,
  p_new_client     jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shop          uuid := ((select auth.jwt()) ->> 'shop_id')::uuid;
  v_client        uuid := p_client_id;
  v_job           uuid;
  v_stored_status text;
  v_item          jsonb;
  v_service       uuid;
  v_item_id       uuid;
  v_keep          uuid[] := '{}';
  v_constraint    text;
begin
  if jsonb_typeof(p_new_client) = 'object' then
    insert into public.client (shop_id, name, surname, phone_number, dni)
    values (v_shop, p_new_client ->> 'name', p_new_client ->> 'surname',
            p_new_client ->> 'phone_number', p_new_client ->> 'dni')
    returning id into v_client;
  end if;

  if p_job_id is null then
    insert into public.job (shop_id, vehicle_id, client_id, status, kilometers, appointment_id,
                            observations, quoted_total, final_total)
    values (v_shop, p_vehicle_id, v_client,
            case when p_status in ('entregado', 'cancelado') then 'pendiente' else p_status end,
            p_kilometers, p_appointment_id, p_observations, p_quoted_total, p_final_total)
    returning id, status into v_job, v_stored_status;
  else
    select id, status into v_job, v_stored_status
    from public.job
    where id = p_job_id
    for update;

    if v_job is null then
      raise exception using errcode = 'P0002', message = 'job_not_found';
    end if;
  end if;

  for v_item in
    select e.value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as e(value, n)
    order by e.n
  loop
    v_service := nullif(v_item ->> 'service_id', '')::uuid;
    if jsonb_typeof(v_item -> 'new_service') = 'object' then
      insert into public.service (shop_id, name, description)
      values (v_shop, v_item -> 'new_service' ->> 'name', v_item -> 'new_service' ->> 'description')
      returning id into v_service;
    end if;

    v_item_id := nullif(v_item ->> 'id', '')::uuid;
    if v_item_id is not null then
      update public.job_item
      set service_id        = v_service,
          quantity          = (v_item ->> 'quantity')::numeric,
          quoted_unit_price = case
                                when v_stored_status in ('en_progreso', 'completado') then quoted_unit_price
                                else (v_item ->> 'quoted_unit_price')::numeric
                              end,
          final_unit_price  = nullif(v_item ->> 'final_unit_price', '')::numeric
      where id = v_item_id and job_id = v_job;

      if not found then
        raise exception using errcode = 'P0002', message = 'job_item_not_found';
      end if;
    else
      insert into public.job_item (job_id, service_id, quantity, quoted_unit_price, final_unit_price, created_at)
      values (v_job, v_service, (v_item ->> 'quantity')::numeric, (v_item ->> 'quoted_unit_price')::numeric,
              nullif(v_item ->> 'final_unit_price', '')::numeric, clock_timestamp())
      returning id into v_item_id;
    end if;
    v_keep := v_keep || v_item_id;
  end loop;

  delete from public.job_item where job_id = v_job and not (id = any (v_keep));

  update public.job
  set vehicle_id     = p_vehicle_id,
      client_id      = v_client,
      status         = p_status,
      kilometers     = p_kilometers,
      appointment_id = p_appointment_id,
      observations   = p_observations,
      quoted_total   = p_quoted_total,
      final_total    = p_final_total
  where id = v_job;

  return v_job;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    raise exception using errcode = '23505', message = case
      when v_constraint like '%dni_hash%' then 'client_dni_taken'
      else 'unique_violation'
    end;
end;
$$;

revoke execute on function public.save_job(uuid, uuid, uuid, text, integer, uuid, text, numeric, numeric, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_job(uuid, uuid, uuid, text, integer, uuid, text, numeric, numeric, jsonb, jsonb)
  to authenticated;

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

-- Shop logos live in a private Storage bucket, one folder per shop
-- ("<shop id>/logo.png", matching shop.logo_path). The bucket enforces PNG, JPG
-- or WebP up to 512 KB; "square, 512 x 512 px" is guidance, not enforced.
-- The app reads a logo with the user's session (GET /logo), so this policy
-- decides. There is deliberately no insert/update/delete policy: Storage denies
-- writes to anon and authenticated, and the project owner uploads from the
-- dashboard (service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-logos', 'shop-logos', false, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shop_logos_read_own on storage.objects;
create policy shop_logos_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'shop_id')
    and public.is_current_profile_enabled()
  );

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

-- brand: logged-in users read and add entries; nobody else touches them. Update and
-- delete are revoked because the catalog is shared by every shop (changed by
-- 20261030000000_dcl-brand-model-restricted.sql); anon has nothing.
grant select, insert on public.brand to authenticated;
revoke all on public.brand from anon;
revoke update, delete, truncate, references, trigger, maintain on public.brand from authenticated;

-- model: same access as brand.
grant select, insert on public.model to authenticated;
revoke all on public.model from anon;
revoke update, delete, truncate, references, trigger, maintain on public.model from authenticated;

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

-- job_list (spec 007): read-only for authenticated, nothing for anon.
grant select on public.job_list to authenticated;
revoke all on public.job_list from anon;
revoke insert, update, delete, truncate, references, trigger, maintain on public.job_list from authenticated;

-- appointment_list (spec 008): read-only for authenticated, nothing for anon.
grant select on public.appointment_list to authenticated;
revoke all on public.appointment_list from anon;
revoke insert, update, delete, truncate, references, trigger, maintain on public.appointment_list from authenticated;
