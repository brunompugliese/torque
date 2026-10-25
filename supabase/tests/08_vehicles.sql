-- List columns of vehicle_decrypted and the "vehicle + new client" function (spec 006).
begin;
\ir _fixtures.psql
select * from no_plan();

-- Extra fake data in shop A (the fixtures already have vehicle_a with client_a and job_a at 100.000 km):
--   Archivada Pérez: an archived client, owner of the second vehicle
--   second vehicle:  Fiat Cronos, archived client, no jobs
--   third vehicle:   Fiat Cronos, no client
--   fourth vehicle:  Volkswagen Gol, no client
insert into public.client (id, shop_id, name, surname, phone_number, enabled) values
  ('00000000-0000-0000-0000-00000000a7a3', tests.id('shop_a'), 'Archivada', 'Pérez', '11 5555-0303', false);

insert into public.vehicle (id, shop_id, client_id, plate, brand_id, model_id, year) values
  ('00000000-0000-0000-0000-00000000a7b1', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a7a3', 'bb 111 bb',
   tests.id('brand_fiat'), tests.id('model_cronos'), 2018),
  ('00000000-0000-0000-0000-00000000a7b2', tests.id('shop_a'), null, 'cc 222 cc',
   tests.id('brand_fiat'), tests.id('model_cronos'), 2017),
  ('00000000-0000-0000-0000-00000000a7b3', tests.id('shop_a'), null, 'dd 333 dd',
   tests.id('brand_vw'), tests.id('model_gol'), 2012);

-- -----------------------------------------------------------------------------
-- Structure
-- -----------------------------------------------------------------------------
select has_column('public', 'vehicle_decrypted', 'last_km', 'vehicle_decrypted has last_km');
select has_column('public', 'vehicle_decrypted', 'client_name', 'vehicle_decrypted has client_name');
select has_column('public', 'vehicle_decrypted', 'client_surname', 'vehicle_decrypted has client_surname');
select has_column('public', 'vehicle_decrypted', 'client_phone_number', 'vehicle_decrypted has client_phone_number');
select has_column('public', 'vehicle_decrypted', 'client_enabled', 'vehicle_decrypted has client_enabled');
select has_column('public', 'vehicle_decrypted', 'client_name_key', 'vehicle_decrypted has client_name_key');
select has_column('public', 'vehicle_decrypted', 'vehicle_key', 'vehicle_decrypted has vehicle_key');

-- -----------------------------------------------------------------------------
-- last_km: highest km among the non-archived jobs
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select is((select last_km from public.vehicle_decrypted where id = tests.id('vehicle_a')), 100000,
          'last_km: the km of the only job');
select is((select last_km from public.vehicle_decrypted where id = '00000000-0000-0000-0000-00000000a7b1'), null,
          'last_km: null without jobs');

