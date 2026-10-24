-- =============================================================================
-- DDL — public.save_job (spec 007).
-- The job form saves a job, its services and its status together, and can create
-- the client and some of the services on the spot ("+ Crear cliente nuevo",
-- "+ Crear servicio nuevo"). The Data API has no transaction across several
-- writes, and the order matters (a closed job can't take items: "to close a job,
-- save its items first, then the status"), so everything runs in one function, in
-- one transaction: any error rolls it all back.
--   * p_job_id null  → creates the job; otherwise updates that job
--   * p_items: [{ id?, service_id?, new_service?: {name, description}, quantity,
--                 quoted_unit_price, final_unit_price }] in the order the user typed
--       - with id (an item of this job): updated; without: inserted
--       - the job's items that are not in the list are deleted
--       - new_service creates the service (the normalize_service trigger fills its keys)
--       - the quoted price of an existing item is kept as stored while the job is
--         in the work phase (en_progreso, completado): it is what the client accepted
--   * p_new_client: null, or {name, surname, phone_number, dni}; replaces p_client_id
--   * p_quoted_total / p_final_total are calculated by the app
--   * Returns the job's id; the app reads the row back through job_list.
-- Order inside: (1) new client, (2) items (and their new services), (3) the job.
--   The job update comes last because guard_closed_job_item looks at the stored
--   status. A job created directly as entregado/cancelado is inserted as pendiente,
--   gets its items and is then closed, so its history has two entries.
--   The job is always updated, so updated_at moves when only the items changed.
-- Items are inserted one at a time with clock_timestamp() as created_at: now() is the
--   same for every row of a transaction, and the order of the services is created_at.
-- Security:
--   * security invoker (the default, stated for clarity): it runs as the caller, so
--     RLS, the composite foreign keys, the encryption triggers and every business
--     rule trigger apply. There is nothing to bypass, so no security definer.
--   * The shop comes from the JWT claim, like the RLS policies: the app never sends it.
--   * EXECUTE is granted in the matching dcl migration.
-- Errors the app maps (besides the 23514 rules of the triggers: job_closed,
-- job_kilometers_below_previous, vehicle_archived, client_archived, service_archived):
--   23505 client_dni_taken          (decided from the violated constraint)
--   P0002 job_not_found | job_item_not_found
-- A service name already taken is checked by the app before calling (docs/design.md).
-- =============================================================================

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
