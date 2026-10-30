# 015 — Security hardening: Design

**Status:** Approved
**Requirements:** [requirements.md](requirements.md)

## Summary

Only grants change. No table, policy or app code changes.

## Database

- Migration: `20261030000000_dcl-brand-model-restricted.sql` revokes all privileges on `brand` and `model` from `anon`, and UPDATE and DELETE from `authenticated`. SELECT and INSERT stay for `authenticated`.
- RLS impact: none (these tables have no RLS; grants alone control access).
- Updated: `db_schema.sql` (grants and comments), [architecture.md](../../docs/architecture.md) (table row), CLAUDE.md rule 2 (wording).
- Applied by the project owner in the Supabase dashboard; never by the agent.

## Validation

pgTAP in `supabase/tests/01_tenant_isolation.sql`: `anon` denied on both tables (read and write); a logged-in user reads and inserts but can't update or delete either table.
