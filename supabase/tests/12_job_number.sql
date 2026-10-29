-- The job number: sequential per shop, assigned by the database, never reused or changed (spec 013).
begin;
\ir _fixtures.psql
select * from no_plan();

-- The fixtures already hold job_a (shop A) and job_b (shop B): the first job of each shop.

-- -----------------------------------------------------------------------------
-- Structure
-- -----------------------------------------------------------------------------
select has_column('public', 'job', 'number', 'job has a number');
select col_not_null('public', 'job', 'number', 'the number is required');
select has_column('public', 'shop', 'last_job_number', 'shop has a job counter');
select has_trigger('public', 'job', 'trg_job_set_number', 'the number is set by a trigger');
select has_trigger('public', 'job', 'trg_job_number_immutable', 'the number is guarded by a trigger');

-- -----------------------------------------------------------------------------
-- Numbering
-- -----------------------------------------------------------------------------
select tests.act_as_admin();

select is((select number from public.job where id = tests.id('job_a')), 1, 'the first job of shop A is number 1');
select is((select number from public.job where id = tests.id('job_b')), 1, 'the first job of shop B is number 1');
select is((select last_job_number from public.shop where id = tests.id('shop_a')), 1, 'shop A counter is at 1');

select tests.act_as('user_a');

-- The number sent by the caller is ignored.
select lives_ok(
  format($$ insert into public.job (id, shop_id, vehicle_id, number)
            values ('00000000-0000-0000-0000-00000000a5f1', %L, %L, 99) $$,
         tests.id('shop_a'), tests.id('vehicle_a')),
  'a user creates a job in shop A, sending a number');
select is((select number from public.job where id = '00000000-0000-0000-0000-00000000a5f1'), 2,
          'it gets the next number, not the one sent');

-- Archiving keeps the number.
select lives_ok(
  $$ update public.job set enabled = false where id = '00000000-0000-0000-0000-00000000a5f1' $$,
  'the job is archived');
select is((select number from public.job where id = '00000000-0000-0000-0000-00000000a5f1'), 2,
          'an archived job keeps its number');

-- The number can't change.
select throws_ok(
  $$ update public.job set number = 50 where id = '00000000-0000-0000-0000-00000000a5f1' $$,
  '23514', 'job_number_immutable', 'a user can''t change a job''s number');
select throws_ok(
  $$ update public.job set number = 1 where id = '00000000-0000-0000-0000-00000000a5f1' $$,
  '23514', 'job_number_immutable', 'not even to a free or taken number');
select lives_ok(
  $$ update public.job set kilometers = 120000 where id = '00000000-0000-0000-0000-00000000a5f1' $$,
  'other columns still update');
select is((select number from public.job where id = '00000000-0000-0000-0000-00000000a5f1'), 2,
          'and the number stays');

-- The counter is not writable by users.
select throws_ok(
  $$ update public.shop set last_job_number = 0 where id = tests.id('shop_a') $$,
  '42501', null, 'a user can''t touch the counter');

-- -----------------------------------------------------------------------------
-- A failed insert leaves no gap
-- -----------------------------------------------------------------------------
select tests.act_as_admin();

-- The counter moves inside the failed statement and is rolled back with it: the job points at a
-- vehicle of the other shop, so the composite FK rejects it.
do $$
begin
  insert into public.job (id, shop_id, vehicle_id)
  values ('00000000-0000-0000-0000-00000000a5f2', tests.id('shop_a'), tests.id('vehicle_b'));
exception when foreign_key_violation then
  null;
end $$;

select is((select last_job_number from public.shop where id = tests.id('shop_a')), 2,
          'a failed insert does not move the counter');

select tests.act_as('user_a');
select lives_ok(
  format($$ insert into public.job (id, shop_id, vehicle_id)
            values ('00000000-0000-0000-0000-00000000a5f3', %L, %L) $$,
         tests.id('shop_a'), tests.id('vehicle_a')),
  'the next job is created');
select is((select number from public.job where id = '00000000-0000-0000-0000-00000000a5f3'), 3,
          'it gets the number right after the last one: no gap');

-- -----------------------------------------------------------------------------
-- Shops count independently
-- -----------------------------------------------------------------------------
select tests.act_as('user_b');

select lives_ok(
  format($$ insert into public.job (id, shop_id, vehicle_id)
            values ('00000000-0000-0000-0000-00000000b5f1', %L, %L) $$,
         tests.id('shop_b'), tests.id('vehicle_b')),
  'a user creates a job in shop B');
select is((select number from public.job where id = '00000000-0000-0000-0000-00000000b5f1'), 2,
          'shop B counts on its own: 2, not 4');

select tests.act_as_admin();
select is((select last_job_number from public.shop where id = tests.id('shop_a')), 3, 'shop A counter is at 3');
select is((select last_job_number from public.shop where id = tests.id('shop_b')), 2, 'shop B counter is at 2');
select is((select count(*) from public.job where shop_id = tests.id('shop_a')), 3::bigint, 'shop A has three jobs');
select is((select count(distinct number) from public.job where shop_id = tests.id('shop_a')), 3::bigint,
          'with three different numbers');
select throws_ok(
  format($$ update public.job set number = 1 where id = '00000000-0000-0000-0000-00000000a5f3' and shop_id = %L $$,
         tests.id('shop_a')),
  '23514', 'job_number_immutable', 'not even the admin can change a number');

-- -----------------------------------------------------------------------------
-- job_list
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq($$ select number from public.job_list order by number $$,
                  $$ values (1), (2), (3) $$,
                  'job_list exposes the number, and only the shop''s own jobs');
select results_eq($$ select id from public.job_list where search_text like '%000002%' $$,
                  $$ values ('00000000-0000-0000-0000-00000000a5f1'::uuid) $$,
                  'the zero-padded number finds the job');
select results_eq($$ select id from public.job_list where search_text like '%3%' and number = 3 $$,
                  $$ values ('00000000-0000-0000-0000-00000000a5f3'::uuid) $$,
                  'so does the number without zeros (a substring of the padded one)');

select tests.act_as('user_b');
select results_eq($$ select number from public.job_list order by number $$,
                  $$ values (1), (2) $$,
                  'shop B sees only its own numbers');

select * from finish();
rollback;
