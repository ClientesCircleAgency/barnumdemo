-- Profile photo uploads for doctors and secretaries.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile photos are publicly readable'
  ) then
    create policy "Profile photos are publicly readable"
      on storage.objects
      for select
      using (bucket_id = 'profile-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload own profile photos'
  ) then
    create policy "Users can upload own profile photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'profile-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own profile photos'
  ) then
    create policy "Users can update own profile photos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'profile-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'profile-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete own profile photos'
  ) then
    create policy "Users can delete own profile photos"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'profile-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins can manage profile photos'
  ) then
    create policy "Admins can manage profile photos"
      on storage.objects
      for all
      to authenticated
      using (
        bucket_id = 'profile-photos'
        and public.has_role(auth.uid(), 'admin')
      )
      with check (
        bucket_id = 'profile-photos'
        and public.has_role(auth.uid(), 'admin')
      );
  end if;
end $$;
