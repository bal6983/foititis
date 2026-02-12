-- Activity posts / feed system
-- Auto-generated from platform actions or manual posts

create table if not exists public.activity_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  post_type text not null default 'general',
  -- post_type: 'listing_created', 'wanted_created', 'general', 'badge_earned'
  related_listing_id uuid references public.listings(id) on delete set null,
  related_wanted_listing_id uuid references public.wanted_listings(id) on delete set null,
  visibility text not null default 'public',
  -- visibility: 'public', 'university', 'followers'
  reactions_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activity_posts_author on public.activity_posts(author_id);
create index if not exists idx_activity_posts_created on public.activity_posts(created_at desc);
create index if not exists idx_activity_posts_type on public.activity_posts(post_type);

alter table public.activity_posts enable row level security;

do $$ begin
  create policy "activity_posts_select_authenticated"
  on public.activity_posts for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "activity_posts_insert_own"
  on public.activity_posts for insert
  with check (auth.uid() = author_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "activity_posts_update_own"
  on public.activity_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "activity_posts_delete_own"
  on public.activity_posts for delete
  using (auth.uid() = author_id);
exception when duplicate_object then null;
end $$;

-- Reuse existing set_updated_at trigger function
drop trigger if exists set_activity_posts_updated_at on public.activity_posts;
create trigger set_activity_posts_updated_at
before update on public.activity_posts
for each row execute function public.set_updated_at();
