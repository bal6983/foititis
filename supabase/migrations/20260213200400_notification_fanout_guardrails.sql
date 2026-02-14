-- ============================================================
-- NOTIFICATION FAN-OUT GUARDRAILS
--
-- Problems:
--   1. University-wide fan-out can create duplicate rows.
--   2. High-frequency triggers (listing_viewed, message) have
--      no rate limiting.
--
-- Fixes:
--   1. Add source_id column + unique index for hard dedup.
--   2. Rewrite trigger functions with ON CONFLICT DO NOTHING
--      for dedup-eligible types.
--   3. Add rate-limit guards for high-frequency types.
--   4. Provide a SECURITY DEFINER helper for programmatic inserts.
-- ============================================================

-- 1. Add source_id column
alter table public.notifications
  add column if not exists source_id uuid;

-- 2. Backfill source_id from existing data
--    Only for notification types that use hard dedup.
update public.notifications
set source_id = coalesce(related_listing_id, related_post_id, actor_id)
where source_id is null
  and notification_type in ('followed', 'reaction', 'comment', 'new_listing')
  and coalesce(related_listing_id, related_post_id, actor_id) is not null;

-- 3. Unique constraint for dedup (only applies when source_id is set)
create unique index if not exists idx_notifications_dedup
  on public.notifications(user_id, notification_type, source_id)
  where source_id is not null;

-- ============================================================
-- 4. Rewrite trigger functions
--    All functions are SECURITY DEFINER + search_path = public
--    to prevent search-path injection and bypass RLS.
-- ============================================================

-- 4a. notify_on_follow  (hard dedup: source_id = follower)
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, actor_id, notification_type, source_id)
  values (NEW.followed_id, NEW.follower_id, 'followed', NEW.follower_id)
  on conflict (user_id, notification_type, source_id)
    where source_id is not null
  do nothing;
  return NEW;
end;
$$;

-- 4b. notify_on_reaction  (hard dedup: source_id = post_id)
create or replace function public.notify_on_reaction()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  post_author uuid;
begin
  select author_id into post_author
  from activity_posts where id = NEW.post_id;

  if post_author is not null and post_author != NEW.user_id then
    insert into notifications
      (user_id, actor_id, notification_type, related_post_id, source_id)
    values
      (post_author, NEW.user_id, 'reaction', NEW.post_id, NEW.post_id)
    on conflict (user_id, notification_type, source_id)
      where source_id is not null
    do nothing;
  end if;
  return NEW;
end;
$$;

-- 4c. notify_on_comment  (hard dedup: source_id = post_id)
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  post_author uuid;
begin
  select author_id into post_author
  from activity_posts where id = NEW.post_id;

  if post_author is not null and post_author != NEW.author_id then
    insert into notifications
      (user_id, actor_id, notification_type, related_post_id, source_id)
    values
      (post_author, NEW.author_id, 'comment', NEW.post_id, NEW.post_id)
    on conflict (user_id, notification_type, source_id)
      where source_id is not null
    do nothing;
  end if;
  return NEW;
end;
$$;

-- 4d. notify_on_listing_view  (rate-limited, no hard dedup)
--     source_id deliberately left NULL so the unique index does not apply.
--     Instead, a 30-minute rate limit prevents notification spam.
create or replace function public.notify_on_listing_view()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  recent_exists boolean;
begin
  select seller_id into listing_owner
  from listings where id = NEW.listing_id;

  if listing_owner is null or listing_owner = NEW.viewer_id then
    return NEW;
  end if;

  -- Rate limit: skip if same listing-viewed notification within 30 min
  select exists(
    select 1 from notifications
    where user_id = listing_owner
      and notification_type = 'listing_viewed'
      and related_listing_id = NEW.listing_id
      and created_at > now() - interval '30 minutes'
  ) into recent_exists;

  if not recent_exists then
    insert into notifications
      (user_id, notification_type, related_listing_id, content)
    values
      (listing_owner, 'listing_viewed', NEW.listing_id,
       'Your listing got a new view');
  end if;

  return NEW;
end;
$$;

-- 4e. notify_on_message  (rate-limited per sender, no hard dedup)
--     Prevents notification flood during rapid-fire messaging.
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, actor_id, notification_type, content)
  select
    cp.user_id,
    NEW.sender_id,
    'message',
    coalesce(nullif(NEW.content, ''), 'New message')
  from conversation_participants cp
  where cp.conversation_id = NEW.conversation_id
    and cp.user_id <> NEW.sender_id
    -- Rate limit: skip if unread message notification from same sender
    -- exists within the last 5 minutes
    and not exists (
      select 1 from notifications n
      where n.user_id = cp.user_id
        and n.notification_type = 'message'
        and n.actor_id = NEW.sender_id
        and n.read = false
        and n.created_at > now() - interval '5 minutes'
    );

  return NEW;
end;
$$;

-- 4f. notify_university_on_new_listing  (hard dedup: source_id = listing_id)
--     Safe bulk insert with ON CONFLICT DO NOTHING.
create or replace function public.notify_university_on_new_listing()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  seller_university_id uuid;
begin
  select university_id into seller_university_id
  from profiles where id = NEW.seller_id;

  if seller_university_id is null then
    return NEW;
  end if;

  insert into notifications
    (user_id, actor_id, notification_type, related_listing_id, content, source_id)
  select
    p.id,
    NEW.seller_id,
    'new_listing',
    NEW.id,
    NEW.title,
    NEW.id
  from profiles p
  where p.university_id = seller_university_id
    and p.id <> NEW.seller_id
  on conflict (user_id, notification_type, source_id)
    where source_id is not null
  do nothing;

  return NEW;
end;
$$;

-- ============================================================
-- 5. SECURITY DEFINER helper for programmatic notification inserts
--    Call from Edge Functions or manual admin operations.
-- ============================================================

create or replace function public.create_system_notification(
  p_user_id uuid,
  p_actor_id uuid default null,
  p_notification_type text default 'system',
  p_related_listing_id uuid default null,
  p_related_post_id uuid default null,
  p_content text default null,
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_id uuid;
begin
  insert into notifications
    (user_id, actor_id, notification_type,
     related_listing_id, related_post_id, content, source_id)
  values
    (p_user_id, p_actor_id, p_notification_type,
     p_related_listing_id, p_related_post_id, p_content, p_source_id)
  on conflict (user_id, notification_type, source_id)
    where source_id is not null
  do nothing
  returning id into notif_id;

  return notif_id;
end;
$$;
