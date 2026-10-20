-- Client sort keys and vehicle brand/model names in the decrypted views (spec 005).
begin;
\ir _fixtures.psql
select * from no_plan();

-- Extra fake clients in shop A (the fixtures already have client_a):
--   Álvaro Núñez: 7-digit DNI, phone with parentheses, uppercase email
--   Zoe:          no surname, DNI or email
--   Archivada:    an archived client, a valid vehicle owner
insert into public.client (id, shop_id, name, surname, dni, phone_number, email, enabled) values
  ('00000000-0000-0000-0000-00000000a7a1', tests.id('shop_a'), 'Álvaro', 'Núñez', '9.123.456', '(011) 4444-5555', 'ALVARO@Example.COM', true),
  ('00000000-0000-0000-0000-00000000a7a2', tests.id('shop_a'), 'Zoe', null, null, '11 1', null, true),
  ('00000000-0000-0000-0000-00000000a7a3', tests.id('shop_a'), 'Archivada', 'Pérez', null, '11 2', null, false);

-- One vehicle with no client yet.
insert into public.vehicle (id, shop_id, client_id, plate, brand_id, model_id, year, vin) values
  ('00000000-0000-0000-0000-00000000a7b1', tests.id('shop_a'), null, 'zz 999 zz',
   tests.id('brand_fiat'), tests.id('model_cronos'), 2019, '9bw00000000000001');

-- -----------------------------------------------------------------------------
-- Structure
-- -----------------------------------------------------------------------------
select has_column('public', 'client_decrypted', 'name_key', 'client_decrypted has name_key');
select col_type_is('public', 'client_decrypted', 'dni_number', 'numeric', 'dni_number is numeric');
select has_column('public', 'client_decrypted', 'phone_key', 'client_decrypted has phone_key');
select has_column('public', 'client_decrypted', 'email_key', 'client_decrypted has email_key');
select has_column('public', 'vehicle_decrypted', 'brand_name', 'vehicle_decrypted has brand_name');
select has_column('public', 'vehicle_decrypted', 'model_name', 'vehicle_decrypted has model_name');

-- -----------------------------------------------------------------------------
-- Sort keys
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select is((select name_key from public.client_decrypted where id = tests.id('client_a')), 'martinsuarez',
          'name_key: name and surname, no case, accents or spaces');
select is((select name_key from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a1'), 'alvaronunez',
          'name_key: accents removed');
select is((select name_key from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a2'), 'zoe',
          'name_key: no surname');

select results_eq($$ select name from public.client_decrypted order by name_key $$,
                  $$ values ('Álvaro'), ('Archivada'), ('Martín'), ('Zoe') $$,
                  'name_key sorts A–Z ignoring accents');

select is((select dni_number from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a1'), 9123456::numeric,
          'dni_number: the digits as a number');
select is((select dni_number from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a2'), null,
          'dni_number: null without DNI');
select results_eq($$ select name from public.client_decrypted where dni is not null order by dni_number $$,
                  $$ values ('Álvaro'), ('Martín') $$,
                  'dni_number sorts a 7-digit DNI before an 8-digit one');

select is((select phone_key from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a1'), '01144445555',
          'phone_key: digits only');
select is((select phone_key from public.client_decrypted where id = tests.id('client_a')), '1155550101',
          'phone_key: spaces and hyphens removed');
select is((select email_key from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a1'), 'alvaro@example.com',
          'email_key: lowercase');
select is((select email_key from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a7a2'), null,
          'email_key: null without email');

-- -----------------------------------------------------------------------------
-- Search covers every column the clients page searches
-- -----------------------------------------------------------------------------
select results_eq($$ select name from public.client_decrypted where search_text like '%nunez%' $$,
                  $$ values ('Álvaro') $$, 'search by surname without accents');
select results_eq($$ select name from public.client_decrypted where search_text like '%9123456%' $$,
                  $$ values ('Álvaro') $$, 'search by DNI');
select results_eq($$ select name from public.client_decrypted where search_text like '%44445555%' $$,
                  $$ values ('Álvaro') $$, 'search by phone without hyphens');
select results_eq($$ select name from public.client_decrypted where search_text like '%1155550101%' $$,
                  $$ values ('Martín') $$, 'search by phone typed without spaces or hyphens');
select results_eq($$ select name from public.client_decrypted where search_text like '%martin@example%' $$,
                  $$ values ('Martín') $$, 'search by email');
select results_eq($$ select name from public.client_decrypted where search_text like '%archivada%' $$,
                  $$ values ('Archivada') $$, 'archived clients are found too');

-- -----------------------------------------------------------------------------
-- Vehicle brand and model names
-- -----------------------------------------------------------------------------
select results_eq($$ select brand_name, model_name from public.vehicle_decrypted where id = tests.id('vehicle_a') $$,
                  $$ values ('Fiat', 'Cronos') $$, 'vehicle_decrypted exposes the brand and model names');

-- -----------------------------------------------------------------------------
-- Assigning vehicles to a client
-- -----------------------------------------------------------------------------
select results_eq($$ select id from public.vehicle_decrypted where client_id is null $$,
                  $$ values ('00000000-0000-0000-0000-00000000a7b1'::uuid) $$, 'vehicles with no client are listed');

select results_eq($$ update public.vehicle set client_id = tests.id('client_a')
                     where id = '00000000-0000-0000-0000-00000000a7b1' and client_id is null returning id $$,
                  $$ values ('00000000-0000-0000-0000-00000000a7b1'::uuid) $$, 'a vehicle with no client can be assigned');
select is((select plate from public.vehicle_decrypted where id = '00000000-0000-0000-0000-00000000a7b1'), 'ZZ999ZZ',
          'the plate is intact after assigning');
select is_empty($$ update public.vehicle set client_id = tests.id('client_a')
                   where id = '00000000-0000-0000-0000-00000000a7b1' and client_id is null returning id $$,
                'a vehicle that already has a client is left alone by the "client_id is null" guard');

select lives_ok($$ update public.vehicle set client_id = '00000000-0000-0000-0000-00000000a7a3'
                   where id = '00000000-0000-0000-0000-00000000a7b1' $$,
                'an archived client is a valid owner');
select throws_ok($$ update public.vehicle set client_id = tests.id('client_b')
                    where id = '00000000-0000-0000-0000-00000000a7b1' $$,
                 '23503', null, 'a client of another shop can''t own the vehicle');

-- -----------------------------------------------------------------------------
-- Everything stays within the shop
-- -----------------------------------------------------------------------------
select tests.act_as('user_b');

select results_eq($$ select name from public.client_decrypted order by name_key $$,
                  $$ values ('Carla') $$, 'another shop sees only its own clients through the view');
select is_empty($$ select 1 from public.client_decrypted where name_key = 'martinsuarez' $$,
                'another shop''s clients are never found by key');
select is_empty($$ select 1 from public.client_decrypted where dni_number = 9123456 $$,
                'another shop''s clients are never found by DNI number');
select results_eq($$ select brand_name, model_name from public.vehicle_decrypted $$,
                  $$ values ('Volkswagen', 'Gol') $$, 'another shop sees only its own vehicles and their names');

select * from finish();
rollback;
