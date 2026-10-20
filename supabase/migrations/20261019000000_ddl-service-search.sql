-- =============================================================================
-- DDL — normalized name and search text for service (spec 004).
--   * name_key = private.normalize_search(name): lowercase, no accents, no
--     spaces, dots or dashes. The services page sorts by it (A–Z ignoring case
--     and accents) and the app looks it up to tell the user a name is taken,
--     among active and archived services. No unique constraint, by the
--     owner's decision: the check is the app's.
--   * search_text = normalize_search of name and description, the same shape
--     as client_decrypted / vehicle_decrypted, so every page searches alike.
--   * Both are set by a trigger on every write (cheap reads, nothing computed
--     per query) and overwrite whatever a client sends. Generated columns
--     aren't possible: normalize_search is stable (unaccent), not immutable.
-- =============================================================================

alter table public.service add column if not exists name_key    text;
alter table public.service add column if not exists search_text text;

-- Security invoker: authenticated may already execute normalize_search, and a
-- trigger function needs no EXECUTE grant to fire (like the encryption ones).
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

-- Backfill without bumping updated_at: this is not a user edit.
alter table public.service disable trigger trg_service_updated_at;
update public.service
set name_key    = private.normalize_search(name),
    search_text = private.normalize_search(concat_ws('|', name, description));
alter table public.service enable trigger trg_service_updated_at;

alter table public.service alter column name_key    set not null;
alter table public.service alter column search_text set not null;

-- Sorting by name and the "name already taken" lookup, both per shop.
create index if not exists idx_service_shop_name_key on public.service (shop_id, name_key);
