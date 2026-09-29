-- Personal service preferences shown in "Minha Conta".

alter table public.user_profiles
  add column if not exists active_specialty_ids uuid[] not null default '{}'::uuid[],
  add column if not exists active_consultation_type_ids uuid[] not null default '{}'::uuid[];

update public.user_profiles up
set active_specialty_ids = coalesce(
      (
        select array_agg(ps.specialty_id order by ps.specialty_id)
        from public.professionals p
        join public.professional_specialties ps on ps.professional_id = p.id
        where p.user_id = up.user_id
      ),
      (
        select coalesce(array_agg(s.id order by s.name), '{}'::uuid[])
        from public.specialties s
      )
    ),
    active_consultation_type_ids = (
      select coalesce(array_agg(ct.id order by ct.name), '{}'::uuid[])
      from public.consultation_types ct
    )
where cardinality(active_specialty_ids) = 0
  and cardinality(active_consultation_type_ids) = 0;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'professional_specialties'
      and policyname = 'Users can update own professional specialties'
  ) then
    create policy "Users can update own professional specialties"
    on public.professional_specialties
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.professionals p
        where p.id = professional_specialties.professional_id
          and p.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.professionals p
        where p.id = professional_specialties.professional_id
          and p.user_id = auth.uid()
      )
    );
  end if;
end $$;