select tests.act_as_admin();
insert into public.job (id, shop_id, vehicle_id, kilometers, enabled, created_at) values
  ('00000000-0000-0000-0000-00000000a7c1', tests.id('shop_a'), tests.id('vehicle_a'), 120000, true,  now() - interval '5 days'),
  ('00000000-0000-0000-0000-00000000a7c2', tests.id('shop_a'), tests.id('vehicle_a'), 200000, false, now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000a7c3', tests.id('shop_a'), tests.id('vehicle_a'), null,   true,  now() - interval '1 day');
select tests.act_as('user_a');

select is((select last_km from public.vehicle_decrypted where id = tests.id('vehicle_a')), 120000,
          'last_km: the highest km, not the latest job, ignoring jobs without km');

select tests.act_as_admin();
update public.job set enabled = false where id = '00000000-0000-0000-0000-00000000a7c1';
select tests.act_as('user_a');

select is((select last_km from public.vehicle_decrypted where id = tests.id('vehicle_a')), 100000,
          'last_km: an archived job no longer counts');

-- -----------------------------------------------------------------------------
-- The client's columns
-- -----------------------------------------------------------------------------
select results_eq($$ select client_name, client_surname, client_phone_number, client_enabled, client_name_key
                     from public.vehicle_decrypted where id = tests.id('vehicle_a') $$,
                  $$ values ('Martín', 'Suárez', '11 5555-0101', true, 'martinsuarez') $$,
                  'the client''s decrypted data and name key');
select results_eq($$ select client_name, client_enabled
                     from public.vehicle_decrypted where id = '00000000-0000-0000-0000-00000000a7b1' $$,
                  $$ values ('Archivada', false) $$,
                  'an archived client shows as archived');
select results_eq($$ select client_name, client_surname, client_phone_number, client_enabled, client_name_key
                     from public.vehicle_decrypted where id = '00000000-0000-0000-0000-00000000a7b2' $$,
                  $$ values (null::text, null::text, null::text, null::boolean, null::text) $$,
                  'a vehicle without a client has empty client columns, including its name key');

select results_eq($$ select plate from public.vehicle_decrypted where client_id is not null order by client_name_key $$,
                  $$ values ('BB111BB'), ('AE482KD') $$,
                  'client_name_key sorts the clients A–Z ignoring accents');

-- -----------------------------------------------------------------------------
-- vehicle_key
-- -----------------------------------------------------------------------------
select results_eq($$ select vehicle_key from public.vehicle_decrypted order by vehicle_key $$,
                  $$ values ('fiatcronos'), ('fiatcronos'), ('fiatcronos'), ('volkswagengol') $$,
                  'vehicle_key sorts by brand and then model');

-- -----------------------------------------------------------------------------
-- Everything stays within the shop
-- -----------------------------------------------------------------------------
select tests.act_as('user_b');

select results_eq($$ select plate, client_name, last_km from public.vehicle_decrypted $$,
                  $$ values ('AE482KD', 'Carla', 143000) $$,
                  'another shop sees only its own vehicles, clients and km through the view');
select is_empty($$ select 1 from public.vehicle_decrypted where client_name_key = 'martinsuarez' $$,
                'another shop''s clients are never found by key');

select tests.act_as('user_a_off');
select is_empty($$ select 1 from public.vehicle_decrypted $$, 'a disabled profile sees no vehicles through the view');

select tests.act_as_anon();
select throws_ok($$ select 1 from public.vehicle_decrypted $$, '42501', null, 'anon can''t read the view');

-- -----------------------------------------------------------------------------
-- save_vehicle_with_new_client
-- -----------------------------------------------------------------------------
select has_function('public', 'save_vehicle_with_new_client',
                    array['uuid', 'text', 'uuid', 'uuid', 'integer', 'text', 'text', 'text', 'text', 'text'],
                    'the function exists');

select tests.act_as('user_a');

-- Create: both rows in one call.
select lives_ok($$ select public.save_vehicle_with_new_client(null, 'ff 444 ff', tests.id('brand_fiat'),
                     tests.id('model_cronos'), 2020, null, 'Nuevo', null, '11 5555-0404', '30.123.456') $$,
                'creates a vehicle and its new client');
select results_eq($$ select client_name, client_enabled, year from public.vehicle_decrypted where plate = 'FF444FF' $$,
                  $$ values ('Nuevo', true, 2020) $$,
                  'the vehicle belongs to the new, active client');
select results_eq($$ select dni, phone_number from public.client_decrypted where name = 'Nuevo' $$,
                  $$ values ('30123456', '11 5555-0404') $$,
                  'the client is saved normalized, readable through the view');

select tests.act_as_admin();
select is_empty($$ select 1 from public.vehicle where plate = 'FF444FF' $$,
                'the plate is ciphertext in the table (the triggers ran)');
select is((select count(*) from public.client where shop_id = tests.id('shop_a') and dni_hash is not null)::int, 2,
          'the new client was created in the caller''s shop (next to client_a), with its DNI hash set by the trigger');
select tests.act_as('user_a');

-- Update: an existing vehicle gets the new client.
select lives_ok($$ select public.save_vehicle_with_new_client('00000000-0000-0000-0000-00000000a7b2', 'cc 222 cc',
                     tests.id('brand_fiat'), tests.id('model_cronos'), 2018, '9bw00000000000001', 'Otra', 'Gómez', '11 5555-0505', null) $$,
                'updates a vehicle with a new client');
select results_eq($$ select client_name, client_surname, year, vin, plate from public.vehicle_decrypted
                     where id = '00000000-0000-0000-0000-00000000a7b2' $$,
                  $$ values ('Otra', 'Gómez', 2018, '9BW00000000000001', 'CC222CC') $$,
                  'the vehicle has the new client and its new data; its own plate doesn''t clash with itself');

-- Errors roll everything back.
select throws_ok($$ select public.save_vehicle_with_new_client(null, 'ae 482 kd', tests.id('brand_fiat'),
                      tests.id('model_cronos'), null, null, 'Rollback', null, '11 5555-0606', null) $$,
                 '23505', 'vehicle_plate_taken', 'a taken plate is reported as such');
select is_empty($$ select 1 from public.client_decrypted where name = 'Rollback' $$,
                'a failed vehicle leaves no orphan client');

select throws_ok($$ select public.save_vehicle_with_new_client(null, 'gg 555 gg', tests.id('brand_fiat'),
                      tests.id('model_cronos'), null, null, 'Duplicado', null, '11 5555-0707', '28456123') $$,
                 '23505', 'client_dni_taken', 'a taken DNI is reported as such');
select is_empty($$ select 1 from public.vehicle_decrypted where plate = 'GG555GG' $$,
                'a failed client leaves no vehicle');

select throws_ok($$ select public.save_vehicle_with_new_client(tests.id('vehicle_b'), 'ae 482 kd', tests.id('brand_vw'),
                      tests.id('model_gol'), null, null, 'Ajeno', null, '11 5555-0808', null) $$,
                 'P0002', 'vehicle_not_found', 'another shop''s vehicle can''t be updated');
select is_empty($$ select 1 from public.client_decrypted where name = 'Ajeno' $$,
                'a vehicle that isn''t found leaves no client');

select throws_ok($$ select public.save_vehicle_with_new_client(null, 'hh 666 hh', tests.id('brand_fiat'),
                      tests.id('model_gol'), null, null, 'Mal', null, '11 5555-0909', null) $$,
                 '23503', null, 'a model that doesn''t belong to the brand is rejected');
select is_empty($$ select 1 from public.client_decrypted where name = 'Mal' $$,
                'a rejected vehicle leaves no client');

-- Not for everyone.
select tests.act_as('user_a_off');
select throws_ok($$ select public.save_vehicle_with_new_client(null, 'ii 777 ii', tests.id('brand_fiat'),
                      tests.id('model_cronos'), null, null, 'Off', null, '11 5555-1010', null) $$,
                 '42501', null, 'a disabled profile can''t use it');

select tests.act_as_anon();
select throws_ok($$ select public.save_vehicle_with_new_client(null, 'jj 888 jj', tests.id('brand_fiat'),
                      tests.id('model_cronos'), null, null, 'Anon', null, '11 5555-1111', null) $$,
                 '42501', null, 'anon can''t execute it');

select * from finish();
rollback;
