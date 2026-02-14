-- ============================================================
-- NOTIFICATIONS: INSERT POLICY HARDENING
--
-- Problem: "notifications_insert_authenticated" allows any
--   authenticated user to insert notifications for ANY user_id.
--
-- Fix: Drop the permissive policy. Replace with self-only.
--   All cross-user notifications are inserted by SECURITY DEFINER
--   triggers which bypass RLS entirely.
-- ============================================================

-- Drop the overly permissive INSERT policy
drop policy if exists "notifications_insert_authenticated" on public.notifications;

-- Users can only insert notifications targeting themselves.
-- All system / cross-user notifications flow through SECURITY DEFINER
-- trigger functions (notify_on_follow, notify_on_reaction, etc.).
do $$ begin
  create policy "notifications_insert_self_only"
  on public.notifications for insert
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
