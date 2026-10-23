-- The job list view, the status counts and save_job (spec 007).
begin;
\ir _fixtures.psql
select * from no_plan();

-- Extra fake data in shop A (the fixtures already have vehicle_a with client_a, job_a at 100.000 km
-- and appointment_a):
--   a second vehicle (Volkswagen Gol), no client
--   job 1: en_progreso, final total, client_a, linked to appointment_a
--   job 2: pendiente, quoted total only, no client, other vehicle
--   job 3: entregado, archived
insert into public.vehicle (id, shop_id, client_id, plate, brand_id, model_id, year) values
  ('00000000-0000-0000-0000-00000000a9b1', tests.id('shop_a'), null, 'cc 222 cc',
   tests.id('brand_vw'), tests.id('model_gol'), 2012);

insert into public.job (id, shop_id, vehicle_id, client_id, appointment_id, status, kilometers, quoted_total, final_total, enabled, observations, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000a9c1', tests.id('shop_a'), tests.id('vehicle_a'), tests.id('client_a'), tests.id('appointment_a'),
   'en_progreso', 110000, 70000, 75000, true, 'Ruido en la rueda', now() - interval '3 days', '2026-09-10 15:00:00+00'),
  ('00000000-0000-0000-0000-00000000a9c2', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a9b1', null, null,
   'pendiente', null, 20000, null, true, null, now() - interval '2 days', '2026-09-20 15:00:00+00'),
  ('00000000-0000-0000-0000-00000000a9c3', tests.id('shop_a'), '00000000-0000-0000-0000-00000000a9b1', null, null,
   'entregado', null, 30000, 30000, false, null, now() - interval '1 day', '2026-09-30 23:30:00+00');

-- The job a save_job test created, found by its (unique) observations.
create function tests.job_by_obs(obs text)
returns uuid
language sql
stable
as $$
  select id from public.job_list where observations = obs;
$$;
grant execute on function tests.job_by_obs(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Structure
-- -----------------------------------------------------------------------------
select has_function('public', 'save_job', 'save_job exists');
select has_view('public', 'job_list', 'job_list exists');
select has_function('public', 'job_status_counts', 'job_status_counts exists');

-- -----------------------------------------------------------------------------
-- job_list columns
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq($$ select plate, vehicle_year, brand_name, model_name, vehicle_enabled,
                            client_name, client_surname, client_phone_number, client_enabled,
                            observations
                     from public.job_list where id = '00000000-0000-0000-0000-00000000a9c1' $$,
                  $$ values ('AE482KD', 2021, 'Fiat', 'Cronos', true,
                             'Martín', 'Suárez', '11 5555-0101', true,
                             'Ruido en la rueda') $$,
                  'the vehicle, the client and the observations come decrypted');
select results_eq($$ select appointment_date is not null, appointment_time::text, appointment_enabled
                     from public.job_list where id = '00000000-0000-0000-0000-00000000a9c1' $$,
                  $$ values (true, '09:00:00', true) $$,
                  'the linked appointment');
select results_eq($$ select client_name, client_surname, client_enabled, client_name_key, appointment_date
                     from public.job_list where id = '00000000-0000-0000-0000-00000000a9c2' $$,
                  $$ values (null::text, null::text, null::boolean, null::text, null::date) $$,
                  'a job without client or appointment has empty columns, including its name key');

select results_eq($$ select status_order from public.job_list
                     where id in ('00000000-0000-0000-0000-00000000a9c1', '00000000-0000-0000-0000-00000000a9c2',
                                  '00000000-0000-0000-0000-00000000a9c3') order by id $$,
                  $$ values (4), (1), (6) $$,
                  'status_order follows the status order');
select results_eq($$ select total_amount from public.job_list
                     where id in ('00000000-0000-0000-0000-00000000a9c1', '00000000-0000-0000-0000-00000000a9c2')
                     order by id $$,
                  $$ values (75000::numeric), (20000::numeric) $$,
                  'total_amount is the final total when there is one, otherwise the quoted one');
select is((select vehicle_key from public.job_list where id = '00000000-0000-0000-0000-00000000a9c1'),
          'fiatcronos2021', 'vehicle_key: brand, model and year, normalized');
select is((select client_name_key from public.job_list where id = '00000000-0000-0000-0000-00000000a9c1'),
          'martinsuarez', 'client_name_key: name and surname, normalized');

-- search_text: plate, brand + model and client, ignoring case, accents, spaces, dots and dashes.
select is((select count(*)::int from public.job_list where search_text like '%ae482kd%'), 2,
          'search_text finds the plate of the vehicle''s jobs (job_a and the new one)');
select is((select count(*)::int from public.job_list where search_text like '%fiatcronos%'), 2,
          'search_text finds brand and model');
select is((select count(*)::int from public.job_list where search_text like '%martinsuarez%'), 2,
          'search_text finds the client');
select is((select count(*)::int from public.job_list where search_text like '%volkswagengol%'), 2,
          'search_text finds jobs of another vehicle by brand and model');

-- -----------------------------------------------------------------------------
-- Tenant isolation
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.job_list where shop_id = tests.id('shop_b')), 0,
          'user_a sees no job of shop B through job_list');
