# 003 — Database tests: Tasks

**Status:** Done
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Fixtures and a smoke test**
  - Do: `supabase/tests/_fixtures.psql` (pgTAP, Vault secrets, two shops, users, profiles, base data, `tests.*` helpers) and `01_tenant_isolation.sql` with one test per shop ("each user sees only their own shop"). Settle the include mechanism (see design risks).
  - Verify: the `Database tests` workflow runs the test and passes on the PR.
- [x] **2. Tenant isolation**
  - Do: complete `01_tenant_isolation.sql`: every tenant table and `*_decrypted` view for own rows, foreign shop_id, cross-shop FKs, disabled profile and `anon`; writes rejected on `shop`, `profile`, `job_status_history`; `brand`/`model` access.
  - Verify: CI passes.
- [x] **2a. Read-only tables at grant level** (found by task 2)
  - Do: migration `20261016000000_dcl-read-only-tables.sql` revoking INSERT/UPDATE/DELETE on `shop` and `job_status_history` from `authenticated`; `db_schema.sql` updated.
  - Verify: CI passes the four read-only write tests in `01_tenant_isolation.sql`.
- [x] **3. Encryption**
  - Do: `02_encryption.sql`: ciphertext in tables, plain values in views, normalization, `enabled`-only update keeps ciphertext, client-sent hashes ignored, private functions and Vault denied to `authenticated` and `anon`.
  - Verify: CI passes.
- [x] **4. Uniqueness and search**
  - Do: `03_uniqueness_search.sql`: plate/DNI duplicates per shop in any format, allowed across shops, clients without DNI, `search_text` matches.
  - Verify: CI passes.
- [x] **5. Job rules**
  - Do: `04_job_rules.sql`: status set and defaults, status history, closed jobs and items, kilometers.
  - Verify: CI passes.
- [x] **6. Archived records**
  - Do: `05_archived.sql`: vehicle, client and service archive rules, existing records unaffected.
  - Verify: CI passes.
- [x] **7. Docs**
  - Do: `supabase/tests/README.md` (what each file covers, how to run locally with Docker); `docs/architecture.md#database-tests` points to it; spec statuses to `Done`.
  - Verify: docs match the tests.
