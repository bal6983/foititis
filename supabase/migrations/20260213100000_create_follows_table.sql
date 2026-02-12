-- Follow system: verified students can follow each other
-- Pre-students cannot follow or be followed

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self_follow check (follower_id != followed_id)
);

create index if not exists idx_follows_follower on public.follows(follower_id);
create index if not exists idx_follows_followed on public.follows(followed_id);

alter table public.follows enable row level security;

do $$ begin
  create policy "follows_select_authenticated"
  on public.follows for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "follows_insert_verified_only"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and (
      select (p.is_verified_student = true and coalesce(p.is_pre_student, false) = false)
      from public.profiles p where p.id = auth.uid()
    )
    and (
      select (coalesce(p.is_pre_student, false) = false)
      from public.profiles p where p.id = followed_id
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "follows_delete_own"
  on public.follows for delete
  using (auth.uid() = follower_id);
exception when duplicate_object then null;
end $$;

-- Add follow count columns to profiles
alter table public.profiles
  add column if not exists followers_count integer not null default 0;
alter table public.profiles
  add column if not exists following_count integer not null default 0;

-- Trigger to maintain follow counts
create or replace function public.update_follow_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = NEW.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = NEW.followed_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = OLD.follower_id;
    update public.profiles set followers_count = greatest(0, followers_count - 1) where id = OLD.followed_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trigger_update_follow_counts on public.follows;
create trigger trigger_update_follow_counts
after insert or delete on public.follows
for each row execute function public.update_follow_counts();
