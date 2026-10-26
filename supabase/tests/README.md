# Database tests

pgTAP tests for tenant isolation, encryption at rest and the business rules the database enforces ([spec 003](../../specs/003-db-tests/requirements.md)). They run in GitHub Actions (`.github/workflows/db-tests.yml`) on every PR that touches `supabase/`, against a throwaway database built from the migrations. They never touch a hosted project.

| File | Covers |
|---|---|
| `_fixtures.psql` | Shared setup, included by every test: throwaway Vault keys, two shops (A, B), users (one disabled), one row per tenant table, and helpers. Not a test itself. |
| `01_tenant_isolation.sql` | Each user sees only their shop's rows in every table and view; foreign `shop_id` and cross-shop foreign keys rejected; disabled profile and `anon` see nothing; read-only tables; `brand`/`model` access |
| `02_encryption.sql` | Ciphertext in tables, plain values in views, plate/DNI normalization, untouched columns keep their ciphertext, hashes computed by the database, private helpers and Vault out of reach |
| `03_uniqueness_search.sql` | Plate and DNI unique per shop in any format, allowed across shops; `search_text` matches |
| `04_job_rules.sql` | Job and appointment statuses, status history, closed jobs and their items, kilometers |
| `05_archived.sql` | No new work on archived vehicles, clients and services; existing records keep working |
| `06_services.sql` | Service `name_key` and `search_text` set by the database on every write, same key for names written differently, archived services found by key, search and sort per shop ([spec 004](../../specs/004-services/requirements.md)) |
| `07_clients.sql` | Client sort keys in `client_decrypted` (`name_key`, `dni_number`, `phone_key`, `email_key`), search across name, DNI, phone and email, brand and model names in `vehicle_decrypted`, assigning vehicles to a client (guard, archived owner, cross-shop rejected), all per shop ([spec 005](../../specs/005-clients/requirements.md)) |
| `08_vehicles.sql` | Vehicle list columns in `vehicle_decrypted` (`last_km` from non-archived jobs, the client's decrypted data and name key, `vehicle_key`), and `save_vehicle_with_new_client` (create and update paths, rollback on a taken plate or DNI, cross-shop, `anon` and disabled profile rejected), all per shop ([spec 006](../../specs/006-vehicles/requirements.md)) |
| `09_jobs.sql` | The job list view (`job_list`: decrypted vehicle, client and appointment, `search_text`, sort keys, `total_amount`) `job_status_counts` (per status, search, archived switch, date range) and `save_job` (create, item diff, quoted price kept in the work phase, closing after the items, created as closed, new client, rollbacks and each error, cross-shop, `anon` and disabled profile rejected), all per shop ([spec 007](../../specs/007-jobs/requirements.md)) |
| `10_appointments.sql` | The appointment list view (`appointment_list`: decrypted vehicle, client and reason, `job_id` = latest non-archived job), read only, per shop, `anon` and disabled profile rejected, and the rules the Turnos page relies on (archived vehicle, cross-shop vehicle) ([spec 008](../../specs/008-appointments/requirements.md)) |

## Writing a test

Every file has the same shape. Everything runs in one transaction that is rolled back, so tests can't affect each other.

```sql
begin;
\ir _fixtures.psql
select * from no_plan();

select tests.act_as('user_a');          -- user_a, user_a_off (disabled), user_b
select results_eq($$ select id from public.client $$, $$ select tests.id('client_a') $$, 'only own rows');

select * from finish();
rollback;
```

- `tests.id('<name>')` returns a fixture id (`shop_a`, `client_b`, `vehicle_a`, `model_cronos`, …; see `_fixtures.psql`).
- `tests.act_as('<user>')`, `tests.act_as_anon()` and `tests.act_as_admin()` switch who runs the next statements. Admin bypasses RLS; use it for setup and to inspect raw (encrypted) values.
- Rule errors: `throws_ok(sql, '23514', 'job_closed', description)`. Permission and RLS errors are `42501`, cross-shop foreign keys `23503`, duplicates `23505`.
- Use only fake data.

## Running locally

Needs Docker running.

```bash
npx supabase db start    # local database with every migration applied
npx supabase test db     # run the tests
npx supabase db stop
```
