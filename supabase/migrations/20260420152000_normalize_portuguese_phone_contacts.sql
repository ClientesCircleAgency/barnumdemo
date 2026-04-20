create or replace function public.normalize_portuguese_phone_value(phone_value text)
returns text
language plpgsql
immutable
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

  if digits ~ '^[0-9]{9}$' then
    return '+351' || digits;
  end if;

  return '+351' || digits;
end;
$$;

create or replace function public.normalize_contact_phone_before_write()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_portuguese_phone_value(new.phone);
  return new;
end;
$$;

drop trigger if exists normalize_patients_phone_before_write on public.patients;
create trigger normalize_patients_phone_before_write
before insert or update of phone on public.patients
for each row
execute function public.normalize_contact_phone_before_write();

drop trigger if exists normalize_appointment_requests_phone_before_write on public.appointment_requests;
create trigger normalize_appointment_requests_phone_before_write
before insert or update of phone on public.appointment_requests
for each row
execute function public.normalize_contact_phone_before_write();

drop trigger if exists normalize_contact_messages_phone_before_write on public.contact_messages;
create trigger normalize_contact_messages_phone_before_write
before insert or update of phone on public.contact_messages
for each row
execute function public.normalize_contact_phone_before_write();

update public.patients
set phone = public.normalize_portuguese_phone_value(phone)
where phone is not null
  and phone <> public.normalize_portuguese_phone_value(phone);

update public.appointment_requests
set phone = public.normalize_portuguese_phone_value(phone)
where phone is not null
  and phone <> public.normalize_portuguese_phone_value(phone);

update public.contact_messages
set phone = public.normalize_portuguese_phone_value(phone)
where phone is not null
  and phone <> public.normalize_portuguese_phone_value(phone);
