-- ============================================================
-- PERFORMANCE INDEXES – ALL HOT PATHS
--
-- Audit of chat, feed, notifications, follows, listings,
-- wanted_listings, saved_items, profiles.
-- Only adds indexes that don't already exist.
-- ============================================================

-- ======================== CHAT ========================
-- (idx_messages_conversation_created, idx_conv_participants_user_conv,
--  idx_message_reactions_message already created in chat RLS migration)

-- Conversation list sorted by last activity
create index if not exists idx_conversations_last_message_at
  on public.conversations(last_message_at desc nulls last);

-- Sender lookup for "messages from user X"
create index if not exists idx_messages_sender
  on public.messages(sender_id);

-- ======================== FEED ========================
-- (idx_activity_posts_author, idx_activity_posts_created,
--  idx_activity_posts_type already exist)

-- Composite: user's posts sorted by time (profile page)
create index if not exists idx_activity_posts_author_created
  on public.activity_posts(author_id, created_at desc);

-- Feed reactions: "has this user reacted?" lookups
create index if not exists idx_feed_reactions_user
  on public.feed_reactions(user_id);

-- Feed comments: author lookup
create index if not exists idx_feed_comments_author
  on public.feed_comments(author_id);

-- ======================== NOTIFICATIONS ========================
-- (idx_notifications_user_created, idx_notifications_unread already exist)

-- Source-based lookup for dedup checks inside triggers
create index if not exists idx_notifications_source
  on public.notifications(source_id)
  where source_id is not null;

-- Actor-based lookup for rate-limit checks (message notifications)
create index if not exists idx_notifications_actor_type
  on public.notifications(user_id, notification_type, actor_id)
  where actor_id is not null;

-- ======================== LISTINGS ========================

-- Seller's own listings
create index if not exists idx_listings_seller
  on public.listings(seller_id);

-- Category + time for filtered marketplace browsing
create index if not exists idx_listings_category_created
  on public.listings(category, created_at desc);

-- Location + time for location-based browsing
create index if not exists idx_listings_location_created
  on public.listings(location, created_at desc);

-- ======================== WANTED LISTINGS ========================

-- User's own wanted posts
create index if not exists idx_wanted_listings_user
  on public.wanted_listings(user_id);

-- Category browsing
create index if not exists idx_wanted_listings_category_created
  on public.wanted_listings(category, created_at desc);

-- ======================== LISTING VIEWS ========================

-- Viewer lookup (for "listings you've viewed" feature)
create index if not exists idx_listing_views_viewer
  on public.listing_views(viewer_id);

-- ======================== PROFILES ========================

-- University-based queries (fan-out, student directory)
create index if not exists idx_profiles_university
  on public.profiles(university_id)
  where university_id is not null;

-- School-based queries
create index if not exists idx_profiles_school
  on public.profiles(school_id)
  where school_id is not null;
