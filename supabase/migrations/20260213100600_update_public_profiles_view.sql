-- Update public_profiles view with new social columns

drop view if exists public.public_profiles cascade;

create view public.public_profiles as
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

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;
