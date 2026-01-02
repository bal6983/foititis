create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  price text not null,
  category text not null,
  condition text not null,
  location text not null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;