select tests.act_as('user_b');
select results_eq($$ select id from public.job_list $$, $$ select tests.id('job_b') $$,
                  'user_b sees only shop B''s job');
select tests.act_as('user_a_off');
select is((select count(*)::int from public.job_list), 0, 'a disabled profile sees nothing');
select tests.act_as_anon();
select throws_ok($$ select count(*) from public.job_list $$, '42501', null, 'anon cannot read job_list');

-- -----------------------------------------------------------------------------
-- job_status_counts
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq($$ select status, total::int from public.job_status_counts(null, false, null, null) order by status $$,
                  $$ values ('en_progreso', 1), ('pendiente', 2) $$,
                  'counts per status, active jobs only (job_a is pendiente, the archived one is left out)');
select results_eq($$ select status, total::int from public.job_status_counts(null, true, null, null) order by status $$,
                  $$ values ('en_progreso', 1), ('entregado', 1), ('pendiente', 2) $$,
                  'the archived switch adds the archived jobs');
select results_eq($$ select status, total::int from public.job_status_counts('%volkswagen%', false, null, null) order by status $$,
                  $$ values ('entregado', 1), ('pendiente', 1) $$,
                  'a search includes archived jobs even with the switch off');
select results_eq($$ select status, total::int from public.job_status_counts(
                       null, true, '2026-09-15 00:00:00+00', '2026-10-01 00:00:00+00') order by status $$,
                  $$ values ('entregado', 1), ('pendiente', 1) $$,
                  'the date range bounds updated_at, the end excluded');
select is((select count(*)::int from public.job_status_counts(null, true, null, null)
           where status = 'cancelado'), 0, 'statuses without jobs are not listed');

select tests.act_as('user_b');
select results_eq($$ select status, total::int from public.job_status_counts(null, true, null, null) $$,
                  $$ values ('pendiente', 1) $$,
                  'counts only count the caller''s shop');
select tests.act_as_anon();
select throws_ok($$ select * from public.job_status_counts(null, true, null, null) $$, '42501', null,
                 'anon cannot run job_status_counts');

-- -----------------------------------------------------------------------------
-- save_job: create
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select lives_ok($$
  select public.save_job(null, tests.id('vehicle_a'), tests.id('client_a'), 'pendiente', 120000, null, 'save create', 150, null,
    jsonb_build_array(
      jsonb_build_object('service_id', tests.id('service_a'), 'quantity', 2, 'quoted_unit_price', 50, 'final_unit_price', null),
      jsonb_build_object('new_service', jsonb_build_object('name', 'Alineación', 'description', null),
                         'quantity', 1, 'quoted_unit_price', 50, 'final_unit_price', null)),
    null) $$, 'save_job creates a job with an existing and a new service');

