# 003 — Database tests: Design

**Status:** Approved
**Requirements:** [requirements.md](requirements.md)

## Summary

pgTAP test files in `supabase/tests/`, run by the existing `db-tests.yml` workflow with `npx supabase test db` against a throwaway local database built from the migrations. Shared setup (Vault secrets, two shops, users, profiles, base rows, helpers to act as a user) lives in one fixtures file included by every test, so no setup is duplicated. Each file is one transaction that ends in `rollback`.

## Database

None. Tests only; no migrations, no `db_schema.sql` changes.

- Migrations: none.
- RLS impact: none (tested, not changed).

If a test reveals a bug in a migration, the fix is a new migration in its own task, reflected in `db_schema.sql`, and the spec is updated first (specs/README rule).

## Test files

```
supabase/tests/
  _fixtures.psql            # Included by every test; not a test itself
  01_tenant_isolation.sql   # Every tenant table and view, read-only tables, brand/model
  02_encryption.sql         # Ciphertext, views, normalization, hashes, private functions
  03_uniqueness_search.sql  # Plate/DNI per shop, search_text
  04_job_rules.sql          # Statuses, status history, closed jobs, kilometers
  05_archived.sql           # Vehicle, client and service archive rules
```

Every test file has the same shape:

```sql
begin;
\ir _fixtures.psql
select * from no_plan();
-- tests
select * from finish();
rollback;
```

### Fixtures (`_fixtures.psql`)

- `create extension if not exists pgtap with schema extensions;`
- Each file uses `no_plan()` instead of a fixed `plan(n)`, so adding a test never means recounting; `finish()` still reports every failure.
- Vault secrets `torque_data_key` and `torque_hash_key` created with `vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), …)`. Throwaway, rolled back with the transaction.
- Two shops (A and B), two auth users per shop (one enabled, one disabled profile), inserted directly into `auth.users` with fixed fake UUIDs and `@example.com` emails.
- A small base data set per shop: one client, one vehicle, one service, one appointment, one job with one item.
- Helpers in a `tests` schema created inside the transaction:
  - `tests.act_as(user_id uuid, shop_id uuid)`: `set local role authenticated` and `set local request.jwt.claims` with `sub` and `shop_id`.
  - `tests.act_as_anon()` and `tests.act_as_admin()` (`reset role`, used to set up data that bypasses RLS).
  - Fixed ids exposed through a `tests.ids` table or functions (`tests.shop_a()`, `tests.vehicle_a()`, …) so test files read naturally.

`.psql` is not picked up as a test by `supabase test db` (it runs `*.sql`), and `\ir` resolves the path relative to the including file. Task 1 verifies this in CI before the rest is written; see Risks.

### Assertions used

- `results_eq` / `is_empty` / `isnt_empty` for what each user sees.
- `throws_ok(sql, '23514', 'job_closed')` and similar for rule errors (SQLSTATE plus message).
- `throws_ok(sql, '42501')` for permission denied; RLS write rejections (`new row violates row-level security policy`) also use `42501`.
- `throws_ok(sql, '23503')` for cross-shop foreign keys and `'23505'` for duplicate plate/DNI.
- `lives_ok` for what must be accepted.
- Ciphertext check: the stored value differs from the plain value and decodes as base64; the view returns the plain value.

## Frontend

None.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| Test fixtures and helpers | `supabase/tests/_fixtures.psql` | New, shared by every test file |
| Test files | `supabase/tests/0*_*.sql` | New |
| CI workflow | `.github/workflows/db-tests.yml` | Reused as is (already runs `supabase test db` when tests exist) |

## Validation

None.

## UI text

None.

## Tests

- RLS (pgTAP): this spec.
- Unit (Vitest): none.

## Risks and alternatives

- **No local Supabase stack.** The tests run only in CI unless someone starts a local database with Docker (`npx supabase db start` + `npx supabase test db`). Iterating means pushing and waiting for CI. Accepted; the README of the tests folder will explain how to run them locally if Docker is available.
- **`\ir` include support.** If `supabase test db` doesn't allow psql includes, the fallback is a `tests` schema with the fixture functions created by a test-only SQL file that runs first in the same pg_prove session; if that isn't possible either, each file calls a setup function defined in its own preamble (small, repeated block). Task 1 settles it.
- **Inserting into `auth.users` directly** depends on that table's required columns, which Supabase can change. Kept to the minimum columns (`id`, `email`, `aud`, `role`, `instance_id`) in one place (fixtures).
- **Vault in the test database.** `supabase_vault` is part of the local stack; if `vault.create_secret` isn't available there, CI fails in task 1 and the design is revisited.
- **Alternative: `basejump-supabase_test_helpers`** (a community package with `tests.create_supabase_user`, `tests.authenticate_as`). Rejected for now: one more dependency installed through dbdev, while the few helpers needed here are short.
