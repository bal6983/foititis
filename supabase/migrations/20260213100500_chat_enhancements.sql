-- Chat enhancements: ensure tables exist + add new columns
-- The chat tables were created via Supabase Dashboard, not migrations.
-- This ensures they exist for fresh deployments and adds new features.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  created_at timestamptz not null default now()
);

-- New columns for chat upgrades
alter table public.messages
  add column if not exists image_url text;

alter table public.messages
  add column if not exists is_seen boolean not null default false;

-- Online status tracking on profiles
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Message reactions
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  unique(message_id, user_id, reaction_type)
);

alter table public.message_reactions enable row level security;

do $$ begin
  create policy "message_reactions_select_authenticated"
  on public.message_reactions for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "message_reactions_insert_own"
  on public.message_reactions for insert
  with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "message_reactions_delete_own"
  on public.message_reactions for delete
  using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
