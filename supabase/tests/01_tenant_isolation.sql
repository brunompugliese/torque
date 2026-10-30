-- Tenant isolation: every tenant table and decrypted view, read-only tables,
-- and the global catalog (spec 003).
begin;
\ir _fixtures.psql
select * from no_plan();

-- -----------------------------------------------------------------------------
-- A user sees only their own shop's rows
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq($$ select id from public.shop $$, $$ select tests.id('shop_a') $$, 'shop: only own shop');
select is_empty($$ select 1 from public.profile where shop_id <> tests.id('shop_a') $$, 'profile: no foreign rows');
select is((select count(*)::int from public.profile), 2, 'profile: own shop''s profiles');

select results_eq($$ select id from public.client      $$, $$ select tests.id('client_a') $$,      'client: only own rows');
select results_eq($$ select id from public.vehicle     $$, $$ select tests.id('vehicle_a') $$,     'vehicle: only own rows');
select results_eq($$ select id from public.service     $$, $$ select tests.id('service_a') $$,     'service: only own rows');
select results_eq($$ select id from public.appointment $$, $$ select tests.id('appointment_a') $$, 'appointment: only own rows');
select results_eq($$ select id from public.job         $$, $$ select tests.id('job_a') $$,         'job: only own rows');
select results_eq($$ select id from public.job_item    $$, $$ select tests.id('item_a') $$,        'job_item: only own rows');
select results_eq($$ select distinct job_id from public.job_status_history $$, $$ select tests.id('job_a') $$,
                  'job_status_history: only own jobs');

select results_eq($$ select id from public.client_decrypted      $$, $$ select tests.id('client_a') $$,      'client_decrypted: only own rows');
select results_eq($$ select id from public.vehicle_decrypted     $$, $$ select tests.id('vehicle_a') $$,     'vehicle_decrypted: only own rows');
select results_eq($$ select id from public.appointment_decrypted $$, $$ select tests.id('appointment_a') $$, 'appointment_decrypted: only own rows');
select results_eq($$ select id from public.job_decrypted         $$, $$ select tests.id('job_a') $$,         'job_decrypted: only own rows');

select tests.act_as('user_b');
select results_eq($$ select id from public.client_decrypted $$, $$ select tests.id('client_b') $$, 'shop B user sees only shop B clients');
select results_eq($$ select id from public.job $$, $$ select tests.id('job_b') $$, 'shop B user sees only shop B jobs');

-- -----------------------------------------------------------------------------
-- Writes with another shop's shop_id are rejected
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select throws_ok($$ insert into public.service (shop_id, name) values (tests.id('shop_b'), 'X') $$,
                 '42501', null, 'insert with another shop_id is rejected');
select throws_ok($$ update public.service set shop_id = tests.id('shop_b') where id = tests.id('service_a') $$,
                 '42501', null, 'moving a row to another shop is rejected');

-- Rows of another shop are invisible, so updates and deletes touch nothing.
update public.service set name = 'Hackeado' where id = tests.id('service_b');
delete from public.job_item where id = tests.id('item_b');
select tests.act_as_admin();
select is((select name from public.service where id = tests.id('service_b')), 'Cambio de aceite',
          'another shop''s row cannot be updated');
select isnt_empty($$ select 1 from public.job_item where id = tests.id('item_b') $$,
                  'another shop''s row cannot be deleted');

-- -----------------------------------------------------------------------------
-- Another shop's rows can't be referenced through foreign keys
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select throws_ok($$ insert into public.job (shop_id, vehicle_id) values (tests.id('shop_a'), tests.id('vehicle_b')) $$,
                 '23503', null, 'job on another shop''s vehicle is rejected');
select throws_ok($$ insert into public.vehicle (shop_id, client_id, plate, brand_id, model_id)
                    values (tests.id('shop_a'), tests.id('client_b'), 'AA000AA', tests.id('brand_fiat'), tests.id('model_cronos')) $$,
                 '23503', null, 'vehicle owned by another shop''s client is rejected');
select throws_ok($$ insert into public.appointment (shop_id, vehicle_id, date, time) values (tests.id('shop_a'), tests.id('vehicle_b'), current_date, '11:00') $$,
                 '23503', null, 'appointment on another shop''s vehicle is rejected');
select throws_ok($$ insert into public.job_item (job_id, service_id, quoted_unit_price) values (tests.id('job_a'), tests.id('service_b'), 1000) $$,
                 '23503', null, 'job item with another shop''s service is rejected');
-- job_item takes shop_id from its job (trigger), so this one fails RLS (shop B) first.
select throws_ok($$ insert into public.job_item (job_id, service_id, quoted_unit_price) values (tests.id('job_b'), tests.id('service_a'), 1000) $$,
                 '42501', null, 'job item on another shop''s job is rejected');

-- -----------------------------------------------------------------------------
-- A disabled profile sees nothing
-- -----------------------------------------------------------------------------
select tests.act_as('user_a_off');

