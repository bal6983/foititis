-- Auto-create feed posts and notifications from platform actions

-- ============================================================
-- 1. Auto-post when a listing is created
-- ============================================================

create or replace function public.auto_create_listing_post()
returns trigger language plpgsql security definer as $$
begin
  insert into public.activity_posts (author_id, post_type, related_listing_id, content)
  values (NEW.seller_id, 'listing_created', NEW.id, NEW.title);
  return NEW;
end;
$$;

drop trigger if exists trigger_auto_post_on_listing on public.listings;
create trigger trigger_auto_post_on_listing
after insert on public.listings
for each row execute function public.auto_create_listing_post();

-- ============================================================
-- 2. Auto-post when a wanted listing is created
-- ============================================================

create or replace function public.auto_create_wanted_post()
returns trigger language plpgsql security definer as $$
begin
  insert into public.activity_posts (author_id, post_type, related_wanted_listing_id, content)
  values (NEW.user_id, 'wanted_created', NEW.id, NEW.title);
  return NEW;
end;
$$;

drop trigger if exists trigger_auto_post_on_wanted on public.wanted_listings;
create trigger trigger_auto_post_on_wanted
after insert on public.wanted_listings
for each row execute function public.auto_create_wanted_post();

-- ============================================================
-- 3. Notify when someone follows you
-- ============================================================

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, actor_id, notification_type)
  values (NEW.followed_id, NEW.follower_id, 'followed');
  return NEW;
end;
$$;

drop trigger if exists trigger_notify_follow on public.follows;
create trigger trigger_notify_follow
after insert on public.follows
for each row execute function public.notify_on_follow();

-- ============================================================
-- 4. Notify post author when someone reacts
-- ============================================================

create or replace function public.notify_on_reaction()
returns trigger language plpgsql security definer as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.activity_posts where id = NEW.post_id;
  if post_author is not null and post_author != NEW.user_id then
    insert into public.notifications (user_id, actor_id, notification_type, related_post_id)
    values (post_author, NEW.user_id, 'reaction', NEW.post_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_notify_reaction on public.feed_reactions;
create trigger trigger_notify_reaction
after insert on public.feed_reactions
for each row execute function public.notify_on_reaction();

-- ============================================================
-- 5. Notify post author when someone comments
-- ============================================================

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.activity_posts where id = NEW.post_id;
  if post_author is not null and post_author != NEW.author_id then
    insert into public.notifications (user_id, actor_id, notification_type, related_post_id)
    values (post_author, NEW.author_id, 'comment', NEW.post_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_notify_comment on public.feed_comments;
create trigger trigger_notify_comment
after insert on public.feed_comments
for each row execute function public.notify_on_comment();
