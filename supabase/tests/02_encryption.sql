-- Encryption at rest: ciphertext in tables, plain values in views,
-- normalization, hashes and access to the private helpers (spec 003).
begin;
\ir _fixtures.psql
select * from no_plan();

-- -----------------------------------------------------------------------------
-- Tables hold ciphertext
-- -----------------------------------------------------------------------------
select tests.act_as_admin();

select ok((select name <> 'Martín' and surname <> 'Suárez' and dni <> '28456123'
                  and phone_number <> '11 5555-0101' and email <> 'martin@example.com'
           from public.client where id = tests.id('client_a')),
          'client: every sensitive column is stored encrypted');
select ok((select position('AE482KD' in plate) = 0 and position('8AP359' in upper(vin)) = 0
           from public.vehicle where id = tests.id('vehicle_a')),
          'vehicle: plate and VIN are stored encrypted');
select ok((select reason <> 'Ruido al frenar' from public.appointment where id = tests.id('appointment_a')),
          'appointment: reason is stored encrypted');
select ok((select observations <> 'Pidió aceite 5W30.' from public.job where id = tests.id('job_a')),
          'job: observations are stored encrypted');
select lives_ok($$ select decode(name, 'base64') from public.client $$, 'ciphertext is base64');

-- Encryption is randomized: the same plate in two shops gives different ciphertext.
select isnt((select plate from public.vehicle where id = tests.id('vehicle_a')),
            (select plate from public.vehicle where id = tests.id('vehicle_b')),
            'same plaintext encrypts differently');

-- -----------------------------------------------------------------------------
-- Views return plain, normalized values
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select results_eq(
  $$ select name, surname, dni, phone_number, email from public.client_decrypted where id = tests.id('client_a') $$,
  $$ values ('Martín', 'Suárez', '28456123', '11 5555-0101', 'martin@example.com') $$,
  'client_decrypted returns plain values, DNI as digits only');
select results_eq(
  $$ select plate, vin from public.vehicle_decrypted where id = tests.id('vehicle_a') $$,
  $$ values ('AE482KD', '8AP359A1XMU123456') $$,
  'vehicle_decrypted returns the plate uppercase without spaces or dashes');
select is((select reason from public.appointment_decrypted where id = tests.id('appointment_a')), 'Ruido al frenar',
          'appointment_decrypted returns the reason');
select is((select observations from public.job_decrypted where id = tests.id('job_a')), 'Pidió aceite 5W30.',
          'job_decrypted returns the observations');

-- A user writes plaintext through the Data API and reads it back via the view.
insert into public.client (id, shop_id, name, phone_number, dni)
values ('00000000-0000-0000-0000-00000000a1a1', tests.id('shop_a'), 'Diego', '11 5555-0103', ' 30-111-222 ');
select is((select dni from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a1a1'), '30111222',
          'a user''s insert is encrypted and normalized');
select is((select surname from public.client_decrypted where id = '00000000-0000-0000-0000-00000000a1a1'), null,
          'empty optional columns stay null');

-- -----------------------------------------------------------------------------
-- Updates that don't touch a column keep its ciphertext
-- -----------------------------------------------------------------------------
select tests.act_as_admin();
create temp table snapshot as
  select name, surname, dni, dni_hash, phone_number, email from public.client where id = tests.id('client_a');
grant select on snapshot to authenticated;

select tests.act_as('user_a');
update public.client set enabled = false where id = tests.id('client_a');

select tests.act_as_admin();
select results_eq(
  $$ select name, surname, dni, dni_hash, phone_number, email from public.client where id = tests.id('client_a') $$,
  $$ select * from snapshot $$,
  'archiving a client leaves its encrypted columns and hash untouched');

-- -----------------------------------------------------------------------------
-- Hashes are computed by the database, never taken from the client
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');
insert into public.client (id, shop_id, name, phone_number, dni, dni_hash)
values ('00000000-0000-0000-0000-00000000a1a2', tests.id('shop_a'), 'Ana', '11 5555-0105', '40987654', 'falso');
update public.vehicle set plate_hash = 'falso' where id = tests.id('vehicle_a');

select tests.act_as_admin();
select is((select dni_hash from public.client where id = '00000000-0000-0000-0000-00000000a1a2'),
          private.blind_index('40987654'), 'a client-sent dni_hash is replaced on insert');
select is((select plate_hash from public.vehicle where id = tests.id('vehicle_a')),
          private.blind_index('AE482KD'), 'a client-sent plate_hash is ignored on update');

-- -----------------------------------------------------------------------------
-- Keys and helpers are out of reach
-- -----------------------------------------------------------------------------
select tests.act_as('user_a');

select throws_ok($$ select private.encrypt_text('x') $$,               '42501', null, 'authenticated can''t encrypt directly');
select throws_ok($$ select private.blind_index('x') $$,                '42501', null, 'authenticated can''t hash directly');
select throws_ok($$ select private.vault_secret('torque_data_key') $$, '42501', null, 'authenticated can''t read Vault through the helper');
select throws_ok($$ select decrypted_secret from vault.decrypted_secrets $$, '42501', null, 'authenticated can''t read Vault');

select tests.act_as_anon();

select throws_ok($$ select private.decrypt_text('x') $$,               '42501', null, 'anon can''t decrypt');
select throws_ok($$ select private.vault_secret('torque_data_key') $$, '42501', null, 'anon can''t read Vault through the helper');
select throws_ok($$ select decrypted_secret from vault.decrypted_secrets $$, '42501', null, 'anon can''t read Vault');

select * from finish();
rollback;
