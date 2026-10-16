# 003 — Database tests: Requirements

**Status:** Done

## Problem

The database enforces tenant isolation, encryption at rest and business rules (closed jobs, kilometers, archived records), but `supabase/tests/` is empty. CI only proves that the migrations apply, not that they behave as documented. A broken policy or trigger would reach `torque-dev` unnoticed, and the project rules require pgTAP tests for RLS and database rules.

## Users

No end users. The project owner and agents, who need confidence that a database change didn't break isolation, encryption or a business rule.

## User stories

- As the owner, I want every PR that touches the database to prove that one shop can't see or change another shop's data, so that a mistake in a policy never reaches a real shop.
- As the owner, I want tests that show sensitive data is stored encrypted and readable only through the views, so that I can trust the encryption claims in the docs.
- As the owner, I want the business rules the database enforces to be tested, so that the app can rely on them.

## Acceptance criteria

General

- [x] Given a PR that touches `supabase/`, when CI runs, then the pgTAP tests in `supabase/tests/` run against a throwaway database built from the migrations, and the PR fails if any test fails.
- [x] Given any test file, when it runs, then it creates its own shops, auth users, profiles and Vault secrets inside a transaction that is rolled back, uses only fake data, and never needs a hosted project or real keys.

Tenant isolation (every tenant table: `shop`, `profile`, `client`, `vehicle`, `service`, `appointment`, `job`, `job_item`, `job_status_history`, and the four `*_decrypted` views)

- [x] Given users of two shops, when each reads a table or view, then they see only their own shop's rows.
- [x] Given a user, when they insert or update a row with another shop's `shop_id`, then it is rejected.
- [x] Given a user, when they reference another shop's row through a foreign key (e.g. a job on another shop's vehicle), then it is rejected.
- [x] Given a disabled profile, when it reads any table or view, then it sees nothing.
- [x] Given `anon`, when it reads any tenant table or view, then it sees nothing or is denied.
- [x] Given the read-only tables (`shop`, `profile`, `job_status_history`), when a user inserts, updates or deletes, then it is rejected.
- [x] Given `brand` and `model`, when `anon` reads them, then it can; when `anon` writes, then it is denied.

Encryption

- [x] Given a new client, vehicle, appointment or job, when the base table is read, then every encrypted column holds ciphertext, not the plain value.
- [x] Given the same rows, when read through the `*_decrypted` views, then the plain values come back.
- [x] Given a plate typed as "ae 482-kd" and a DNI as "28.456.123", when saved, then the views return "AE482KD" and "28456123".
- [x] Given an update that only changes `enabled`, when it runs, then the encrypted columns are unchanged.
- [x] Given a client sends `plate_hash` or `dni_hash`, when the row is saved, then the database ignores it and computes its own.
- [x] Given a user, when they call `private.encrypt_text`, `private.blind_index` or `private.vault_secret`, or read `vault.decrypted_secrets`, then it is denied.

Uniqueness and search

- [x] Given a plate or DNI already used in a shop, when the same value (in any format) is saved in that shop, then it is rejected; when saved in another shop, then it is accepted.
- [x] Given a client without DNI, when another client without DNI is saved, then it is accepted.
- [x] Given clients and vehicles, when filtering `search_text` with a normalized term ("ae482", "suarez", "35123456", "fiatcronos"), then the expected rows match.

Statuses

- [x] Given a new job, when no status is sent, then it is `pendiente`; `borrador` and `presupuesto_rechazado` are rejected.
- [x] Given an appointment, when set to `completado`, then it is accepted.
- [x] Given a job status change, when it is saved, then `job_status_history` records the old status, new status and the user.

Closed jobs

- [x] Given a job in `entregado` or `cancelado`, when any column other than `enabled` changes (including its status), then it is rejected with `job_closed`; archiving and unarchiving are accepted.
- [x] Given a closed job, when one of its items is inserted, updated or deleted, then it is rejected with `job_closed`.

Kilometers

- [x] Given a vehicle whose previous job has 100.000 km, when a new job has 99.999 km, then it is rejected with `job_kilometers_below_previous`; 100.000 and more are accepted.
- [x] Given that previous job is archived, when a lower km is saved, then it is accepted.
- [x] Given an older job, when its km is edited while a newer job has a higher value, then it is not blocked by the newer job.
- [x] Given a vehicle with no previous km, when any value ≥ 0 is saved, then it is accepted; a negative value is rejected.

Archived records

- [x] Given an archived vehicle, when an appointment or job is created for it, then it is rejected with `vehicle_archived`.
- [x] Given an archived client, when a job is created with it, then it is rejected with `client_archived`; when it stays as a vehicle's owner, then nothing changes.
- [x] Given an archived service, when it is added to a job, then it is rejected with `service_archived`; existing items that use it keep working.

## Out of scope

- Frontend and Vitest tests.
- Performance of decrypting in queries.
- Running the tests against `torque-dev` or any hosted project.
- Testing Supabase Auth itself (sign-in, bans); only the `profile.enabled` effect on RLS is covered.

## Open questions

- None.
