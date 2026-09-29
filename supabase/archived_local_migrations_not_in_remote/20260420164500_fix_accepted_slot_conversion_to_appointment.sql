create or replace function public.normalize_accepted_slot_value(slot_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  slot_text text;
begin
  if slot_value is null then
    return null;
  end if;

  if jsonb_typeof(slot_value) = 'object' then
    return slot_value;
  end if;

  if jsonb_typeof(slot_value) = 'string' then
    slot_text := btrim(slot_value #>> '{}');
    if slot_text = '' then
      return null;
    end if;

    return slot_text::jsonb;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.trg_create_appointment_on_convert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot jsonb;
  v_patient_id uuid;
  v_prof_id uuid;
  v_date date;
  v_time time;
  v_duration integer;
  v_consultation_type_id uuid;
  v_professional_name text;
  v_specialty_name text;
begin
  if new.status <> 'converted' then
    return new;
  end if;

  if old.status = 'converted' and old.accepted_slot is not distinct from new.accepted_slot then
    return new;
  end if;

  v_slot := public.normalize_accepted_slot_value(new.accepted_slot);

  if v_slot is null or v_slot->>'date' is null or v_slot->>'time' is null then
    return new;
  end if;

  v_date := (v_slot->>'date')::date;
  v_time := (v_slot->>'time')::time;
  v_duration := coalesce(new.estimated_duration, 30);

  if v_slot ? 'professional_id' then
    v_prof_id := nullif(v_slot->>'professional_id', '')::uuid;
  end if;

  if v_prof_id is null then
    select nullif(slot->>'professional_id', '')::uuid
      into v_prof_id
    from jsonb_array_elements(coalesce(new.suggested_slots, '[]'::jsonb)) as slot
    where slot->>'date' = to_char(v_date, 'YYYY-MM-DD')
      and left(slot->>'time', 5) = to_char(v_time, 'HH24:MI')
      and slot ? 'professional_id'
    limit 1;
  end if;

  v_prof_id := coalesce(v_prof_id, new.assigned_professional_id);

  if v_prof_id is null then
    select p.id
      into v_prof_id
    from public.professionals p
    left join public.professional_specialties ps on ps.professional_id = p.id
    where p.specialty_id = new.specialty_id
       or ps.specialty_id = new.specialty_id
    order by p.created_at asc
    limit 1;
  end if;

  if v_prof_id is null then
    raise exception 'No professional available for request % specialty %', new.id, new.specialty_id;
  end if;

  select id
    into v_consultation_type_id
  from public.consultation_types
  where specialty_id = new.specialty_id
  order by created_at asc
  limit 1;

  select id
    into v_patient_id
  from public.patients
  where nif = new.nif;

  if v_patient_id is null then
    insert into public.patients (name, phone, email, nif)
    values (new.name, new.phone, new.email, new.nif)
    returning id into v_patient_id;
  else
    update public.patients
       set name = coalesce(nullif(new.name, ''), name),
           phone = coalesce(nullif(new.phone, ''), phone),
           email = coalesce(nullif(new.email, ''), email),
           updated_at = now()
     where id = v_patient_id;
  end if;

  if exists (
    select 1
    from public.appointments
    where patient_id = v_patient_id
      and date = v_date
      and time = v_time
      and status not in ('cancelled', 'no_show')
  ) then
    return new;
  end if;

  select p.name into v_professional_name from public.professionals p where p.id = v_prof_id;
  select s.name into v_specialty_name from public.specialties s where s.id = new.specialty_id;

  insert into public.appointments (
    patient_id,
    professional_id,
    specialty_id,
    consultation_type_id,
    date,
    time,
    duration,
    status,
    reason,
    notes,
    professional_name,
    specialty_name,
    patient_name,
    patient_phone,
    consultation_type_name
  ) values (
    v_patient_id,
    v_prof_id,
    new.specialty_id,
    v_consultation_type_id,
    v_date,
    v_time,
    v_duration,
    'confirmed',
    new.reason,
    'Convertido de pedido online. NIF: ' || new.nif,
    v_professional_name,
    v_specialty_name,
    new.name,
    new.phone,
    (select ct.name from public.consultation_types ct where ct.id = v_consultation_type_id)
  );

  return new;
end;
$$;

drop trigger if exists trg_create_appointment_on_convert on public.appointment_requests;
create trigger trg_create_appointment_on_convert
after update of status, accepted_slot on public.appointment_requests
for each row
execute function public.trg_create_appointment_on_convert();
