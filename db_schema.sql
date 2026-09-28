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

create table client (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shop(id),
  name         text not null,
  surname      text,
  dni          text,
  phone_number text not null,
  email        text,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (shop_id, dni), -- NULLs don't collide, so dni can stay optional
  unique (id, shop_id)   -- lets other tables enforce "same shop as this client" via composite FK
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
  plate      text not null,
  brand_id   uuid not null references brand(id),
  model_id   uuid not null,
  year       int,
  vin        text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, plate), -- prevents the same physical car getting a duplicate row
  unique (id, shop_id),    -- lets other tables enforce "same shop as this vehicle" via composite FK
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
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, shop_id) -- lets job_item enforce "same shop as this service" via composite FK
);

create table appointment (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shop(id),
  vehicle_id uuid not null,
  client_id  uuid, -- optional: who's actually bringing the car in
  date       date not null,
  time       time not null,
  reason     text,
  status     text not null default 'pendiente'
             check (status in ('pendiente', 'confirmado', 'cancelado')),
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
  status         text not null default 'borrador'
                 check (status in (
                   'borrador', 'presupuesto_enviado', 'presupuesto_aceptado',
                   'presupuesto_rechazado', 'pendiente', 'en_progreso',
                   'completado', 'entregado', 'cancelado'
                 )), -- values constrained; order of transitions is NOT enforced, by choice
  observations   text,
  quoted_total   numeric,
  final_total    numeric,
  enabled        boolean not null default true,
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
  final_unit_price   numeric, -- filled in once work is actually done; may differ from quoted
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

alter table profile enable row level security;
drop policy if exists tenant_isolation on profile;
create policy tenant_isolation on profile
  for all using (
    shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  );

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

-- shop and job_status_history are read-only for clients.
grant select on public.shop to authenticated;

grant select, insert, update, delete on public.profile     to authenticated;
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
