-- Avatar storage hardening.
-- Ensures `avatars` bucket exists and each user can manage only files in:
--   {auth.uid()}/...

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
    'avatars',
    'avatars',
    true,
    2097152,
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
      and policyname = 'avatars_select_public'
  ) then
    create policy "avatars_select_public"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_insert_own_folder'
  ) then
    create policy "avatars_insert_own_folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_update_own_folder'
  ) then
    create policy "avatars_update_own_folder"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_delete_own_folder'
  ) then
    create policy "avatars_delete_own_folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

