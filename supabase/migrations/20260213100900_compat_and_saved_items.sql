-- Compatibility patch for environments that missed social/chat migrations.
-- Safe to run multiple times.

-- 1) Patch missing columns used by current UI
alter table public.messages
  add column if not exists image_url text;

alter table public.conversation_participants
  add column if not exists last_read_at timestamptz;

alter table public.listings
  add column if not exists view_count integer not null default 0;

alter table public.profiles
  add column if not exists followers_count integer not null default 0;

alter table public.profiles
  add column if not exists following_count integer not null default 0;

alter table public.profiles
  add column if not exists last_seen_at timestamptz default now();

-- 2) Ensure public_profiles view includes social fields
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

-- 3) Saved items table (listing now, event-ready for next iterations)
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('listing', 'wanted', 'event')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, item_type, item_id)
);

create index if not exists idx_saved_items_user
  on public.saved_items(user_id, created_at desc);

create index if not exists idx_saved_items_item
  on public.saved_items(item_type, item_id);

alter table public.saved_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_items'
      and policyname = 'saved_items_select_own'
  ) then
    create policy "saved_items_select_own"
    on public.saved_items for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_items'
      and policyname = 'saved_items_insert_own'
  ) then
    create policy "saved_items_insert_own"
    on public.saved_items for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_items'
      and policyname = 'saved_items_delete_own'
  ) then
    create policy "saved_items_delete_own"
    on public.saved_items for delete
    using (auth.uid() = user_id);
  end if;
end
$$;
