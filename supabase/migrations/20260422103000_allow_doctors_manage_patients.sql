do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'patients'
      and policyname = 'Doctor can insert patients'
  ) then
    create policy "Doctor can insert patients"
    on public.patients
    for insert
    to authenticated
    with check (public.has_role(auth.uid(), 'doctor'::public.app_role));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'patients'
      and policyname = 'Doctor can update patients'
  ) then
    create policy "Doctor can update patients"
    on public.patients
    for update
    to authenticated
    using (public.has_role(auth.uid(), 'doctor'::public.app_role))
    with check (public.has_role(auth.uid(), 'doctor'::public.app_role));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
    on public.user_profiles
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end $$;
