-- =============================================================================
-- DDL — odometer reading on job.
-- Recorded per job rather than on vehicle so the vehicle's mileage history is
-- kept; the vehicle's current reading is its latest job's value. Nullable
-- because it isn't always known.
-- =============================================================================

alter table job add column if not exists kilometers integer check (kilometers >= 0);
