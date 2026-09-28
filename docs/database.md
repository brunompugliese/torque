# Torque — Database

How to change the database. The model itself is described in [db_schema.sql](../db_schema.sql), and the access model in [architecture.md](architecture.md).

## Two files, two roles

| File | Role |
|---|---|
| `supabase/migrations/*.sql` | **Source of truth.** What is actually deployed. Executed in order by `db push`. |
| `db_schema.sql` | **Description.** The full current schema in one readable file, with comments explaining business decisions. Never executed. |

Every change touches both, in the same PR.

## Workflow for a database change

1. The change is described in an approved spec (`specs/`).
2. Create the migration(s): `npx supabase migration new <type>[-<subject>]`.
3. Update `db_schema.sql` so it reflects the new state, including a comment for any non-obvious decision.
4. Add or update pgTAP tests in `supabase/tests/` for any change to tables, policies, grants or triggers.
5. Open a PR. Tests run in GitHub Actions.
6. The project owner applies the migration to `torque-dev` with `npx supabase db push`. Agents never apply migrations.

## Migration rules

- **Never edit an applied migration.** Fix or undo it with a new one.
- **Naming:** `<timestamp>_<type>[-<subject>].sql`
  - `ddl`: tables, indexes, functions, triggers, RLS policies.
  - `dcl`: grants and revokes.
  - `data-insert-<table>-<nnn>`: reference data (e.g. `brand`, `model`).
- **One concern per file.** A change that needs both structure and grants gets a `ddl-` and a `dcl-` file with the same subject.
- **Re-runnable where possible:** `create or replace` for functions and triggers, `drop policy if exists` before `create policy`.
- **Every file starts with a header comment** saying what it does and why.

## Schema conventions

| Item | Convention |
|---|---|
| Tables, columns | Singular, `snake_case` (`job_item`, `phone_number`) |
| Primary key | `id uuid primary key default gen_random_uuid()` |
| Foreign keys | `<table>_id`; composite `(x_id, shop_id)` when the parent is a tenant table |
| Timestamps | `created_at timestamptz not null default now()`; `updated_at` plus a `set_updated_at` trigger on mutable tables |
| Removing records | Prefer `enabled = false` over deleting, so history stays intact |
| Status values | Spanish, `snake_case`, enforced with a `check` constraint (e.g. `en_progreso`) |
| Money | `numeric` |
| Indexes | `idx_<table>_<columns>` |
| Triggers | `trg_<table>_<purpose>` |
| Policies | `tenant_isolation` (all operations) or `tenant_isolation_<operation>` |

## New tenant table checklist

- [ ] `shop_id uuid not null references shop(id)`
- [ ] `unique (id, shop_id)` if other tables will reference it
- [ ] Composite FKs `(parent_id, shop_id)` to every tenant parent
- [ ] Index on `shop_id` and on each foreign key
- [ ] `alter table … enable row level security`
- [ ] Policy with both `using` and `with check`: `shop_id = ((select auth.jwt()) ->> 'shop_id')::uuid and public.is_current_profile_enabled()`
- [ ] Explicit grants to `authenticated`; `revoke all … from anon`; revoke `truncate, references, trigger, maintain` from `authenticated`
- [ ] `updated_at` trigger if the table is mutable
- [ ] pgTAP tests (see below)
- [ ] `db_schema.sql` updated

Tables without their own `shop_id` (like `job_status_history`) must reach the shop through their parent in the policy.

## Functions

- Always `set search_path = ''` and schema-qualify every object (`public.job`, `auth.uid()`).
- Use `security definer` only when the function must bypass RLS, and say why in a comment.
- `revoke execute … from public, anon` and grant only to the roles that need it.

## RLS tests

Tests live in `supabase/tests/` and use [pgTAP](https://pgtap.org/). They run in GitHub Actions against a temporary database built from the migrations, never against a hosted project.

Each test runs in a transaction that is rolled back, creates its own shops, users and profiles, and simulates a logged-in user:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub": "<user-uuid>", "shop_id": "<shop-uuid>"}';
```

Every tenant table must be tested for:

- A user sees only rows of their own shop.
- A user cannot insert or update a row with another shop's `shop_id`.
- A user cannot reference another shop's rows through foreign keys.
- A disabled profile sees nothing.
- `anon` sees nothing.

Read-only tables (`shop`, `profile`, `job_status_history`) must also be tested to reject insert, update and delete.

## Generated types

The frontend's database types are generated from the linked project, never written by hand:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Regenerate after every applied migration and commit the result.
