do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'Staff can manage non-admin profiles'
  ) then
    create policy "Staff can manage non-admin profiles"
      on public.user_profiles
      for all
      to authenticated
      using (
        (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
        and exists (
          select 1
          from public.user_roles target_role
          where target_role.user_id = user_profiles.user_id
            and target_role.role <> 'admin'::public.app_role
        )
      )
      with check (
        (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
        and exists (
          select 1
          from public.user_roles target_role
          where target_role.user_id = user_profiles.user_id
            and target_role.role <> 'admin'::public.app_role
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'professionals'
      and policyname = 'Staff can manage non-admin professionals'
  ) then
    create policy "Staff can manage non-admin professionals"
      on public.professionals
      for all
      to authenticated
      using (
        (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
        and user_id is not null
        and exists (
          select 1
          from public.user_roles target_role
          where target_role.user_id = professionals.user_id
            and target_role.role <> 'admin'::public.app_role
        )
      )
      with check (
        (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
        and user_id is not null
        and exists (
          select 1
          from public.user_roles target_role
          where target_role.user_id = professionals.user_id
            and target_role.role <> 'admin'::public.app_role
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'Staff can update non-admin roles'
  ) then
    create policy "Staff can update non-admin roles"
      on public.user_roles
      for update
      to authenticated
      using (
        role <> 'admin'::public.app_role
        and (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
      )
      with check (
        role <> 'admin'::public.app_role
        and (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'professional_specialties'
      and policyname = 'Staff can manage non-admin professional specialties'
  ) then
    create policy "Staff can manage non-admin professional specialties"
      on public.professional_specialties
      for all
      to authenticated
      using (
        (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
        and exists (
          select 1
          from public.professionals p
          join public.user_roles target_role on target_role.user_id = p.user_id
          where p.id = professional_specialties.professional_id
            and target_role.role <> 'admin'::public.app_role
        )
      )
      with check (
        (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
        and exists (
          select 1
          from public.professionals p
          join public.user_roles target_role on target_role.user_id = p.user_id
          where p.id = professional_specialties.professional_id
            and target_role.role <> 'admin'::public.app_role
        )
      );
  end if;
end $$;
