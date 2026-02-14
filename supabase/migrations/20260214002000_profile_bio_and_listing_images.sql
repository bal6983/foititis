-- Profile bio + listing image gallery support.
-- - Adds profiles.bio (short optional text)
-- - Adds listings.image_urls (multi-image support)
-- - Updates public_profiles view to expose bio
-- - Creates storage bucket/policies for listing images

alter table public.profiles
  add column if not exists bio text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_bio_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_bio_length_check
      check (char_length(coalesce(bio, '')) <= 280);
  end if;
end $$;

alter table public.listings
  add column if not exists image_url text;

alter table public.listings
  add column if not exists image_urls text[] not null default '{}';

update public.listings
set image_urls = case
  when coalesce(image_url, '') = '' then '{}'
  else array[image_url]
end
where image_urls = '{}'::text[];

create or replace view public.public_profiles as
select
  id,
  display_name,
  study_year,
  avatar_url,
  school_id,
  university_id,
  city_id,
  is_pre_student,
  is_verified_student,
  followers_count,
  following_count,
  last_seen_at,
  department_id,
  bio
from public.profiles;

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
  values (
    'listing-images',
    'listing-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
  set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listing_images_select_public'
  ) then
    create policy "listing_images_select_public"
      on storage.objects for select
      using (bucket_id = 'listing-images');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listing_images_insert_own_folder'
  ) then
    create policy "listing_images_insert_own_folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'listing-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listing_images_update_own_folder'
  ) then
    create policy "listing_images_update_own_folder"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'listing-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'listing-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listing_images_delete_own_folder'
  ) then
    create policy "listing_images_delete_own_folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'listing-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
