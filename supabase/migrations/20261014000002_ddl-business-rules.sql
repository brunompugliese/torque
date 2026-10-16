-- =============================================================================
-- DDL — business rules enforced by the database, so a buggy client can't
-- break them (docs/design.md, "Global business rules"):
--   * A closed job (entregado, cancelado) can't be edited again, only
--     archived or unarchived; its items are frozen too.
--   * A job's kilometers can't be lower than the vehicle's previous jobs.
--   * Archived vehicles get no new appointments or jobs, archived clients
--     can't be put on jobs, archived services can't be added to jobs.
-- Errors use SQLSTATE 23514 (check_violation) with a stable message the app
-- maps to UI text.
-- Security invoker: every lookup stays within the caller's shop through RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Closed jobs
-- -----------------------------------------------------------------------------

-- Compares the whole row except enabled and updated_at. Runs before
-- trg_job_encrypt (triggers fire in name order), so it sees the values the
-- caller sent. To close a job, save its items first, then the status.
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

create or replace trigger trg_job_closed_guard
before update on public.job
for each row execute function public.guard_closed_job();

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

create or replace trigger trg_job_item_closed_guard
before insert or update or delete on public.job_item
for each row execute function public.guard_closed_job_item();

-- -----------------------------------------------------------------------------
-- Kilometers
-- "Previous" means the vehicle's other non-archived jobs created before this
-- one, so correcting an old job isn't blocked by later ones, and archiving a
-- job with a mistyped reading removes it from the check.
-- -----------------------------------------------------------------------------

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

create or replace trigger trg_job_kilometers
before insert or update of kilometers, vehicle_id on public.job
for each row execute function public.check_job_kilometers();

-- -----------------------------------------------------------------------------
-- Archived parents
-- Checked only when the reference is set or changed, so existing records keep
-- working after a parent is archived.
-- -----------------------------------------------------------------------------

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

create or replace trigger trg_appointment_parents_active
before insert or update of vehicle_id on public.appointment
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

create or replace trigger trg_job_parents_active
before insert or update of vehicle_id, client_id on public.job
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

create or replace trigger trg_job_item_service_active
before insert or update of service_id on public.job_item
for each row execute function public.check_job_item_service_active();
