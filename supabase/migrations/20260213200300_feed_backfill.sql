-- ============================================================
-- FEED BACKFILL + UNIQUE CONSTRAINTS
--
-- Problem: Triggers only fire on INSERT. Existing listings and
--   wanted_listings created before the triggers were added have
--   no corresponding activity_posts entries.
--
-- Fix:
--   1. Add unique partial indexes to prevent duplicate feed posts.
--   2. Idempotent backfill of all existing listings / wanted.
-- ============================================================

-- 1. Unique partial indexes (one feed post per source item)
create unique index if not exists idx_activity_posts_unique_listing
  on public.activity_posts(related_listing_id)
  where post_type = 'listing_created'
    and related_listing_id is not null;

create unique index if not exists idx_activity_posts_unique_wanted
  on public.activity_posts(related_wanted_listing_id)
  where post_type = 'wanted_created'
    and related_wanted_listing_id is not null;

-- 2. Backfill listings → activity_posts
insert into public.activity_posts
  (author_id, post_type, related_listing_id, content, created_at)
select
  l.seller_id,
  'listing_created',
  l.id,
  l.title,
  l.created_at
from public.listings l
where not exists (
  select 1
  from public.activity_posts ap
  where ap.related_listing_id = l.id
    and ap.post_type = 'listing_created'
)
on conflict do nothing;

-- 3. Backfill wanted_listings → activity_posts
insert into public.activity_posts
  (author_id, post_type, related_wanted_listing_id, content, created_at)
select
  w.user_id,
  'wanted_created',
  w.id,
  w.title,
  w.created_at
from public.wanted_listings w
where not exists (
  select 1
  from public.activity_posts ap
  where ap.related_wanted_listing_id = w.id
    and ap.post_type = 'wanted_created'
)
on conflict do nothing;