select results_eq($$ select status, kilometers, quoted_total, final_total from public.job_list where observations = 'save create' $$,
                  $$ values ('pendiente', 120000, 150::numeric, null::numeric) $$,
                  'the job was saved with its status, km and totals');
select results_eq($$ select s.name, i.quantity from public.job_item i join public.service s on s.id = i.service_id
                     where i.job_id = tests.job_by_obs('save create') order by i.created_at $$,
                  $$ values ('Cambio de aceite', 2::numeric), ('Alineación', 1::numeric) $$,
                  'the items keep the order they were sent in, and the new service was created');
select results_eq($$ select old_status, new_status from public.job_status_history where job_id = tests.job_by_obs('save create') $$,
                  $$ values (null::text, 'pendiente') $$,
                  'the creation is logged once');

-- -----------------------------------------------------------------------------
-- save_job: update (item diff)
-- -----------------------------------------------------------------------------
select lives_ok($$
  select public.save_job(tests.job_by_obs('save create'), tests.id('vehicle_a'), tests.id('client_a'), 'pendiente', 120000, null,
    'save create', 175, null,
    jsonb_build_array(
      jsonb_build_object('id', (select i.id from public.job_item i
                                where i.job_id = tests.job_by_obs('save create') and i.service_id = tests.id('service_a')),
                         'service_id', tests.id('service_a'), 'quantity', 3, 'quoted_unit_price', 50, 'final_unit_price', null),
      jsonb_build_object('new_service', jsonb_build_object('name', 'Balanceo', 'description', 'Ruedas'),
                         'quantity', 1, 'quoted_unit_price', 25, 'final_unit_price', null)),
    null) $$, 'save_job updates a job: keeps one item, drops one, adds one');
select results_eq($$ select s.name, i.quantity from public.job_item i join public.service s on s.id = i.service_id
                     where i.job_id = tests.job_by_obs('save create') order by i.created_at $$,
                  $$ values ('Cambio de aceite', 3::numeric), ('Balanceo', 1::numeric) $$,
                  'the kept item was updated, the missing one deleted, the new one added at the end');
select is((select count(*)::int from public.job_status_history where job_id = tests.job_by_obs('save create')), 1,
          'an update with the same status adds no history entry');

-- -----------------------------------------------------------------------------
-- save_job: the work phase keeps the quoted price of existing items
-- -----------------------------------------------------------------------------
select lives_ok($$
  select public.save_job(tests.job_by_obs('save create'), tests.id('vehicle_a'), tests.id('client_a'), 'en_progreso', 120000, null,
    'save create', 150, 180,
    jsonb_build_array(
      jsonb_build_object('id', (select i.id from public.job_item i
                                where i.job_id = tests.job_by_obs('save create') and i.service_id = tests.id('service_a')),
                         'service_id', tests.id('service_a'), 'quantity', 3, 'quoted_unit_price', 50, 'final_unit_price', 60)),
    null) $$, 'save_job moves a job into the work phase and drops an item');
select results_eq($$ select old_status, new_status from public.job_status_history
                     where job_id = tests.job_by_obs('save create') order by old_status nulls first $$,
                  $$ values (null::text, 'pendiente'), ('pendiente', 'en_progreso') $$,
                  'the status change is logged by the database');

select lives_ok($$
  select public.save_job(tests.job_by_obs('save create'), tests.id('vehicle_a'), tests.id('client_a'), 'en_progreso', 120000, null,
    'save create', 150, 210,
    jsonb_build_array(
      jsonb_build_object('id', (select i.id from public.job_item i where i.job_id = tests.job_by_obs('save create')),
                         'service_id', tests.id('service_a'), 'quantity', 3, 'quoted_unit_price', 999, 'final_unit_price', 70)),
    null) $$, 'save_job saves a work-phase job with another quoted price sent');
