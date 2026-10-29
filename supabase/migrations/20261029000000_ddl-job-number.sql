-- =============================================================================
-- DDL — the job number (spec 013).
--   * Every job has a number, sequential within its shop: 1, 2, 3… Assigned by the
--     database on creation, never reused and never changed. The database stores only
--     the integer; the app shows it as "N° 000123".
--   * shop.last_job_number is the shop's counter. trg_job_set_number takes the next
--     value with a single UPDATE of the shop row: its row lock makes two jobs created
--     at the same moment in one shop wait for each other, so they never share a number,
--     while other shops are not blocked. The counter moves in the same transaction as
--     the insert, so a failed insert leaves no gap, and nothing decrements it.
--   * Existing jobs are numbered in creation order, with the user triggers off (a
--     closed job can't be updated, and updated_at must not move). The migration can be
--     re-run: it only numbers jobs without a number.
-- =============================================================================

alter table public.shop add column if not exists last_job_number integer not null default 0;
alter table public.job  add column if not exists number integer;

-- Backfill, in creation order per shop.
alter table public.job disable trigger user;

update public.job j
set number = n.number
from (
  select id, row_number() over (partition by shop_id order by created_at, id) as number
  from public.job
) n
where j.id = n.id
  and j.number is null;

alter table public.job enable trigger user;

update public.shop s
set last_job_number = greatest(s.last_job_number, coalesce(m.highest, 0))
from (
  select shop_id, max(number) as highest from public.job group by shop_id
) m
where m.shop_id = s.id;

alter table public.job alter column number set not null;
alter table public.job drop constraint if exists job_number_positive;
alter table public.job add constraint job_number_positive check (number > 0);
alter table public.job drop constraint if exists job_shop_number_key;
alter table public.job add constraint job_shop_number_key unique (shop_id, number);

-- Takes the next number of the job's shop. security definer: users can't update shop. Any number
-- sent by the caller is ignored.
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

-- The number never changes, not even by an update that sends the same row with another number.
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
