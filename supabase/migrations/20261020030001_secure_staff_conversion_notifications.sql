begin;
create or replace function public.convert_request_to_appointment(
  p_request_id uuid,
  p_accepted_date date default null::date,
  p_accepted_time time without time zone default null::time without time zone,
  p_professional_id uuid default null::uuid,
  p_consultation_type_id uuid default null::uuid,
  p_duration integer default null::integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_slot jsonb;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_date date;
  v_time time;
  v_prof_id uuid;
  v_duration integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (auth.uid() is not null and (
       public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'secretary')
     )) then
    raise exception 'Staff manager role required' using errcode = '42501';
  end if;
  select * into v_request from public.appointment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found: %', p_request_id;
  end if;

  if v_request.status = 'converted' then
    raise exception 'Request already converted';
  end if;

  if v_request.status not in ('pending', 'pre_confirmed', 'suggested') then
    raise exception 'Request cannot be converted from its current status';
  end if;

  v_slot := public.normalize_accepted_slot_value(v_request.accepted_slot);

  v_date := coalesce(
    p_accepted_date,
    case when v_slot is not null then (v_slot->>'date')::date else null end,
    v_request.preferred_date
  );

  v_time := coalesce(
    p_accepted_time,
    case when v_slot is not null then (v_slot->>'time')::time else null end,
    v_request.preferred_time
  );

  v_prof_id := coalesce(p_professional_id, v_request.assigned_professional_id);

  if v_prof_id is null and v_slot ? 'professional_id' then
    v_prof_id := nullif(v_slot->>'professional_id', '')::uuid;
  end if;

  if v_prof_id is null then
    select nullif(slot->>'professional_id', '')::uuid
      into v_prof_id
    from jsonb_array_elements(coalesce(v_request.suggested_slots, '[]'::jsonb)) as slot
    where slot->>'date' = to_char(v_date, 'YYYY-MM-DD')
      and left(slot->>'time', 5) = to_char(v_time, 'HH24:MI')
      and slot ? 'professional_id'
    limit 1;
  end if;

  if v_prof_id is null then
    select p.id
      into v_prof_id
    from public.professionals p
    left join public.professional_specialties ps on ps.professional_id = p.id
    where p.specialty_id = v_request.specialty_id
       or ps.specialty_id = v_request.specialty_id
    order by p.created_at asc
    limit 1;
  end if;

  if v_prof_id is null then
    raise exception 'No professional available for request % specialty %', p_request_id, v_request.specialty_id;
  end if;

  v_duration := coalesce(p_duration, v_request.estimated_duration, 30);

  if v_date is null or v_time is null or v_duration <= 0 or v_duration > 1440 then
    raise exception 'Invalid appointment date, time or duration';
  end if;

  -- Serialize concurrent RPC bookings for this professional/day.
  perform pg_advisory_xact_lock(hashtextextended(v_prof_id::text || ':' || v_date::text, 0));
  if exists (
    select 1 from public.appointments a
    where a.professional_id = v_prof_id and a.date = v_date
      and a.status not in ('cancelled', 'no_show')
      and a.date + a.time < v_date + v_time + make_interval(mins => v_duration)
      and v_date + v_time < a.date + a.time + make_interval(mins => a.duration)
  ) then
    raise exception 'Professional is not available at this time';
  end if;

  insert into public.patients (name, phone, email, nif)
  values (v_request.name, v_request.phone, v_request.email, v_request.nif)
  on conflict (nif) do update
    set name = coalesce(nullif(excluded.name, ''), public.patients.name),
        phone = coalesce(nullif(excluded.phone, ''), public.patients.phone),
        email = coalesce(nullif(excluded.email, ''), public.patients.email),
        updated_at = now()
  returning id into v_patient_id;

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
    notes
  ) values (
    v_patient_id,
    v_prof_id,
    v_request.specialty_id,
    p_consultation_type_id,
    v_date,
    v_time,
    v_duration,
    'confirmed',
    v_request.reason,
    'Convertido de pedido online. NIF: ' || v_request.nif
  ) returning id into v_appointment_id;

  update public.appointment_requests
     set status = 'converted',
         accepted_slot = jsonb_build_object('date', v_date, 'time', v_time, 'professional_id', v_prof_id)
   where id = p_request_id;

  return v_appointment_id;
end;
$$;;

revoke execute on function public.convert_request_to_appointment(uuid,date,time,uuid,uuid,integer) from public, anon;
grant execute on function public.convert_request_to_appointment(uuid,date,time,uuid,uuid,integer) to authenticated, service_role;

-- Users can see only their own notifications and, for doctors, their own appointments.
create policy "Users can read own relevant notifications"
on public.notifications for select to authenticated
using (
  user_id = (select auth.uid())
  and (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'secretary')
    or exists (
      select 1 from public.appointments a join public.professionals p on p.id=a.professional_id
      where a.id=notifications.appointment_id and p.user_id=(select auth.uid())
    )
  )
);
create policy "Users can mark own notifications read"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
