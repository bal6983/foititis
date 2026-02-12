-- Listing view tracking
-- Shows "X people viewed your listing" to owners (no names)

create table if not exists public.listing_views (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_listing_views_listing on public.listing_views(listing_id);

-- Prevent tracking same viewer more than once per hour
create unique index if not exists idx_listing_views_unique_hourly
  on public.listing_views(
    listing_id,
    viewer_id,
    (date_trunc('hour', viewed_at at time zone 'UTC'))
  );

alter table public.listing_views enable row level security;

do $$ begin
  create policy "listing_views_insert_authenticated"
  on public.listing_views for insert
  with check (auth.uid() = viewer_id);
exception when duplicate_object then null;
end $$;

-- Listing owners can see views on their own listings
do $$ begin
  create policy "listing_views_select_own_listings"
  on public.listing_views for select
  using (
    listing_id in (
      select id from public.listings where seller_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

-- Add view_count column to listings
alter table public.listings
  add column if not exists view_count integer not null default 0;

-- Trigger to increment view_count
create or replace function public.increment_listing_view_count()
returns trigger language plpgsql security definer as $$
begin
  update public.listings set view_count = view_count + 1 where id = NEW.listing_id;
  return NEW;
end;
$$;

drop trigger if exists trigger_increment_view_count on public.listing_views;
create trigger trigger_increment_view_count
after insert on public.listing_views
for each row execute function public.increment_listing_view_count();
