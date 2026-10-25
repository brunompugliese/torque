-- The appointment list view (spec 008).
begin;
\ir _fixtures.psql
select * from no_plan();

-- Extra fake data in shop A (the fixtures already have vehicle_a with client_a and appointment_a at
-- 09:00 with the reason "Ruido al frenar"):
--   a second vehicle (Volkswagen Gol), no client, with an appointment without reason
--   appointment_a gets two jobs: an older active one and a newer one, then the newer is archived
--   the second appointment has only an archived job
insert into public.vehicle (id, shop_id, client_id, plate, brand_id, model_id, year) values
  ('00000000-0000-0000-0000-00000000a9b1', tests.id('shop_a'), null, 'cc 222 cc',
   tests.id('brand_vw'), tests.id('model_gol'), 2012);

insert into public.appointment (id, shop_id, vehicle_id, client_id, date, time, reason, status) values
  ('00000000-0000-0000-0000-00000000a9a1', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a9b1', null,
   '2026-11-02', '15:30', null, 'confirmado');

insert into public.job (id, shop_id, vehicle_id, appointment_id, status, enabled, created_at) values
  ('00000000-0000-0000-0000-00000000a9c1', tests.id('shop_a'), tests.id('vehicle_a'), tests.id('appointment_a'),
   'pendiente', true, now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000a9c2', tests.id('shop_a'), tests.id('vehicle_a'), tests.id('appointment_a'),
   'pendiente', true, now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000a9c3', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a9b1',
   '00000000-0000-0000-0000-00000000a9a1', 'pendiente', false, now() - interval '1 day');

select has_view('public', 'appointment_list', 'appointment_list exists');

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq($$ select plate, vehicle_year, brand_name, model_name, vehicle_enabled,
                            client_name, client_surname, client_phone_number, client_enabled,
                            reason, status, enabled
                     from public.appointment_list where id = tests.id('appointment_a') $$,
                  $$ values ('AE482KD', 2021, 'Fiat', 'Cronos', true,
                             'Martín', 'Suárez', '11 5555-0101', true,
                             'Ruido al frenar', 'pendiente', true) $$,
                  'the vehicle, the client and the reason come decrypted');
select results_eq($$ select date::text, time::text from public.appointment_list where id = tests.id('appointment_a') $$,
                  $$ values (current_date::text, '09:00:00') $$,
                  'the date and the time');
select results_eq($$ select client_name, client_surname, client_phone_number, client_enabled, reason, status
                     from public.appointment_list where id = '00000000-0000-0000-0000-00000000a9a1' $$,
                  $$ values (null::text, null::text, null::text, null::boolean, null::text, 'confirmado') $$,
                  'an appointment without client or reason has empty columns');

-- job_id: the latest non-archived job.
select is((select job_id from public.appointment_list where id = tests.id('appointment_a')),
          '00000000-0000-0000-0000-00000000a9c2'::uuid, 'job_id is the latest job of the appointment');

select tests.act_as_admin();
update public.job set enabled = false where id = '00000000-0000-0000-0000-00000000a9c2';
select tests.act_as('user_a');
select is((select job_id from public.appointment_list where id = tests.id('appointment_a')),
          '00000000-0000-0000-0000-00000000a9c1'::uuid, 'an archived job is skipped: the older active one shows');
select is((select job_id from public.appointment_list where id = '00000000-0000-0000-0000-00000000a9a1'),
          null::uuid, 'job_id is null when the only job is archived');

-- -----------------------------------------------------------------------------
-- Tenant isolation
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.appointment_list where shop_id = tests.id('shop_b')), 0,
          'user_a sees no appointment of shop B through appointment_list');
select tests.act_as('user_b');
select results_eq($$ select id from public.appointment_list $$, $$ select tests.id('appointment_b') $$,
                  'user_b sees only shop B''s appointment');
select is((select job_id from public.appointment_list where id = tests.id('appointment_b')), null::uuid,
          'user_b does not see shop A''s jobs as the appointment''s job');
select tests.act_as('user_a_off');
select is((select count(*)::int from public.appointment_list), 0, 'a disabled profile sees nothing');
select tests.act_as_anon();
select throws_ok($$ select count(*) from public.appointment_list $$, '42501', null, 'anon cannot read appointment_list');

-- -----------------------------------------------------------------------------
-- Read only
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');
select throws_ok($$ update public.appointment_list set status = 'cancelado' $$, '42501', null,
                 'appointment_list cannot be updated');
select throws_ok($$ delete from public.appointment_list $$, '42501', null, 'appointment_list cannot be deleted from');

-- -----------------------------------------------------------------------------
-- Rules the page relies on
-- -----------------------------------------------------------------------------
select tests.act_as_admin();
update public.vehicle set enabled = false where id = '00000000-0000-0000-0000-00000000a9b1';
select tests.act_as('user_a');
select throws_ok($$
  insert into public.appointment (shop_id, vehicle_id, date, time)
  values (tests.id('shop_a'), '00000000-0000-0000-0000-00000000a9b1', '2026-11-03', '10:00') $$,
  '23514', 'vehicle_archived', 'an archived vehicle gets no new appointment');
select lives_ok($$ update public.appointment set status = 'cancelado' where id = '00000000-0000-0000-0000-00000000a9a1' $$,
                'an appointment of an archived vehicle can still change status');
select throws_ok($$
  insert into public.appointment (shop_id, vehicle_id, date, time)
  values (tests.id('shop_a'), tests.id('vehicle_b'), '2026-11-03', '10:00') $$,
  '23503', null, 'another shop''s vehicle is refused');

select * from finish();
rollback;
