-- Enforce mutually exclusive profile states:
-- a user cannot be both pre-student and verified student.

update public.profiles
set is_pre_student = false
where is_pre_student = true
  and is_verified_student = true;

alter table public.profiles
drop constraint if exists profiles_student_status_exclusive;

alter table public.profiles
add constraint profiles_student_status_exclusive
check (not (is_pre_student and is_verified_student));

