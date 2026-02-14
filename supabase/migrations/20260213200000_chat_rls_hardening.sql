-- ============================================================
-- CHAT SCHEMA: FULL RLS HARDENING
-- Enable RLS on conversations, conversation_participants, messages.
-- Create strict SELECT / INSERT / UPDATE policies.
-- Tighten message_reactions to conversation-participant scope.
-- Add performance indexes.
-- ============================================================

-- 1. Enable RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- 2. Drop ALL existing policies on chat tables
--    (Tables were originally created via Supabase Dashboard and may
--     carry overly-permissive default policies.)
do $$
declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'conversation_participants', 'messages')
  ) loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- 3. conversations policies
-- ============================================================

-- SELECT: only participants
create policy "conversations_select_participant"
on public.conversations for select
using (
  id in (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  )
);

-- INSERT: any authenticated user can start a conversation
create policy "conversations_insert_authenticated"
on public.conversations for insert
with check (auth.uid() is not null);

-- UPDATE: only participants (for last_message_at)
create policy "conversations_update_participant"
on public.conversations for update
using (
  id in (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. conversation_participants policies
-- ============================================================

-- SELECT: see participants only in conversations you belong to
create policy "conv_participants_select_participant"
on public.conversation_participants for select
using (
  conversation_id in (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  )
);

-- INSERT: users can only add themselves
create policy "conv_participants_insert_self"
on public.conversation_participants for insert
with check (auth.uid() = user_id);

-- UPDATE: users can update their own row only (last_read_at)
create policy "conv_participants_update_own"
on public.conversation_participants for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================
-- 5. messages policies
-- ============================================================

-- SELECT: only conversation participants
create policy "messages_select_participant"
on public.messages for select
using (
  conversation_id in (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  )
);

-- INSERT: sender must be self AND must be a participant
create policy "messages_insert_participant"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and conversation_id in (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  )
);

-- UPDATE: only conversation participants (for is_seen marking)
create policy "messages_update_participant"
on public.messages for update
using (
  conversation_id in (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  )
);

-- ============================================================
-- 6. Tighten message_reactions to conversation-participant scope
--    (Original policies allowed any authenticated user.)
-- ============================================================

drop policy if exists "message_reactions_select_authenticated" on public.message_reactions;

create policy "message_reactions_select_participant"
on public.message_reactions for select
using (
  exists (
    select 1 from public.messages m
    where m.id = message_id
  )
);

drop policy if exists "message_reactions_insert_own" on public.message_reactions;

create policy "message_reactions_insert_participant"
on public.message_reactions for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.messages m
    where m.id = message_id
  )
);

drop policy if exists "message_reactions_delete_own" on public.message_reactions;

create policy "message_reactions_delete_participant"
on public.message_reactions for delete
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.messages m
    where m.id = message_id
  )
);

-- ============================================================
-- 7. Helper: atomically create a 1:1 conversation
--    SECURITY DEFINER so it can add both participants.
--    Returns existing conversation if one already exists.
-- ============================================================

create or replace function public.start_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  existing_conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() = other_user_id then
    raise exception 'Cannot start conversation with yourself';
  end if;

  -- Check for existing 1:1 conversation between these two users
  select cp1.conversation_id into existing_conv_id
  from conversation_participants cp1
  join conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  where cp1.user_id = auth.uid()
    and cp2.user_id = other_user_id;

  if existing_conv_id is not null then
    return existing_conv_id;
  end if;

  -- Create new conversation
  insert into conversations default values
  returning id into conv_id;

  -- Add both participants
  insert into conversation_participants (conversation_id, user_id)
  values
    (conv_id, auth.uid()),
    (conv_id, other_user_id);

  return conv_id;
end;
$$;

-- ============================================================
-- 8. Performance indexes for chat
-- ============================================================

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at desc);

create index if not exists idx_conv_participants_user_conv
  on public.conversation_participants(user_id, conversation_id);

create index if not exists idx_message_reactions_message
  on public.message_reactions(message_id);