select results_eq($$ select quoted_unit_price, final_unit_price from public.job_item where job_id = tests.job_by_obs('save create') $$,
                  $$ values (50::numeric, 70::numeric) $$,
                  'the quoted price of an existing item is kept in the work phase, the final price changes');

-- -----------------------------------------------------------------------------
-- save_job: closing saves the items first
-- -----------------------------------------------------------------------------
select lives_ok($$
  select public.save_job(tests.job_by_obs('save create'), tests.id('vehicle_a'), tests.id('client_a'), 'entregado', 120000, null,
    'save create', 150, 220,
    jsonb_build_array(
      jsonb_build_object('id', (select i.id from public.job_item i where i.job_id = tests.job_by_obs('save create')),
                         'service_id', tests.id('service_a'), 'quantity', 3, 'quoted_unit_price', 50, 'final_unit_price', 75)),
    null) $$, 'save_job changes the items and closes the job in the same save');
select results_eq($$ select status, final_total from public.job_list where observations = 'save create' $$,
                  $$ values ('entregado', 220::numeric) $$, 'the job is closed with the new total');
select throws_ok($$
  select public.save_job(tests.job_by_obs('save create'), tests.id('vehicle_a'), tests.id('client_a'), 'entregado', 120000, null,
    'save create', 150, 220, '[]'::jsonb, null) $$,
  '23514', 'job_closed', 'a closed job can''t be saved again');

-- -----------------------------------------------------------------------------
-- save_job: created directly as closed
-- -----------------------------------------------------------------------------
select lives_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'cancelado', null, null, 'save closed', 40, null,
    jsonb_build_array(jsonb_build_object('service_id', tests.id('service_a'), 'quantity', 1, 'quoted_unit_price', 40, 'final_unit_price', null)),
    null) $$, 'save_job creates a job directly as cancelado');
select results_eq($$ select status from public.job_list where observations = 'save closed' $$, $$ values ('cancelado') $$,
                  'the job ends up closed');
select is((select count(*)::int from public.job_item where job_id = tests.job_by_obs('save closed')), 1,
          'its item was saved before the close');
select results_eq($$ select old_status, new_status from public.job_status_history
                     where job_id = tests.job_by_obs('save closed') order by old_status nulls first $$,
                  $$ values (null::text, 'pendiente'), ('pendiente', 'cancelado') $$,
                  'the history has the creation and the close');

-- -----------------------------------------------------------------------------
-- save_job: a new client, in the same transaction
-- -----------------------------------------------------------------------------
select lives_ok($$
  select public.save_job(null, tests.id('vehicle_a'), tests.id('client_a'), 'pendiente', null, null, 'save newclient', 0, null, '[]'::jsonb,
    jsonb_build_object('name', 'Nuevo', 'surname', 'Cliente', 'phone_number', '11 5555-9999', 'dni', null)) $$,
  'save_job creates the client and the job together');
select results_eq($$ select client_name, client_surname, client_phone_number from public.job_list where observations = 'save newclient' $$,
                  $$ values ('Nuevo', 'Cliente', '11 5555-9999') $$,
                  'the job has the new client, not the client_id sent');

select tests.act_as_admin();
select is((select count(*)::int from public.client where name = 'Nuevo'), 0, 'the new client is stored encrypted');
select tests.act_as('user_a');

-- -----------------------------------------------------------------------------
-- save_job: errors roll everything back
-- -----------------------------------------------------------------------------
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', null, null, 'save dni', 0, null,
    jsonb_build_array(jsonb_build_object('new_service', jsonb_build_object('name', 'Servicio huérfano', 'description', null),
                                         'quantity', 1, 'quoted_unit_price', 1, 'final_unit_price', null)),
    jsonb_build_object('name', 'Otro', 'surname', 'Cliente', 'phone_number', '11 5555-8888', 'dni', '28456123')) $$,
  '23505', 'client_dni_taken', 'a taken DNI is reported');
select is((select count(*)::int from public.job_list where observations = 'save dni'), 0, 'no job was left behind');
select is((select count(*)::int from public.service where name = 'Servicio huérfano'), 0, 'no service was left behind');

