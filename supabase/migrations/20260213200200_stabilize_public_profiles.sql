-- ============================================================
-- STABILIZE public_profiles VIEW
--
-- Problem: Previous migrations use DROP VIEW ... CASCADE which
--   destroys dependent objects and creates drift risk.
--
-- Fix: Use CREATE OR REPLACE VIEW (no DROP, no CASCADE).
--   Column list matches the current view exactly so
--   CREATE OR REPLACE succeeds without recreation.
-- ============================================================

create or replace view public.public_profiles as
select
  id,
  display_name,
  study_year,
  avatar_url,
  school_id,
  university_id,
  city_id,
  is_pre_student,
  is_verified_student,
  followers_count,
  following_count,
  last_seen_at
from public.profiles;

-- Ensure grants are in place (idempotent)
grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;
