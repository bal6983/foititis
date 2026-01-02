alter table public.listings enable row level security;

create policy "listings_delete_own"
on public.listings
for delete
using (auth.uid() = seller_id);
