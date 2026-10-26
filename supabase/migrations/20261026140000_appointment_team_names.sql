begin;
-- Nullable for legacy appointments; no backfill UPDATEs that could trigger patient messages.
alter table public.appointments add column professional_names text[];
comment on column public.appointments.professional_names is 'Team name snapshot, primary first; populated atomically by save_appointment_team. Legacy rows may be null.';

create or replace function public.save_appointment_team(p_appointment_id uuid,p_expected_version bigint,p_appointment jsonb,p_additional_professional_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare oldrow public.appointments; a public.appointments; prof uuid; reason text; ids uuid[]; oldids uuid[]; k text;
begin
 if not barnun_private.can_manage_appointments() and not (
   p_appointment_id is null and cardinality(p_additional_professional_ids)=0
   and public.has_role(auth.uid(),'doctor')
   and exists(select 1 from public.professionals p where p.id::text=p_appointment->>'professional_id' and p.user_id=auth.uid())
   and coalesce(p_appointment->>'status','confirmed')='confirmed'
 ) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_additional_professional_ids is null or jsonb_typeof(p_appointment) is distinct from 'object' then raise exception 'invalid_team'; end if;
 for k in select jsonb_object_keys(p_appointment) loop
   if k <> all(array['patient_id','professional_id','specialty_id','consultation_type_id','date','time','duration','status','reason','notes','cancellation_reason','is_rescheduled']) then raise exception 'unsupported_field: %',k; end if;
 end loop;
 if p_appointment_id is not null then
   select * into oldrow from public.appointments where id=p_appointment_id for update;
   if not found or oldrow.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001'; end if;
   a := jsonb_populate_record(oldrow,p_appointment);
   select array_agg(professional_id) into oldids from public.appointment_additional_professionals where appointment_id=oldrow.id;
   oldids := coalesce(oldids,'{}') || oldrow.professional_id;
 else
   a := jsonb_populate_record(null::public.appointments,p_appointment);
   a.id := gen_random_uuid(); a.status := coalesce(a.status,'confirmed'); a.duration := coalesce(a.duration,30);
 end if;
 if a.professional_id is null then raise exception 'invalid_team'; end if;
 ids := array[a.professional_id] || p_additional_professional_ids;
 if exists(select 1 from unnest(ids) id where id is null) or cardinality(ids) <> (select count(distinct id) from unnest(ids) id) then raise exception 'duplicate_professional' using errcode='23514'; end if;
 for prof in select distinct id from unnest(ids || coalesce(oldids,'{}')) id order by id loop
   perform pg_advisory_xact_lock(hashtextextended('barnun-professional:'||prof::text,0));
 end loop;
 if a.status not in ('cancelled','no_show') then
   for prof in select unnest(ids) loop
     reason := barnun_private.availability_reason(prof,a.specialty_id,a.consultation_type_id,a.date,a.time,a.duration,p_appointment_id);
     if reason is not null then raise exception '%: %',reason,prof using errcode='23514'; end if;
   end loop;
 end if;
 -- Snapshot the complete team before INSERT/UPDATE so every webhook payload is complete.
 select array_agg(p.name order by team.ordinality) into a.professional_names
 from unnest(array[a.professional_id] || p_additional_professional_ids) with ordinality team(id,ordinality)
 join public.professionals p on p.id=team.id;
 -- Remove departing participants before the row trigger validates the final team.
 -- This remains atomic and must not require a departing doctor to be available.
 if p_appointment_id is not null then
   delete from public.appointment_additional_professionals where appointment_id=a.id and not professional_id=any(p_additional_professional_ids);
 end if;
 if p_appointment_id is null then
   insert into public.appointments(id,patient_id,professional_id,specialty_id,consultation_type_id,date,time,duration,status,reason,notes,professional_names,professional_name,patient_name,patient_phone,specialty_name,consultation_type_name)
   values(a.id,a.patient_id,a.professional_id,a.specialty_id,a.consultation_type_id,a.date,a.time,a.duration,a.status,a.reason,a.notes,a.professional_names,
     (select name from public.professionals where id=a.professional_id),(select name from public.patients where id=a.patient_id),(select phone from public.patients where id=a.patient_id),
     (select name from public.specialties where id=a.specialty_id),(select name from public.consultation_types where id=a.consultation_type_id));
 else
   update public.appointments set patient_id=a.patient_id,professional_id=a.professional_id,specialty_id=a.specialty_id,consultation_type_id=a.consultation_type_id,
     date=a.date,time=a.time,duration=a.duration,status=a.status,reason=a.reason,notes=a.notes,cancellation_reason=a.cancellation_reason,
     professional_names=a.professional_names,is_rescheduled=coalesce(a.is_rescheduled,false),version=oldrow.version+1,
     professional_name=(select name from public.professionals where id=a.professional_id),
     consultation_type_name=(select name from public.consultation_types where id=a.consultation_type_id) where id=a.id;
 end if;
 insert into public.appointment_additional_professionals(appointment_id,professional_id,professional_name)
 select a.id,p.id,p.name from public.professionals p where p.id=any(p_additional_professional_ids)
 on conflict(appointment_id,professional_id) do nothing;
 return a.id;
end;
$$;


commit;
