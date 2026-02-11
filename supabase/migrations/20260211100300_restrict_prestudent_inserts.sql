-- Fix: Pre-students must NOT be able to create marketplace listings or
-- wanted listings. Only non-pre-student (verified/regular) users can INSERT.
--
-- The check queries the profiles table to verify is_pre_student = false
-- for the authenticated user before allowing the INSERT.

-- ============================================================
-- 1. listings: replace INSERT policy
-- ============================================================

drop policy if exists "listings_insert_own" on public.listings;

create policy "listings_insert_verified_only"
on public.listings
for insert
with check (
  auth.uid() = seller_id
  and (
    select (coalesce(p.is_pre_student, false) = false)
    from public.profiles p
    where p.id = auth.uid()
  )
);

-- ============================================================
-- 2. wanted_listings: replace INSERT policy
-- ============================================================

drop policy if exists "wanted_listings_insert_own" on public.wanted_listings;
drop policy if exists "wanted_listings_insert_authenticated" on public.wanted_listings;

create policy "wanted_listings_insert_verified_only"
on public.wanted_listings
for insert
with check (
  auth.uid() = user_id
  and (
    select (coalesce(p.is_pre_student, false) = false)
    from public.profiles p
    where p.id = auth.uid()
  )
);
