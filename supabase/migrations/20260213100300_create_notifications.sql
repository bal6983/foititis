-- Notifications system

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null,
  -- types: 'followed', 'listing_viewed', 'message', 'reaction', 'comment', 'new_listing'
  related_listing_id uuid references public.listings(id) on delete set null,
  related_post_id uuid references public.activity_posts(id) on delete set null,
  content text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(user_id) where read = false;

alter table public.notifications enable row level security;

do $$ begin
  create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "notifications_insert_authenticated"
  on public.notifications for insert
  with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
