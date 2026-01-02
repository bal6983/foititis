create table if not exists public.wanted_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  location text not null,
  created_at timestamptz not null default now()
);

alter table public.wanted_listings enable row level security;

create policy "wanted_listings_select_authenticated"
on public.wanted_listings
for select
using (auth.uid() is not null);

create policy "wanted_listings_insert_authenticated"
on public.wanted_listings
for insert
with check (auth.uid() is not null);

create policy "wanted_listings_delete_own"
on public.wanted_listings
for delete
using (auth.uid() = user_id);
