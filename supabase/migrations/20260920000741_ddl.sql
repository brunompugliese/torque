-- =============================================================================
-- TABLES
-- =============================================================================

create table shop (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table profile (
  id         uuid primary key references auth.users(id),
  shop_id    uuid not null references shop(id),
  role       text not null check (role in ('owner', 'mechanic', 'receptionist')),
  full_name  text not null,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
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
  unique (shop_id, dni),
  unique (id, shop_id)
);

create table brand (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  enabled boolean not null default true
);
create unique index idx_brand_name_ci on brand (lower(name));

create table vehicle (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shop(id),
  client_id  uuid,
  plate      text not null,
  brand_id   uuid not null references brand(id),
  model      text not null,
  year       int,
  vin        text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, plate),
  unique (id, shop_id),
  foreign key (client_id, shop_id) references client (id, shop_id)
);

create table service (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shop(id),
  name        text not null,
  description text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, shop_id)
);

create table appointment (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shop(id),
  vehicle_id uuid not null,
  client_id  uuid,
  date       date not null,
  time       time not null,
  reason     text,
  status     text not null default 'pendiente'
             check (status in ('pendiente', 'confirmado', 'cancelado')),
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (vehicle_id, shop_id) references vehicle (id, shop_id),
  foreign key (client_id, shop_id)  references client (id, shop_id)
);

create table job (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references shop(id),
  vehicle_id     uuid not null,
  client_id      uuid,         
  assigned_to    uuid,         
  appointment_id uuid,         
  status         text not null default 'borrador'
                 check (status in (
                   'borrador', 'presupuesto_enviado', 'presupuesto_aceptado',
                   'presupuesto_rechazado', 'pendiente', 'en_progreso',
                   'completado', 'entregado', 'cancelado'
                 )), 
  observations   text,
  quoted_total   numeric,
  final_total    numeric,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (vehicle_id, shop_id)     references vehicle (id, shop_id),     
  foreign key (client_id, shop_id)      references client (id, shop_id),     
  foreign key (assigned_to, shop_id)    references profile (id, shop_id),    
  foreign key (appointment_id, shop_id) references appointment (id, shop_id) 
);

create table job_item (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references job(id),
  shop_id            uuid not null, 
  service_id         uuid not null, 
  quantity           numeric not null default 1,
  quoted_unit_price  numeric not null,
  final_unit_price   numeric, 
  created_at         timestamptz not null default now(),
  foreign key (service_id, shop_id) references service (id, shop_id) 
);

create table job_status_history (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references job(id),
  old_status  text,
  new_status  text not null,
  changed_by  uuid references profile(id), 
  changed_at  timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_profile_shop            on profile(shop_id);

create index idx_client_shop             on client(shop_id);

create index idx_vehicle_shop            on vehicle(shop_id);
create index idx_vehicle_client          on vehicle(client_id);

create index idx_service_shop            on service(shop_id);

create index idx_appointment_shop        on appointment(shop_id);
create index idx_appointment_shop_date   on appointment(shop_id, date); 
create index idx_appointment_vehicle     on appointment(vehicle_id);
create index idx_appointment_client      on appointment(client_id);

create index idx_job_shop                on job(shop_id);
create index idx_job_shop_status         on job(shop_id, status); 
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

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_client_updated_at      before update on client      for each row execute function set_updated_at();
create or replace trigger trg_vehicle_updated_at     before update on vehicle     for each row execute function set_updated_at();
create or replace trigger trg_service_updated_at     before update on service     for each row execute function set_updated_at();
create or replace trigger trg_appointment_updated_at before update on appointment for each row execute function set_updated_at();
create or replace trigger trg_job_updated_at         before update on job         for each row execute function set_updated_at();

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

-- =============================================================================
-- RLS HELPER FUNCTION
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

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table shop enable row level security;
drop policy if exists tenant_isolation_select on shop;
create policy tenant_isolation_select on shop
  for select using (
    id = ((select auth.jwt()) ->> 'shop_id')::uuid
    and public.is_current_profile_enabled()
  ); 
  
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

alter table job_status_history enable row level security;
drop policy if exists tenant_isolation_select on job_status_history;
create policy tenant_isolation_select on job_status_history
  for select using (
    job_id in (select id from job where shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid)
    and public.is_current_profile_enabled()
  );

alter table brand disable row level security;
