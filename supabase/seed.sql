-- Local development seed data.
-- Run with: supabase db reset (or supabase db seed)
-- Intended for local use only.

-- Verified user credentials:
-- email: verified@example.com
-- password: password123

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'verified@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  now()
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at,
  last_sign_in_at = excluded.last_sign_in_at;

insert into auth.identities (
  id,
  user_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'email',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"verified@example.com"}'::jsonb,
  now(),
  now(),
  now()
)
on conflict (id) do update set
  identity_data = excluded.identity_data,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = excluded.updated_at;

insert into public.profiles (
  id,
  display_name,
  onboarding_completed,
  is_verified_student
) values (
  '11111111-1111-1111-1111-111111111111',
  'Verified Student',
  true,
  true
)
on conflict (id) do update set
  display_name = excluded.display_name,
  onboarding_completed = excluded.onboarding_completed,
  is_verified_student = excluded.is_verified_student;

insert into public.listings (
  id,
  title,
  description,
  price,
  category,
  condition,
  location,
  seller_id,
  created_at
) values
  (
    '22222222-2222-2222-2222-222222222222',
    'Used Economics Book',
    'Intro to Economics, light notes in pencil.',
    '25 EUR',
    'Books',
    'Good',
    'Athens',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '2 days'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Desk Lamp',
    'LED lamp with adjustable arm.',
    '15 EUR',
    'Home',
    'Very good',
    'Thessaloniki',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '1 day'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Scientific Calculator',
    'Casio model, includes cover.',
    '20 EUR',
    'Electronics',
    'Like new',
    'Patras',
    '11111111-1111-1111-1111-111111111111',
    now()
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  price = excluded.price,
  category = excluded.category,
  condition = excluded.condition,
  location = excluded.location,
  seller_id = excluded.seller_id,
  created_at = excluded.created_at;
