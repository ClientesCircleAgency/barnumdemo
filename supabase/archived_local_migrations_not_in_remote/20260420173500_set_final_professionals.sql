-- Final production professional roster.
-- Keeps admins/secretaries intact while removing extra doctor collaborators from the app.

do $$
declare
  dental_id uuid := '11111111-1111-1111-1111-111111111111';
  facial_id uuid := '22222222-2222-2222-2222-222222222222';

  dr_nogueira_id uuid := '0ecfd0bf-b651-4f9a-b992-2ac04632f6d8';
  thelma_id uuid := '80869b16-29d9-4581-ba43-f9ad329db937';
  michelle_id uuid := '10ad80a4-59d9-4281-9425-e2e58d60c576';
  joana_id uuid := 'ac8c753e-036c-464c-b2d9-ee39807d7362';

  dr_nogueira_user_id uuid := '6cc1a855-9ab8-47c5-9570-1c4d2ffcce34';
  thelma_user_id uuid := '4c45466f-1f88-4d15-974f-1feed9c3adc7';
  michelle_user_id uuid := '2df4734c-5f26-4f78-8123-1231db8d2ec0';
  joana_user_id uuid := '4f38cf09-939f-49a9-a797-68aed98b7a7d';
begin
  update public.professionals
  set name = case id
    when dr_nogueira_id then 'Dr. Nogueira Nunes'
    when thelma_id then 'Thelma Alves'
    when michelle_id then 'Dra. Michelle Lima'
    when joana_id then 'Joana Oliveira'
  end,
  specialty_id = dental_id
  where id in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  update public.user_profiles
  set full_name = case user_id
    when dr_nogueira_user_id then 'Dr. Nogueira Nunes'
    when thelma_user_id then 'Thelma Alves'
    when michelle_user_id then 'Dra. Michelle Lima'
    when joana_user_id then 'Joana Oliveira'
  end,
  updated_at = now()
  where user_id in (dr_nogueira_user_id, thelma_user_id, michelle_user_id, joana_user_id);

  delete from public.professional_specialties
  where professional_id in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  insert into public.professional_specialties (professional_id, specialty_id)
  values
    (dr_nogueira_id, dental_id),
    (thelma_id, dental_id),
    (thelma_id, facial_id),
    (michelle_id, dental_id),
    (michelle_id, facial_id),
    (joana_id, dental_id)
  on conflict do nothing;

  update public.appointments a
  set professional_name = p.name
  from public.professionals p
  where a.professional_id = p.id
    and p.id in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  delete from public.notifications n
  using public.appointments a
  where n.appointment_id = a.id
    and a.professional_id not in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  delete from public.appointments
  where professional_id not in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  delete from public.professional_specialties
  where professional_id not in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  delete from public.professionals
  where id not in (dr_nogueira_id, thelma_id, michelle_id, joana_id);

  delete from public.user_roles
  where role = 'doctor'
    and user_id not in (dr_nogueira_user_id, thelma_user_id, michelle_user_id, joana_user_id);

  delete from public.user_profiles
  where user_id not in (dr_nogueira_user_id, thelma_user_id, michelle_user_id, joana_user_id)
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = user_profiles.user_id
        and ur.role in ('admin', 'secretary')
    );
end $$;
