-- Preserve Portuguese and Brazilian phone prefixes instead of forcing every number to +351.

create or replace function public.normalize_portuguese_phone_value(phone_value text)
returns text
language plpgsql
as $$
declare
  digits text;
begin
  if phone_value is null or btrim(phone_value) = '' then
    return phone_value;
  end if;

  digits := regexp_replace(phone_value, '\D', '', 'g');

  if digits = '' then
    return btrim(phone_value);
  end if;

  if digits ~ '^00351[0-9]{9}$' then
    return '+351' || substring(digits from 6);
  end if;

  if digits ~ '^351[0-9]{9}$' then
    return '+' || digits;
  end if;

  if digits ~ '^0055[0-9]{10,11}$' then
    return '+55' || substring(digits from 5);
  end if;

  if digits ~ '^55[0-9]{10,11}$' then
    return '+' || digits;
  end if;

  if digits ~ '^[0-9]{9}$' then
    return '+351' || digits;
  end if;

  if digits ~ '^[0-9]{10,11}$' then
    return '+55' || digits;
  end if;

  return '+' || digits;
end;
$$;
