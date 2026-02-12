-- Additional notification triggers for social-first UX
-- 1) listing_viewed
-- 2) message
-- 3) new_listing (same university)

-- ============================================================
-- 1. Notify listing owner when listing gets viewed
-- ============================================================

create or replace function public.notify_on_listing_view()
returns trigger language plpgsql security definer as $$
declare
  listing_owner uuid;
begin
  select seller_id into listing_owner
  from public.listings
  where id = NEW.listing_id;

  if listing_owner is not null and listing_owner != NEW.viewer_id then
    insert into public.notifications (
      user_id,
      actor_id,
      notification_type,
      related_listing_id,
      content
    )
    values (
      listing_owner,
      null,
      'listing_viewed',
      NEW.listing_id,
      'Your listing got a new view'
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_notify_listing_view on public.listing_views;
create trigger trigger_notify_listing_view
after insert on public.listing_views
for each row execute function public.notify_on_listing_view();

-- ============================================================
-- 2. Notify participants when they receive a new message
-- ============================================================

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, actor_id, notification_type, content)
  select
    cp.user_id,
    NEW.sender_id,
    'message',
    coalesce(nullif(NEW.content, ''), 'New message')
  from public.conversation_participants cp
  where cp.conversation_id = NEW.conversation_id
    and cp.user_id <> NEW.sender_id;

  return NEW;
end;
$$;

drop trigger if exists trigger_notify_message on public.messages;
create trigger trigger_notify_message
after insert on public.messages
for each row execute function public.notify_on_message();

-- ============================================================
-- 3. Notify same-university users for new listing
-- ============================================================

create or replace function public.notify_university_on_new_listing()
returns trigger language plpgsql security definer as $$
declare
  seller_university_id uuid;
begin
  select university_id into seller_university_id
  from public.profiles
  where id = NEW.seller_id;

  if seller_university_id is null then
    return NEW;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    notification_type,
    related_listing_id,
    content
  )
  select
    p.id,
    NEW.seller_id,
    'new_listing',
    NEW.id,
    NEW.title
  from public.profiles p
  where p.university_id = seller_university_id
    and p.id <> NEW.seller_id;

  return NEW;
end;
$$;

drop trigger if exists trigger_notify_university_new_listing on public.listings;
create trigger trigger_notify_university_new_listing
after insert on public.listings
for each row execute function public.notify_university_on_new_listing();
