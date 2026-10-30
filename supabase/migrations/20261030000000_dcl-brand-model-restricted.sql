-- =============================================================================
-- DCL — brand and model stop being public and stop being editable by users.
-- They were readable by anon and writable (insert, update, delete) by any
-- logged-in user of any shop, so one shop could rename or delete entries every
-- other shop uses. Now only logged-in users read them, and the only ways to
-- change them are INSERT (kept) and the dashboard or a migration. The app
-- never updates or deletes them.
-- =============================================================================

revoke all on public.brand, public.model from anon;
revoke update, delete on public.brand, public.model from authenticated;
