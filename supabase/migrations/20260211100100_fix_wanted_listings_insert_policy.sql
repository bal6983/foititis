-- Fix: wanted_listings INSERT policy only checks auth.uid() is not null,
-- but does NOT verify that the user_id column matches the authenticated user.
-- This allows any authenticated user to create wanted listings impersonating others
-- by sending a crafted API request with a different user_id.

-- Drop the permissive policy
drop policy if exists "wanted_listings_insert_authenticated" on public.wanted_listings;

-- Re-create with proper ownership validation
create policy "wanted_listings_insert_own"
on public.wanted_listings
for insert
with check (auth.uid() = user_id);

-- Also add missing UPDATE policy (own listings only)
create policy "wanted_listings_update_own"
on public.wanted_listings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
