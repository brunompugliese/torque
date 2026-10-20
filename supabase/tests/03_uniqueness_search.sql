-- Plate and DNI uniqueness per shop, and search on decrypted values (spec 003).
begin;
\ir _fixtures.psql
select * from no_plan();

-- -----------------------------------------------------------------------------
-- Plate: unique per shop, in any format
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select throws_ok($$ insert into public.vehicle (shop_id, plate, brand_id, model_id)
                    values (tests.id('shop_a'), 'AE 482 KD', tests.id('brand_fiat'), tests.id('model_cronos')) $$,
                 '23505', null, 'duplicate plate in the same shop is rejected');
select throws_ok($$ insert into public.vehicle (shop_id, plate, brand_id, model_id)
                    values (tests.id('shop_a'), 'ae.482.kd', tests.id('brand_fiat'), tests.id('model_cronos')) $$,
                 '23505', null, 'duplicate plate typed differently is rejected');
select lives_ok($$ insert into public.vehicle (shop_id, plate, brand_id, model_id)
                   values (tests.id('shop_a'), 'KTP 482', tests.id('brand_vw'), tests.id('model_gol')) $$,
                'a new plate is accepted');

-- Changing a plate to one already used in the shop is rejected too.
select throws_ok($$ update public.vehicle set plate = 'AE482KD'
                    where shop_id = tests.id('shop_a') and id <> tests.id('vehicle_a') $$,
                 '23505', null, 'changing a plate to a duplicate is rejected');

-- The fixtures already hold AE482KD in both shops; one more for shop B:
select tests.act_as('user_b');
select lives_ok($$ insert into public.vehicle (shop_id, plate, brand_id, model_id)
                   values (tests.id('shop_b'), 'KTP482', tests.id('brand_vw'), tests.id('model_gol')) $$,
                'a plate used in another shop is accepted');

-- -----------------------------------------------------------------------------
-- DNI: unique per shop when given
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select throws_ok($$ insert into public.client (shop_id, name, phone_number, dni)
                    values (tests.id('shop_a'), 'Otro', '11 5555-0199', '28456123') $$,
                 '23505', null, 'duplicate DNI in the same shop is rejected');
select throws_ok($$ insert into public.client (shop_id, name, phone_number, dni)
                    values (tests.id('shop_a'), 'Otro', '11 5555-0199', '28 456 123') $$,
                 '23505', null, 'duplicate DNI typed differently is rejected');
select lives_ok($$ insert into public.client (shop_id, name, phone_number)
                   values (tests.id('shop_a'), 'Sin DNI uno', '11 5555-0110'),
                          (tests.id('shop_a'), 'Sin DNI dos', '11 5555-0111') $$,
                'several clients without DNI are accepted');
select lives_ok($$ insert into public.client (shop_id, name, phone_number, dni)
                   values (tests.id('shop_a'), 'Pablo', '11 5555-0112', '31222333') $$,
                'a new DNI is accepted');

select tests.act_as('user_b');
select lives_ok($$ insert into public.client (shop_id, name, phone_number, dni)
                   values (tests.id('shop_b'), 'Pablo', '11 5555-0212', '31.222.333') $$,
                'a DNI used in another shop is accepted');

-- -----------------------------------------------------------------------------
-- Search on search_text (the app normalizes the term the same way)
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq($$ select id from public.client_decrypted where search_text like '%suarez%' $$,
                  $$ select tests.id('client_a') $$, 'client: surname without accent');
select results_eq($$ select id from public.client_decrypted where search_text like '%martinsuarez%' $$,
                  $$ select tests.id('client_a') $$, 'client: name and surname together');
select results_eq($$ select id from public.client_decrypted where search_text like '%28456123%' $$,
                  $$ select tests.id('client_a') $$, 'client: DNI typed with dots');
select results_eq($$ select id from public.client_decrypted where search_text like '%1155550101%' $$,
                  $$ select tests.id('client_a') $$, 'client: phone without spaces or dashes');
select is_empty($$ select 1 from public.client_decrypted where search_text like '%rios%' $$,
                'client: another shop''s client is never found');

select results_eq($$ select id from public.vehicle_decrypted where search_text like '%ae482%' $$,
                  $$ select tests.id('vehicle_a') $$, 'vehicle: partial plate');
select results_eq($$ select id from public.vehicle_decrypted where search_text like '%fiatcronos%' $$,
                  $$ select tests.id('vehicle_a') $$, 'vehicle: brand and model');
select results_eq($$ select id from public.vehicle_decrypted where search_text like '%8ap359%' $$,
                  $$ select tests.id('vehicle_a') $$, 'vehicle: VIN');

select * from finish();
rollback;
