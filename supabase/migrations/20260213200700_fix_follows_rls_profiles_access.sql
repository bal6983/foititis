-- ============================================================
-- FIX: follows INSERT fails silently
--
-- Root cause: The follows INSERT policy sub-selects from
--   profiles to check if the followed user is a pre-student.
--   But profiles RLS only allows users to see their OWN row
--   (profiles_select_own), so the check on the followed user
--   returns NULL → policy evaluates to false → INSERT blocked.
--
-- Fix: SECURITY DEFINER function that bypasses profiles RLS
--   to check if a user can be followed.
-- ============================================================

create or replace function public.can_be_followed(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select not coalesce(is_pre_student, false)
     from profiles
     where id = target_id),
    false
  );
$$;

-- Recreate the follows INSERT policy using the function
drop policy if exists "follows_insert_verified_only" on public.follows;

create policy "follows_insert_verified_only"
on public.follows for insert
with check (
  auth.uid() = follower_id
  and (
    select (p.is_verified_student = true and coalesce(p.is_pre_student, false) = false)
    from public.profiles p
    where p.id = auth.uid()
  )
  and public.can_be_followed(followed_id)
);
