-- Fix: The codebase references several tables and profile columns that were
-- created via the Supabase Dashboard but never tracked in migrations.
-- If the database is ever reset or re-deployed from migrations, all of these
-- would be missing, breaking the entire application.
--
-- Every statement uses IF NOT EXISTS / IF EXISTS guards so the migration is
-- safe to run against a database where some or all of these objects already
-- exist (e.g. created via the Supabase Dashboard).

-- ============================================================
-- 1. Lookup tables (cities, universities, schools, categories, locations)
-- ============================================================

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;

do $$ begin
  create policy "cities_select_authenticated"
  on public.cities for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ---

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city_id uuid references public.cities(id) on delete cascade,
  email_domains text[] default '{}',
  created_at timestamptz not null default now()
);

alter table public.universities enable row level security;

do $$ begin
  create policy "universities_select_authenticated"
  on public.universities for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ---

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  university_id uuid references public.universities(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.schools enable row level security;

do $$ begin
  create policy "schools_select_authenticated"
  on public.schools for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ---

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

do $$ begin
  create policy "categories_select_authenticated"
  on public.categories for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ---

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.locations enable row level security;

do $$ begin
  create policy "locations_select_authenticated"
  on public.locations for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 2. Missing columns on profiles
-- ============================================================

alter table public.profiles
  add column if not exists is_pre_student boolean not null default false;

alter table public.profiles
  add column if not exists university_email text;

alter table public.profiles
  add column if not exists city_id uuid references public.cities(id) on delete set null;

alter table public.profiles
  add column if not exists university_id uuid references public.universities(id) on delete set null;

alter table public.profiles
  add column if not exists school_id uuid references public.schools(id) on delete set null;

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists verification_status text;

-- ============================================================
-- 3. Missing columns on listings (category_id, location_id, condition_rating)
--    Referenced in MarketplaceCreate.tsx and Marketplace.tsx queries
-- ============================================================

alter table public.listings
  add column if not exists category_id uuid references public.categories(id) on delete set null;

alter table public.listings
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.listings
  add column if not exists condition_rating smallint;

-- ============================================================
-- 4. Missing columns on wanted_listings (category_id, location_id, condition_rating)
--    Referenced in WantedCreate.tsx and Wanted.tsx queries
-- ============================================================

alter table public.wanted_listings
  add column if not exists category_id uuid references public.categories(id) on delete set null;

alter table public.wanted_listings
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.wanted_listings
  add column if not exists condition_rating smallint;

-- ============================================================
-- 5. Public profiles view (used by Students.tsx, PublicProfile.tsx, ChatThread.tsx)
--    Allows any authenticated user to see other users' non-sensitive profile data.
--
--    DROP first because CREATE OR REPLACE VIEW cannot rename or reorder
--    columns on an existing view (PostgreSQL raises:
--    "cannot change name of view column X to Y").
-- ============================================================

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
  is_verified_student
from public.profiles;

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;