select is_empty($$ select 1 from public.shop $$,                  'disabled: shop');
select is_empty($$ select 1 from public.profile $$,               'disabled: profile');
select is_empty($$ select 1 from public.client $$,                'disabled: client');
select is_empty($$ select 1 from public.vehicle $$,               'disabled: vehicle');
select is_empty($$ select 1 from public.service $$,               'disabled: service');
select is_empty($$ select 1 from public.appointment $$,           'disabled: appointment');
select is_empty($$ select 1 from public.job $$,                   'disabled: job');
select is_empty($$ select 1 from public.job_item $$,              'disabled: job_item');
select is_empty($$ select 1 from public.job_status_history $$,    'disabled: job_status_history');
select is_empty($$ select 1 from public.client_decrypted $$,      'disabled: client_decrypted');
select is_empty($$ select 1 from public.vehicle_decrypted $$,     'disabled: vehicle_decrypted');
select is_empty($$ select 1 from public.appointment_decrypted $$, 'disabled: appointment_decrypted');
select is_empty($$ select 1 from public.job_decrypted $$,         'disabled: job_decrypted');
select throws_ok($$ insert into public.service (shop_id, name) values (tests.id('shop_a'), 'X') $$,
                 '42501', null, 'disabled: can''t write');

-- -----------------------------------------------------------------------------
-- anon has no access to tenant data
-- -----------------------------------------------------------------------------
select tests.act_as_anon();

select throws_ok($$ select 1 from public.shop $$,                  '42501', null, 'anon: shop denied');
select throws_ok($$ select 1 from public.profile $$,               '42501', null, 'anon: profile denied');
select throws_ok($$ select 1 from public.client $$,                '42501', null, 'anon: client denied');
select throws_ok($$ select 1 from public.vehicle $$,               '42501', null, 'anon: vehicle denied');
select throws_ok($$ select 1 from public.service $$,               '42501', null, 'anon: service denied');
select throws_ok($$ select 1 from public.appointment $$,           '42501', null, 'anon: appointment denied');
select throws_ok($$ select 1 from public.job $$,                   '42501', null, 'anon: job denied');
select throws_ok($$ select 1 from public.job_item $$,              '42501', null, 'anon: job_item denied');
select throws_ok($$ select 1 from public.job_status_history $$,    '42501', null, 'anon: job_status_history denied');
select throws_ok($$ select 1 from public.client_decrypted $$,      '42501', null, 'anon: client_decrypted denied');
select throws_ok($$ select 1 from public.vehicle_decrypted $$,     '42501', null, 'anon: vehicle_decrypted denied');
select throws_ok($$ select 1 from public.appointment_decrypted $$, '42501', null, 'anon: appointment_decrypted denied');
select throws_ok($$ select 1 from public.job_decrypted $$,         '42501', null, 'anon: job_decrypted denied');

-- Global catalog: nothing for anon.
select throws_ok($$ select 1 from public.brand $$, '42501', null, 'anon: brand denied');
select throws_ok($$ select 1 from public.model $$, '42501', null, 'anon: model denied');
select throws_ok($$ insert into public.brand (name) values ('Marca anon') $$, '42501', null, 'anon: brand not writable');
select throws_ok($$ insert into public.model (brand_id, name) values (tests.id('brand_fiat'), 'Modelo anon') $$,
                 '42501', null, 'anon: model not writable');

-- -----------------------------------------------------------------------------
-- Read-only tables reject writes
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select throws_ok($$ insert into public.shop (name) values ('Otro') $$,                          '42501', null, 'shop: insert denied');
select throws_ok($$ update public.shop set name = 'Otro' where id = tests.id('shop_a') $$,      '42501', null, 'shop: update denied');
select throws_ok($$ delete from public.shop where id = tests.id('shop_a') $$,                   '42501', null, 'shop: delete denied');
select throws_ok($$ insert into public.profile (id, shop_id, role, full_name)
                    values (tests.id('user_b'), tests.id('shop_a'), 'owner', 'X') $$,          '42501', null, 'profile: insert denied');
select throws_ok($$ update public.profile set role = 'owner' where id = tests.id('user_a_off') $$, '42501', null, 'profile: update denied');
select throws_ok($$ delete from public.profile where id = tests.id('user_a_off') $$,            '42501', null, 'profile: delete denied');
select throws_ok($$ insert into public.job_status_history (job_id, new_status) values (tests.id('job_a'), 'entregado') $$,
                 '42501', null, 'job_status_history: insert denied');
select throws_ok($$ update public.job_status_history set new_status = 'entregado' $$,           '42501', null, 'job_status_history: update denied');
select throws_ok($$ delete from public.job_status_history $$,                                    '42501', null, 'job_status_history: delete denied');

-- Global catalog: logged-in users read and add, but cannot change or delete what every shop uses.
select isnt_empty($$ select 1 from public.brand $$, 'brand: readable by a logged-in user');
select isnt_empty($$ select 1 from public.model $$, 'model: readable by a logged-in user');
select lives_ok($$ insert into public.brand (name) values ('Marca nueva') $$, 'brand: insert allowed');
select throws_ok($$ update public.brand set name = 'Otra' where id = tests.id('brand_fiat') $$, '42501', null, 'brand: update denied');
select throws_ok($$ delete from public.brand where id = tests.id('brand_fiat') $$,              '42501', null, 'brand: delete denied');
select throws_ok($$ update public.model set name = 'Otro' where id = tests.id('model_cronos') $$, '42501', null, 'model: update denied');
select throws_ok($$ delete from public.model where id = tests.id('model_cronos') $$,              '42501', null, 'model: delete denied');

select * from finish();
rollback;
