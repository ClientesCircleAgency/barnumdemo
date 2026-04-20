-- Rename secretary login emails and profile names.

do $$
declare
  secretary_map jsonb := '{
    "d24b39ee-fe12-40c2-bb2c-87a3dcc2c2e5": {
      "email": "sandra.mendonca@barnun.pt",
      "full_name": "Sandra Mendonca"
    },
    "8de074e9-5d09-41f6-b00e-4a42607fd76e": {
      "email": "sandra.azevedo@barnun.pt",
      "full_name": "Sandra Azevedo"
    }
  }'::jsonb;
  item record;
begin
  for item in
    select
      key::uuid as user_id,
      value ->> 'email' as email,
      value ->> 'full_name' as full_name
    from jsonb_each(secretary_map)
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

    update public.user_profiles
    set full_name = item.full_name,
        updated_at = now()
    where user_id = item.user_id;
  end loop;
end $$;
