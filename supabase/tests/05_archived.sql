-- Archived vehicles, clients and services (spec 003).
begin;
\ir _fixtures.psql
select * from no_plan();

-- Archived records created as admin.
select tests.act_as_admin();
insert into public.client (id, shop_id, name, phone_number, enabled) values
  ('00000000-0000-0000-0000-00000000a1f1', tests.id('shop_a'), 'Jorge', '11 5555-0106', false);
insert into public.vehicle (id, shop_id, plate, brand_id, model_id, enabled) values
  ('00000000-0000-0000-0000-00000000a2f1', tests.id('shop_a'), 'AB990QX', tests.id('brand_vw'), tests.id('model_gol'), false);
insert into public.service (id, shop_id, name, enabled) values
  ('00000000-0000-0000-0000-00000000a3f1', tests.id('shop_a'), 'Lavado de motor', false);

select tests.act_as('user_a');

-- -----------------------------------------------------------------------------
-- New work on archived records is rejected
-- -----------------------------------------------------------------------------
select throws_ok($$ insert into public.appointment (shop_id, vehicle_id, date, time)
                    values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2f1', current_date, '12:00') $$,
                 '23514', 'vehicle_archived', 'no new appointments for an archived vehicle');
select throws_ok($$ update public.appointment set vehicle_id = '00000000-0000-0000-0000-00000000a2f1'
                    where id = tests.id('appointment_a') $$,
                 '23514', 'vehicle_archived', 'an appointment can''t be moved to an archived vehicle');
select throws_ok($$ insert into public.job (shop_id, vehicle_id) values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2f1') $$,
                 '23514', 'vehicle_archived', 'no new jobs for an archived vehicle');
select throws_ok($$ insert into public.job (shop_id, vehicle_id, client_id)
                    values (tests.id('shop_a'), tests.id('vehicle_a'), '00000000-0000-0000-0000-00000000a1f1') $$,
                 '23514', 'client_archived', 'an archived client can''t be put on a new job');
select throws_ok($$ update public.job set client_id = '00000000-0000-0000-0000-00000000a1f1' where id = tests.id('job_a') $$,
                 '23514', 'client_archived', 'an archived client can''t be put on an existing job');
select throws_ok($$ insert into public.job_item (job_id, service_id, quoted_unit_price)
                    values (tests.id('job_a'), '00000000-0000-0000-0000-00000000a3f1', 1000) $$,
                 '23514', 'service_archived', 'an archived service can''t be added to a job');
select throws_ok($$ update public.job_item set service_id = '00000000-0000-0000-0000-00000000a3f1' where id = tests.id('item_a') $$,
                 '23514', 'service_archived', 'a job item can''t switch to an archived service');

-- Archived clients stay valid as vehicle owners.
select lives_ok($$ insert into public.vehicle (shop_id, client_id, plate, brand_id, model_id)
                   values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a1f1', 'AG120PB', tests.id('brand_vw'), tests.id('model_gol')) $$,
                'an archived client can own a vehicle');

-- -----------------------------------------------------------------------------
-- Archiving a parent doesn't break existing records
-- -----------------------------------------------------------------------------
update public.client  set enabled = false where id = tests.id('client_a');
update public.vehicle set enabled = false where id = tests.id('vehicle_a');
update public.service set enabled = false where id = tests.id('service_a');

select is((select client_id from public.vehicle where id = tests.id('vehicle_a')), tests.id('client_a'),
          'archiving a client keeps it on its vehicles');
select lives_ok($$ update public.job set observations = 'Sigue en curso.' where id = tests.id('job_a') $$,
                'an existing job of an archived vehicle and client can still be edited');
select lives_ok($$ update public.job_item set quantity = 2 where id = tests.id('item_a') $$,
                'an existing item with an archived service can still be edited');
select lives_ok($$ update public.appointment set status = 'confirmado' where id = tests.id('appointment_a') $$,
                'an existing appointment of an archived vehicle can still change status');

select * from finish();
rollback;
