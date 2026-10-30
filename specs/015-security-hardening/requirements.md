# 015 — Security hardening: Requirements

**Status:** Approved (requested by the project owner, 2026-10-30)

## Problem

`brand` and `model` are global tables shared by every shop. They were readable by `anon` (anyone with the public key) and insertable, updatable and deletable by any logged-in user, so one shop, or a stolen account, could rename or delete entries the other shops use.

## Users

The project owner (applies the migration) and every shop (their catalog must stay intact).

## Acceptance criteria

- [ ] Given no session (`anon`), when reading, inserting, updating or deleting `brand` or `model`, then every operation is denied.
- [ ] Given a logged-in user, when reading `brand` or `model`, then they see the catalog (the vehicle form keeps working).
- [ ] Given a logged-in user, when updating or deleting a `brand` or `model` row, then it fails with "permission denied".
- [ ] Given the app, when searched, then it never updates or deletes `brand` or `model` (it only reads them).

## Out of scope

Rate limiting, CAPTCHA and a full CSP (later specs). Revoking INSERT too: the app doesn't use it, but removing it is a separate decision.