select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', 50000, null, 'save km', 0, null, '[]'::jsonb, null) $$,
  '23514', 'job_kilometers_below_previous', 'a km below the previous jobs is rejected');
select throws_ok($$
  select public.save_job('00000000-0000-0000-0000-00000000ffff', tests.id('vehicle_a'), null, 'pendiente', null, null, null, 0, null, '[]'::jsonb, null) $$,
  'P0002', 'job_not_found', 'a job that does not exist (or is another shop''s) is not found');
select throws_ok($$
  select public.save_job(tests.job_by_obs('save newclient'), tests.id('vehicle_a'), null, 'pendiente', null, null, 'save newclient', 0, null,
    jsonb_build_array(jsonb_build_object('id', tests.id('item_a'), 'service_id', tests.id('service_a'), 'quantity', 1,
                                         'quoted_unit_price', 1, 'final_unit_price', null)), null) $$,
  'P0002', 'job_item_not_found', 'an item of another job can''t be updated through this one');

select throws_ok($$
  select public.save_job(null, tests.id('vehicle_b'), null, 'pendiente', null, null, 'save cross', 0, null, '[]'::jsonb, null) $$,
  '23503', null, 'another shop''s vehicle is rejected');
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), tests.id('client_b'), 'pendiente', null, null, 'save cross', 0, null, '[]'::jsonb, null) $$,
  '23503', null, 'another shop''s client is rejected');
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', null, tests.id('appointment_b'), 'save cross', 0, null, '[]'::jsonb, null) $$,
  '23503', null, 'another shop''s appointment is rejected');
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', null, null, 'save cross', 0, null,
    jsonb_build_array(jsonb_build_object('service_id', tests.id('service_b'), 'quantity', 1, 'quoted_unit_price', 1, 'final_unit_price', null)), null) $$,
  '23503', null, 'another shop''s service is rejected');
select is((select count(*)::int from public.job_list where observations in ('save cross', 'save km')), 0, 'the rejected saves left nothing');

-- Archived parents (set up as admin, last: they change the data the checks above rely on).
select tests.act_as_admin();
update public.vehicle set enabled = false where id = '00000000-0000-0000-0000-00000000a9b1';
insert into public.client (id, shop_id, name, phone_number, enabled) values
  ('00000000-0000-0000-0000-00000000a9a1', tests.id('shop_a'), 'Archivado', '11 5555-0404', false);
insert into public.service (id, shop_id, name, enabled) values
  ('00000000-0000-0000-0000-00000000a9d1', tests.id('shop_a'), 'Servicio archivado', false);
select tests.act_as('user_a');

select throws_ok($$
  select public.save_job(null, '00000000-0000-0000-0000-00000000a9b1', null, 'pendiente', null, null, null, 0, null, '[]'::jsonb, null) $$,
  '23514', 'vehicle_archived', 'an archived vehicle gets no new job');
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), '00000000-0000-0000-0000-00000000a9a1', 'pendiente', null, null, null, 0, null, '[]'::jsonb, null) $$,
  '23514', 'client_archived', 'an archived client can''t be put on a job');
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', null, null, null, 1, null,
    jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-0000-0000-00000000a9d1', 'quantity', 1, 'quoted_unit_price', 1, 'final_unit_price', null)), null) $$,
  '23514', 'service_archived', 'an archived service can''t be added to a job');

-- -----------------------------------------------------------------------------
-- save_job: who can run it
-- -----------------------------------------------------------------------------
select tests.act_as_anon();
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', null, null, null, 0, null, '[]'::jsonb, null) $$,
  '42501', null, 'anon cannot run save_job');
select tests.act_as('user_a_off');
select throws_ok($$
  select public.save_job(null, tests.id('vehicle_a'), null, 'pendiente', null, null, null, 0, null, '[]'::jsonb, null) $$,
  '42501', null, 'a disabled profile cannot save a job');

select * from finish();
rollback;
