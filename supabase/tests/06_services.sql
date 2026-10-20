-- Service name key and search text, set by the database (spec 004).
begin;
\ir _fixtures.psql
select * from no_plan();

-- -----------------------------------------------------------------------------
-- Structure
-- -----------------------------------------------------------------------------
select col_not_null('public', 'service', 'name_key', 'name_key is required');
select col_not_null('public', 'service', 'search_text', 'search_text is required');
select has_index('public', 'service', 'idx_service_shop_name_key', array['shop_id', 'name_key'],
                 'name_key is indexed per shop');
select has_trigger('public', 'service', 'trg_service_normalize', 'service has the normalize trigger');
select ok(not has_function_privilege('authenticated', 'private.normalize_service()', 'execute'),
          'authenticated can''t call the trigger function directly');
select ok(not has_function_privilege('anon', 'private.normalize_service()', 'execute'),
          'anon can''t call the trigger function directly');

-- -----------------------------------------------------------------------------
-- Set by the database on insert and update
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select is((select name_key from public.service where id = tests.id('service_a')), 'cambiodeaceite',
          'fixture: name_key is the normalized name');

insert into public.service (id, shop_id, name, description, name_key, search_text) values
  ('00000000-0000-0000-0000-00000000a3a1', tests.id('shop_a'), 'Alineación y Balanceo',
   'Tren delantero. Incluye cámber.', 'trucho', 'trucho');

select is((select name_key from public.service where id = '00000000-0000-0000-0000-00000000a3a1'),
          'alineacionybalanceo', 'insert: name_key computed, client value overwritten');
select is((select search_text from public.service where id = '00000000-0000-0000-0000-00000000a3a1'),
          'alineacionybalanceo|trendelanteroincluyecamber', 'insert: search_text computed, client value overwritten');

update public.service set name = 'Alineación', description = null
where id = '00000000-0000-0000-0000-00000000a3a1';
select is((select name_key || ' ' || search_text from public.service where id = '00000000-0000-0000-0000-00000000a3a1'),
          'alineacion alineacion', 'update: both columns follow name and description');

update public.service set name_key = 'trucho', search_text = 'trucho'
where id = '00000000-0000-0000-0000-00000000a3a1';
select is((select name_key || ' ' || search_text from public.service where id = '00000000-0000-0000-0000-00000000a3a1'),
          'alineacion alineacion', 'update: the columns can''t be set by a client');

-- -----------------------------------------------------------------------------
-- The same key for names written differently (the app's "name taken" lookup)
-- -----------------------------------------------------------------------------
select is(private.normalize_search('  CAMBIO de  aceíte '), 'cambiodeaceite', 'case, accents and spaces ignored');
select is(private.normalize_search('Cambio-de.aceite'), 'cambiodeaceite', 'dots and dashes ignored');

select results_eq($$ select id from public.service where name_key = private.normalize_search('cambio DE aceíte') $$,
                  $$ select tests.id('service_a') $$, 'lookup by key finds the shop''s service');

-- Archived services are found too: uniqueness compares against both.
select tests.act_as_admin();
insert into public.service (id, shop_id, name, enabled) values
  ('00000000-0000-0000-0000-00000000a3f2', tests.id('shop_a'), 'Lavado de motor', false);
select tests.act_as('user_a');
select results_eq($$ select id from public.service where name_key = private.normalize_search('lavado de MOTOR') $$,
                  $$ values ('00000000-0000-0000-0000-00000000a3f2'::uuid) $$, 'lookup by key finds archived services');

-- No constraint: a duplicate is accepted by the database (the app prevents it).
select lives_ok($$ insert into public.service (shop_id, name) values (tests.id('shop_a'), 'Cambio de Aceite') $$,
                'the database accepts a duplicate name (app-only check, by decision)');

-- -----------------------------------------------------------------------------
-- Search and sort stay within the shop
-- -----------------------------------------------------------------------------
-- The description was cleared above; put it back.
update public.service set description = 'Tren delantero. Incluye cámber.'
where id = '00000000-0000-0000-0000-00000000a3a1';
select results_eq($$ select id from public.service where search_text like '%camber%' $$,
                  $$ values ('00000000-0000-0000-0000-00000000a3a1'::uuid) $$, 'search matches the description without accents');
select results_eq($$ select id from public.service where search_text like '%alineacion%' $$,
                  $$ values ('00000000-0000-0000-0000-00000000a3a1'::uuid) $$, 'search matches the name without accents');

select results_eq($$ select name_key from public.service order by name_key $$,
                  $$ values ('alineacion'), ('cambiodeaceite'), ('cambiodeaceite'), ('lavadodemotor') $$,
                  'name_key sorts A–Z ignoring case and accents');

select tests.act_as('user_b');
select is_empty($$ select 1 from public.service where search_text like '%alineacion%' $$,
                'another shop''s services are never found by search');
select is_empty($$ select 1 from public.service where name_key = 'lavadodemotor' $$,
                'another shop''s services are never found by key');
select results_eq($$ select id from public.service where name_key = 'cambiodeaceite' $$,
                  $$ select tests.id('service_b') $$, 'the same name in another shop is that shop''s own row');

select * from finish();
rollback;
