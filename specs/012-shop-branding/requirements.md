# 012 — Shop branding: Requirements

**Status:** Approved (by the owner in conversation, 2026-10-28)

## Problem

A shop is only a name in the database. It has no logo, address or phone number, so the app's header shows plain text ("Torque × name") and anything printed for the shop (spec [013](../013-print-job/requirements.md)) can't carry its identity. Each shop should have its logo, address and phone stored, and the header should draw logo + name.

## Users

All roles (`owner`, `receptionist`, `mechanic`) see the branding. The project owner sets it in the Supabase dashboard (creating or editing shops from the UI is out of scope, as today).

## User stories

- As a staff member, I want to see my shop's logo and name in the header, so that the app feels like my shop's.
- As a shop, I want my address and phone available to the app, so that printed sheets carry them.
- As the project owner, I want to set a shop's logo, address and phone in the dashboard, with no code change.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (Logo, Header). Where this spec and the docs disagree, the docs win.

Data

- [ ] Given a shop, then it can have an address and a phone number, both optional text, and a logo, optional, stored as a file in a Supabase Storage bucket and referenced by its path in the shop's row.
- [ ] Given the logo bucket, then it is private and only accepts square images (PNG, JPG or WebP, recommended 512 × 512 px) up to 512 KB, enforced by the bucket's configuration, and a logo lives under a folder named after its shop's id.
- [ ] Given a signed-in user, when reading the logo, then they can read only their own shop's file (Storage policy on the JWT `shop_id` claim plus `is_current_profile_enabled()`), through a short-lived signed URL created on the server with the user's session, and nobody can upload, replace or delete files through the app's API (the owner does it in the dashboard).
- [ ] Given a shop with a phone number, when it is shown, then it uses the app's phone format.

Header

- [ ] Given any page inside the app, when the header shows, then it draws the shop's logo in a 40px rounded square followed by the shop's name in 17px bold, on the left; the user's name and "Cerrar sesión" stay on the right.
- [ ] Given a shop with no logo, or whose logo fails to load, then the header draws the app's logo mark (`LogoMark`, wrench) in the same square, never a broken image.
- [ ] Given the logo, then it is decorative (empty `alt`), since the shop's name is right beside it, and it keeps its proportions without stretching or shifting the layout while it loads.
- [ ] Given a shop with no name available, then the header behaves as it does today.

Isolation and database

- [ ] Given two shops, when a user reads shops, logos, addresses or phones, then they never see the other shop's data or file (RLS and Storage policies, with pgTAP tests).
- [ ] Given the new columns and policies, then `db_schema.sql` and the migration describe them, and no credential, project ref or real shop data is committed (fake fixtures only).

## Out of scope

- Uploading or editing the logo, address or phone from the app.
- Any change to the login page, which stays Torque-branded (the shop is unknown before signing in).
- Several addresses or phones per shop, social links, opening hours.

## Open questions

- None.

## Decisions taken with the owner (2026-10-28)

- Private bucket with a per-shop policy (not "any authenticated user", which would let one shop read another's logos), read through signed URLs. Reason: tenant isolation stays in the database.
- Square logo, standard format left to the agent: PNG, JPG or WebP, 512 × 512 px, up to 512 KB, filling the whole square (`object-cover`, no padding).
