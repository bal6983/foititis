-- Fix: listings table has RLS enabled but only a DELETE policy.
-- Without SELECT/INSERT policies, no authenticated user can read or create listings,
-- making the entire marketplace non-functional.

-- Allow any authenticated user to view listings
create policy "listings_select_authenticated"
on public.listings
for select
using (auth.uid() is not null);

-- Allow authenticated users to create listings only as themselves
create policy "listings_insert_own"
on public.listings
for insert
with check (auth.uid() = seller_id);

-- Allow users to update only their own listings
create policy "listings_update_own"
on public.listings
for update
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);
