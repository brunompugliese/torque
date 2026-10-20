-- Job and appointment statuses, status history, closed jobs and kilometers
-- (spec 003).
begin;
\ir _fixtures.psql
select * from no_plan();

-- Extra vehicles for the kilometers tests, created as admin with explicit
-- created_at values so "previous job" is unambiguous.
select tests.act_as_admin();
insert into public.vehicle (id, shop_id, plate, brand_id, model_id) values
  ('00000000-0000-0000-0000-00000000a2c1', tests.id('shop_a'), 'AC771JR', tests.id('brand_vw'), tests.id('model_gol')),
  ('00000000-0000-0000-0000-00000000a2d1', tests.id('shop_a'), 'AD305LM', tests.id('brand_vw'), tests.id('model_gol')),
  ('00000000-0000-0000-0000-00000000a2e1', tests.id('shop_a'), 'AF915TB', tests.id('brand_vw'), tests.id('model_gol'));
insert into public.job (id, shop_id, vehicle_id, kilometers, created_at) values
  ('00000000-0000-0000-0000-00000000a5c1', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2c1', 50000, now() - interval '5 days'),
  ('00000000-0000-0000-0000-00000000a5d1', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2d1', 10000, now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000a5d2', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2d1', 20000, now() - interval '10 days');

select tests.act_as('user_a');

-- -----------------------------------------------------------------------------
-- Statuses
-- -----------------------------------------------------------------------------
insert into public.job (id, shop_id, vehicle_id) values
  ('00000000-0000-0000-0000-00000000a511', tests.id('shop_a'), tests.id('vehicle_a'));
select is((select status from public.job where id = '00000000-0000-0000-0000-00000000a511'), 'pendiente',
          'new jobs start as pendiente');
select throws_ok($$ update public.job set status = 'borrador' where id = '00000000-0000-0000-0000-00000000a511' $$,
                 '23514', null, 'borrador is no longer a status');
select throws_ok($$ update public.job set status = 'presupuesto_rechazado' where id = '00000000-0000-0000-0000-00000000a511' $$,
                 '23514', null, 'presupuesto_rechazado is no longer a status');
select lives_ok($$ update public.job set status = 'presupuesto_enviado' where id = '00000000-0000-0000-0000-00000000a511' $$,
                'any open status can be set');

select results_eq(
  $$ select old_status, new_status, changed_by from public.job_status_history
     where job_id = '00000000-0000-0000-0000-00000000a511' order by changed_at, old_status nulls first $$,
  $$ values (null::text, 'pendiente'::text, tests.id('user_a')),
            ('pendiente', 'presupuesto_enviado', tests.id('user_a')) $$,
  'status history records creation and each change with the user');

select is((select status from public.appointment where id = tests.id('appointment_a')), 'pendiente',
          'new appointments start as pendiente');
select lives_ok($$ update public.appointment set status = 'completado' where id = tests.id('appointment_a') $$,
                'appointments accept completado');
select lives_ok($$ update public.appointment set status = 'cancelado' where id = tests.id('appointment_a') $$,
                'appointments can be cancelled');
select lives_ok($$ update public.appointment set status = 'pendiente' where id = tests.id('appointment_a') $$,
                'cancelled appointments can be reactivated');
select throws_ok($$ update public.appointment set status = 'perdido' where id = tests.id('appointment_a') $$,
                 '23514', null, 'unknown appointment statuses are rejected');

-- -----------------------------------------------------------------------------
-- Closed jobs: entregado
-- -----------------------------------------------------------------------------
insert into public.job (id, shop_id, vehicle_id) values
  ('00000000-0000-0000-0000-00000000a521', tests.id('shop_a'), tests.id('vehicle_a'));
insert into public.job_item (id, job_id, service_id, quoted_unit_price, final_unit_price) values
  ('00000000-0000-0000-0000-00000000a621', '00000000-0000-0000-0000-00000000a521', tests.id('service_a'), 60000, 60000);
select lives_ok($$ update public.job set status = 'entregado', observations = 'Entregado al cliente.', final_total = 60000
                   where id = '00000000-0000-0000-0000-00000000a521' $$,
                'closing a job can save other changes in the same update');

select throws_ok($$ update public.job set observations = 'Cambio' where id = '00000000-0000-0000-0000-00000000a521' $$,
                 '23514', 'job_closed', 'a delivered job can''t be edited');
select throws_ok($$ update public.job set status = 'en_progreso' where id = '00000000-0000-0000-0000-00000000a521' $$,
                 '23514', 'job_closed', 'a delivered job can''t be reopened');
select throws_ok($$ update public.job set final_total = 1 where id = '00000000-0000-0000-0000-00000000a521' $$,
                 '23514', 'job_closed', 'a delivered job''s totals can''t change');
select lives_ok($$ update public.job set enabled = false where id = '00000000-0000-0000-0000-00000000a521' $$,
                'a delivered job can be archived');
select lives_ok($$ update public.job set enabled = true where id = '00000000-0000-0000-0000-00000000a521' $$,
                'a delivered job can be unarchived');

select throws_ok($$ insert into public.job_item (job_id, service_id, quoted_unit_price)
                    values ('00000000-0000-0000-0000-00000000a521', tests.id('service_a'), 1000) $$,
                 '23514', 'job_closed', 'items can''t be added to a delivered job');
select throws_ok($$ update public.job_item set quantity = 2 where id = '00000000-0000-0000-0000-00000000a621' $$,
                 '23514', 'job_closed', 'items of a delivered job can''t change');
select throws_ok($$ delete from public.job_item where id = '00000000-0000-0000-0000-00000000a621' $$,
                 '23514', 'job_closed', 'items of a delivered job can''t be removed');
select throws_ok($$ update public.job_item set job_id = '00000000-0000-0000-0000-00000000a521' where id = tests.id('item_a') $$,
                 '23514', 'job_closed', 'items can''t be moved into a delivered job');

-- -----------------------------------------------------------------------------
-- Closed jobs: cancelado
-- -----------------------------------------------------------------------------
insert into public.job (id, shop_id, vehicle_id, status) values
  ('00000000-0000-0000-0000-00000000a531', tests.id('shop_a'), tests.id('vehicle_a'), 'presupuesto_enviado');
select lives_ok($$ update public.job set status = 'cancelado' where id = '00000000-0000-0000-0000-00000000a531' $$,
                'a job can be cancelled from any status');
select throws_ok($$ update public.job set status = 'pendiente' where id = '00000000-0000-0000-0000-00000000a531' $$,
                 '23514', 'job_closed', 'a cancelled job can''t be reopened');
select throws_ok($$ update public.job set kilometers = 100500 where id = '00000000-0000-0000-0000-00000000a531' $$,
                 '23514', 'job_closed', 'a cancelled job can''t be edited');

-- -----------------------------------------------------------------------------
-- Kilometers (vehicle_a's previous job, job_a, has 100.000 km)
-- -----------------------------------------------------------------------------
select throws_ok($$ insert into public.job (shop_id, vehicle_id, kilometers) values (tests.id('shop_a'), tests.id('vehicle_a'), 99999) $$,
                 '23514', 'job_kilometers_below_previous', 'km below the previous job is rejected');
select lives_ok($$ insert into public.job (shop_id, vehicle_id, kilometers) values (tests.id('shop_a'), tests.id('vehicle_a'), 100000) $$,
                'km equal to the previous job is accepted');
select lives_ok($$ insert into public.job (shop_id, vehicle_id, kilometers) values (tests.id('shop_a'), tests.id('vehicle_a'), 112500) $$,
                'km above the previous job is accepted');
select throws_ok($$ update public.job set kilometers = 90000 where id = '00000000-0000-0000-0000-00000000a511' $$,
                 '23514', 'job_kilometers_below_previous', 'km below the previous job is rejected on update');

-- An archived previous job doesn't count.
update public.job set enabled = false where id = '00000000-0000-0000-0000-00000000a5c1';
select lives_ok($$ insert into public.job (shop_id, vehicle_id, kilometers) values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2c1', 10000) $$,
                'an archived previous job is ignored');

-- Editing an older job isn't blocked by a newer one with more km.
select lives_ok($$ update public.job set kilometers = 15000 where id = '00000000-0000-0000-0000-00000000a5d1' $$,
                'an older job is compared only with jobs before it');

-- No previous km: any whole number >= 0.
select lives_ok($$ insert into public.job (shop_id, vehicle_id, kilometers) values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2e1', 0) $$,
                'without previous km, 0 is accepted');
select throws_ok($$ insert into public.job (shop_id, vehicle_id, kilometers) values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a2e1', -1) $$,
                 '23514', null, 'negative km is rejected');

select * from finish();
rollback;
