do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'Staff can view non-admin roles'
  ) then
    create policy "Staff can view non-admin roles"
      on public.user_roles
      for select
      to authenticated
      using (
        role <> 'admin'::public.app_role
        and (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          or public.has_role(auth.uid(), 'secretary'::public.app_role)
        )
      );
  end if;
end $$;
