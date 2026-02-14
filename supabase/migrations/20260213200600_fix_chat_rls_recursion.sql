-- ============================================================
-- FIX: infinite recursion in conversation_participants RLS
--
-- Problem: Self-referencing RLS policies on conversation_participants
--   cause "infinite recursion detected in policy" (42P17).
--
-- Fix: Use a SECURITY DEFINER function to resolve the current
--   user's conversation IDs without triggering RLS recursion.
--   All chat policies now call this function instead of
--   sub-selecting from conversation_participants directly.
-- ============================================================

-- 1. Helper function: returns conversation IDs for the current user
--    SECURITY DEFINER bypasses RLS, breaking the recursion chain.
create or replace function public.get_my_conversation_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select conversation_id
  from conversation_participants
  where user_id = auth.uid();
$$;

-- ============================================================
-- 2. Drop all broken policies on chat tables
-- ============================================================

drop policy if exists "conversations_select_participant" on public.conversations;
drop policy if exists "conversations_insert_authenticated" on public.conversations;
drop policy if exists "conversations_update_participant" on public.conversations;

drop policy if exists "conv_participants_select_participant" on public.conversation_participants;
drop policy if exists "conv_participants_insert_self" on public.conversation_participants;
drop policy if exists "conv_participants_update_own" on public.conversation_participants;

drop policy if exists "messages_select_participant" on public.messages;
drop policy if exists "messages_insert_participant" on public.messages;
drop policy if exists "messages_update_participant" on public.messages;

drop policy if exists "message_reactions_select_participant" on public.message_reactions;
drop policy if exists "message_reactions_insert_participant" on public.message_reactions;
drop policy if exists "message_reactions_delete_participant" on public.message_reactions;

-- ============================================================
-- 3. Recreate conversations policies
-- ============================================================

create policy "conversations_select_participant"
on public.conversations for select
using (id in (select public.get_my_conversation_ids()));

create policy "conversations_insert_authenticated"
on public.conversations for insert
with check (auth.uid() is not null);

create policy "conversations_update_participant"
on public.conversations for update
using (id in (select public.get_my_conversation_ids()));

-- ============================================================
-- 4. Recreate conversation_participants policies
-- ============================================================

create policy "conv_participants_select_participant"
on public.conversation_participants for select
using (conversation_id in (select public.get_my_conversation_ids()));

create policy "conv_participants_insert_self"
on public.conversation_participants for insert
with check (auth.uid() = user_id);

create policy "conv_participants_update_own"
on public.conversation_participants for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================
-- 5. Recreate messages policies
-- ============================================================

create policy "messages_select_participant"
on public.messages for select
using (conversation_id in (select public.get_my_conversation_ids()));

create policy "messages_insert_participant"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and conversation_id in (select public.get_my_conversation_ids())
);

create policy "messages_update_participant"
on public.messages for update
using (conversation_id in (select public.get_my_conversation_ids()));

-- ============================================================
-- 6. Recreate message_reactions policies
--    These reference messages (which now uses the function),
--    so the chain is: reactions → messages → function (no recursion).
-- ============================================================

create policy "message_reactions_select_participant"
on public.message_reactions for select
using (
  exists (
    select 1 from public.messages m
    where m.id = message_id
  )
);

create policy "message_reactions_insert_participant"
on public.message_reactions for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.messages m
    where m.id = message_id
  )
);

create policy "message_reactions_delete_participant"
on public.message_reactions for delete
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.messages m
    where m.id = message_id
  )
);
