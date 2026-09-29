-- Rename active doctor login emails to use their real names.

do $$
declare
  doctor_email_map jsonb := '{
    "6cc1a855-9ab8-47c5-9570-1c4d2ffcce34": "nogueira.nunes@barnun.pt",
    "4c45466f-1f88-4d15-974f-1feed9c3adc7": "thelma.alves@barnun.pt",
    "2df4734c-5f26-4f78-8123-1231db8d2ec0": "michelle.lima@barnun.pt",
    "4f38cf09-939f-49a9-a797-68aed98b7a7d": "joana.oliveira@barnun.pt"
  }'::jsonb;
  item record;
begin
  for item in
    select key::uuid as user_id, value #>> '{}' as email
    from jsonb_each(doctor_email_map)
  loop
    update auth.users
    set email = item.email,
        email_change = '',
        email_change_token_current = '',
        email_change_token_new = '',
        email_change_confirm_status = 0,
        updated_at = now()
    where id = item.user_id;

    update auth.identities
    set provider_id = item.email,
        identity_data = jsonb_set(identity_data, '{email}', to_jsonb(item.email), true),
        updated_at = now()
    where user_id = item.user_id
      and provider = 'email';
  end loop;
end $$;
