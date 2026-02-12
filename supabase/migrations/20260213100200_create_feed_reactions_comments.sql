-- Feed reactions (like, etc.) and comments

create table if not exists public.feed_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.activity_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  unique(post_id, user_id, reaction_type)
);

create index if not exists idx_feed_reactions_post on public.feed_reactions(post_id);

alter table public.feed_reactions enable row level security;

do $$ begin
  create policy "feed_reactions_select_authenticated"
  on public.feed_reactions for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "feed_reactions_insert_own"
  on public.feed_reactions for insert
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "feed_reactions_delete_own"
  on public.feed_reactions for delete
  using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- Trigger to maintain reactions_count on activity_posts
create or replace function public.update_reactions_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.activity_posts set reactions_count = reactions_count + 1 where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.activity_posts set reactions_count = greatest(0, reactions_count - 1) where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trigger_update_reactions_count on public.feed_reactions;
create trigger trigger_update_reactions_count
after insert or delete on public.feed_reactions
for each row execute function public.update_reactions_count();

-- ============================================================
-- Feed comments
-- ============================================================

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.activity_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feed_comments_post on public.feed_comments(post_id, created_at);

alter table public.feed_comments enable row level security;

do $$ begin
  create policy "feed_comments_select_authenticated"
  on public.feed_comments for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "feed_comments_insert_own"
  on public.feed_comments for insert
  with check (auth.uid() = author_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "feed_comments_update_own"
  on public.feed_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "feed_comments_delete_own"
  on public.feed_comments for delete
  using (auth.uid() = author_id);
exception when duplicate_object then null;
end $$;

drop trigger if exists set_feed_comments_updated_at on public.feed_comments;
create trigger set_feed_comments_updated_at
before update on public.feed_comments
for each row execute function public.set_updated_at();

-- Trigger to maintain comments_count on activity_posts
create or replace function public.update_comments_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.activity_posts set comments_count = comments_count + 1 where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.activity_posts set comments_count = greatest(0, comments_count - 1) where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trigger_update_comments_count on public.feed_comments;
create trigger trigger_update_comments_count
after insert or delete on public.feed_comments
for each row execute function public.update_comments_count();
