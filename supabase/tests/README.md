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
