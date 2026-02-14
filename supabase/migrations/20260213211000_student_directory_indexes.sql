-- ============================================================
-- STUDENT DIRECTORY INDEXES
--
-- Ensures fast server-side filtering for:
-- university_id, school_id, city_id
-- ============================================================

create index if not exists idx_profiles_university
  on public.profiles(university_id)
  where university_id is not null;

create index if not exists idx_profiles_school
  on public.profiles(school_id)
  where school_id is not null;

create index if not exists idx_profiles_city
  on public.profiles(city_id)
  where city_id is not null;
