-- =============================================================================
-- DDL — public.save_vehicle_with_new_client (spec 006).
-- The vehicle form can create the owner on the spot ("+ Crear cliente nuevo").
-- The Data API has no transaction across two inserts, and a vehicle that fails
-- (taken plate) must not leave an orphan client behind, so both writes run in
-- one function, in one transaction: any error rolls both back.
--   * p_vehicle_id null  → creates the client and the vehicle
--   * p_vehicle_id set   → creates the client and updates that vehicle with it
--     (the form's edit mode also offers "Cliente nuevo")
--   * Returns the vehicle's id; the app reads the row back through the view.
-- Security:
--   * security invoker (the default, stated for clarity): it runs as the
--     caller, so RLS, the composite foreign keys and the encryption triggers
--     all apply. There is nothing to bypass, so no security definer.
--   * The shop comes from the JWT claim, like the RLS policies: the app never
--     sends a shop id.
--   * EXECUTE is granted in the matching dcl migration.
-- Errors the app maps to field errors, as the business-rule triggers do:
--   23505 vehicle_plate_taken | client_dni_taken   (decided from the violated
--         constraint; matching its column keeps this independent of the
--         auto-generated constraint names)
--   P0002 vehicle_not_found   (no such vehicle in the caller's shop)
-- =============================================================================

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
