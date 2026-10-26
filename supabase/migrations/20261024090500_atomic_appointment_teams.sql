begin;

-- Legacy name-sync triggers use unqualified table names. Give them an explicit
-- trusted path so they work when called from the empty-path RPCs below.
alter function public.sync_professional_name() set search_path = public, pg_temp;
alter function public.sync_consultation_type_name() set search_path = public, pg_temp;
alter function public.sync_request_professional_name() set search_path = public, pg_temp;

create or replace function barnun_private.can_manage_appointments()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt()->>'role' = 'service_role',false)
    or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'secretary');
$$;

create or replace function barnun_private.availability_reason(
 p_professional_id uuid, p_specialty_id uuid, p_consultation_type_id uuid,
 p_date date, p_time time, p_duration integer, p_exclude_appointment_id uuid
) returns text language plpgsql security definer set search_path = '' as $$
declare p public.professionals; profile public.user_profiles; weekday text; shift jsonb;
begin
 if p_date is null or p_time is null or p_duration is null or p_duration <= 0
   or extract(epoch from p_time)/60 + p_duration > 1440 then return 'invalid_interval'; end if;
 select * into p from public.professionals where id=p_professional_id;
 if not found then return 'inactive'; end if;
 if p.user_id is not null and not exists(select 1 from auth.users u where u.id=p.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())) then return 'inactive'; end if;
 select * into profile from public.user_profiles where user_id=p.user_id;
 if p.specialty_id is distinct from p_specialty_id and not exists(select 1 from public.professional_specialties where professional_id=p.id and specialty_id=p_specialty_id) then return 'specialty'; end if;
 if cardinality(profile.active_specialty_ids)>0 and not p_specialty_id=any(profile.active_specialty_ids) then return 'specialty'; end if;
 if p_consultation_type_id is not null then
   if not exists(select 1 from public.consultation_types where id=p_consultation_type_id and specialty_id=p_specialty_id) then return 'consultation_type'; end if;
   if cardinality(profile.active_consultation_type_ids)>0 and not p_consultation_type_id=any(profile.active_consultation_type_ids) then return 'consultation_type'; end if;
 elsif cardinality(profile.active_consultation_type_ids)>0 then return 'consultation_type'; end if;
 if profile.working_hours is not null and profile.working_hours <> '[]'::jsonb then
   if jsonb_typeof(profile.working_hours) <> 'array' then return 'working_hours'; end if;
   weekday := (array['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[extract(dow from p_date)::integer+1];
   select item into shift from jsonb_array_elements(profile.working_hours) item
     where translate(lower(trim(item->>'day')),'çá','ca')=weekday and item->>'enabled'='true' limit 1;
   if shift is null or not coalesce(shift->>'start' ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',false)
      or not coalesce(shift->>'end' ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',false) then return 'working_hours'; end if;
   if p_time < (shift->>'start')::time or p_date+p_time+make_interval(mins=>p_duration) > p_date+(shift->>'end')::time then return 'working_hours'; end if;
 end if;
 if jsonb_typeof(profile.time_off)='array' and exists(select 1 from jsonb_array_elements(profile.time_off) item
   where to_char(p_date,'YYYY-MM-DD') >= item->>'start' and to_char(p_date,'YYYY-MM-DD') <= coalesce(nullif(item->>'end',''),item->>'start')) then return 'time_off'; end if;
 if exists(select 1 from public.appointments a where a.id is distinct from p_exclude_appointment_id
   and (a.professional_id=p.id or exists(select 1 from public.appointment_additional_professionals ap where ap.appointment_id=a.id and ap.professional_id=p.id))
   and a.status not in ('cancelled','no_show') and a.date=p_date
   and a.date+a.time < p_date+p_time+make_interval(mins=>p_duration)
   and p_date+p_time < a.date+a.time+make_interval(mins=>a.duration)) then return 'conflict'; end if;
 return null;
end;
$$;

create or replace function public.get_appointment_team_availability(
 p_specialty_id uuid, p_consultation_type_id uuid, p_date date, p_time time,
 p_duration integer, p_exclude_appointment_id uuid default null
) returns table(professional_id uuid, available boolean, reason text)
language plpgsql security definer set search_path = '' as $$
begin
 if not (barnun_private.can_manage_appointments() or public.has_role(auth.uid(),'doctor')) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_exclude_appointment_id is not null and not (barnun_private.can_manage_appointments() or barnun_private.is_appointment_participant(p_exclude_appointment_id)) then raise exception 'forbidden' using errcode='42501'; end if;
 return query select p.id, r.reason is null, r.reason from public.professionals p
 cross join lateral (select barnun_private.availability_reason(p.id,p_specialty_id,p_consultation_type_id,p_date,p_time,p_duration,p_exclude_appointment_id) as reason) r;
end;
$$;

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
 -- Remove departing participants before the row trigger validates the final team.
 -- This remains atomic and must not require a departing doctor to be available.
 if p_appointment_id is not null then
   delete from public.appointment_additional_professionals where appointment_id=a.id and not professional_id=any(p_additional_professional_ids);
 end if;
 if p_appointment_id is null then
   insert into public.appointments(id,patient_id,professional_id,specialty_id,consultation_type_id,date,time,duration,status,reason,notes,professional_name,patient_name,patient_phone,specialty_name,consultation_type_name)
   values(a.id,a.patient_id,a.professional_id,a.specialty_id,a.consultation_type_id,a.date,a.time,a.duration,a.status,a.reason,a.notes,
     (select name from public.professionals where id=a.professional_id),(select name from public.patients where id=a.patient_id),(select phone from public.patients where id=a.patient_id),
     (select name from public.specialties where id=a.specialty_id),(select name from public.consultation_types where id=a.consultation_type_id));
 else
   update public.appointments set patient_id=a.patient_id,professional_id=a.professional_id,specialty_id=a.specialty_id,consultation_type_id=a.consultation_type_id,
     date=a.date,time=a.time,duration=a.duration,status=a.status,reason=a.reason,notes=a.notes,cancellation_reason=a.cancellation_reason,
     is_rescheduled=coalesce(a.is_rescheduled,false),version=oldrow.version+1,
     professional_name=(select name from public.professionals where id=a.professional_id),
     consultation_type_name=(select name from public.consultation_types where id=a.consultation_type_id) where id=a.id;
 end if;
 insert into public.appointment_additional_professionals(appointment_id,professional_id,professional_name)
 select a.id,p.id,p.name from public.professionals p where p.id=any(p_additional_professional_ids)
 on conflict(appointment_id,professional_id) do nothing;
 return a.id;
end;
$$;

create or replace function public.set_appointment_state(p_appointment_id uuid,p_expected_version bigint,p_status public.appointment_status,p_final_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.appointments; manager boolean;
begin
 manager := barnun_private.can_manage_appointments();
 select * into a from public.appointments where id=p_appointment_id for update;
 if not found or not (manager or (public.has_role(auth.uid(),'doctor') and barnun_private.is_appointment_participant(a.id))) then raise exception 'forbidden' using errcode='42501'; end if;
 if not manager and p_status in ('cancelled','no_show') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_status=a.status then return a.id; end if;
 if a.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001'; end if;
 if not ((a.status::text in ('confirmed','pre_confirmed','scheduled') and p_status in ('waiting','in_progress','completed','cancelled','no_show'))
   or (a.status='waiting' and p_status in ('confirmed','in_progress','completed','cancelled','no_show'))
   or (a.status='in_progress' and p_status in ('waiting','completed','cancelled','no_show'))
   or (a.status='completed' and p_status='in_progress')) then raise exception 'invalid_transition'; end if;
 update public.appointments set status=p_status,version=version+1,
   final_notes=case when p_status='completed' then p_final_notes else final_notes end,
   finalized_at=case when p_status='completed' then now() else finalized_at end where id=a.id;
 return a.id;
end;
$$;

-- Authenticated clients may only mutate appointments through checked functions.
create table if not exists public.appointment_notes (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null references public.appointments(id) on delete cascade,
 author_user_id uuid not null references auth.users(id) on delete restrict,
 note text not null check (length(trim(note))>0),
 created_at timestamptz not null default now()
);
alter table public.appointment_notes enable row level security;
grant select,insert on public.appointment_notes to authenticated;
revoke all on public.appointment_notes from anon;
create policy "Shared consultation notes read" on public.appointment_notes for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'secretary') or barnun_private.is_appointment_participant(appointment_id));
create policy "Shared consultation notes append" on public.appointment_notes for insert to authenticated
with check (author_user_id=auth.uid() and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'secretary') or barnun_private.is_appointment_participant(appointment_id)));

create or replace function barnun_private.guard_appointment_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare prof uuid; reason text; ids uuid[];
begin
 if tg_op='UPDATE' then
   new.version := old.version+1;
   if (new.professional_id,new.specialty_id,new.consultation_type_id,new.date,new.time,new.duration) is not distinct from
      (old.professional_id,old.specialty_id,old.consultation_type_id,old.date,old.time,old.duration)
      and not (old.status in ('cancelled','no_show') and new.status not in ('cancelled','no_show')) then return new; end if;
 end if;
 select coalesce(array_agg(professional_id),'{}') into ids from public.appointment_additional_professionals where appointment_id=new.id;
 ids := ids || new.professional_id;
 for prof in select distinct id from unnest(ids) id order by id loop
   perform pg_advisory_xact_lock(hashtextextended('barnun-professional:'||prof::text,0));
 end loop;
 if new.status not in ('cancelled','no_show') then
   for prof in select unnest(ids) loop
     reason := barnun_private.availability_reason(prof,new.specialty_id,new.consultation_type_id,new.date,new.time,new.duration,new.id);
     if reason is not null then raise exception '%: %',reason,prof using errcode='23514'; end if;
   end loop;
 end if;
 return new;
end;
$$;
create trigger guard_appointment_booking before insert or update on public.appointments
for each row execute function barnun_private.guard_appointment_write();
revoke all on function barnun_private.guard_appointment_write() from public,anon,authenticated;
revoke insert,update,delete on public.appointment_additional_professionals from service_role;
revoke insert,update,delete on public.appointments from authenticated,anon;
revoke all on function barnun_private.can_manage_appointments() from public,anon,authenticated;
revoke all on function barnun_private.availability_reason(uuid,uuid,uuid,date,time,integer,uuid) from public,anon,authenticated;
revoke all on function public.get_appointment_team_availability(uuid,uuid,date,time,integer,uuid) from public,anon;
revoke all on function public.save_appointment_team(uuid,bigint,jsonb,uuid[]) from public,anon;
revoke all on function public.set_appointment_state(uuid,bigint,public.appointment_status,text) from public,anon;
grant execute on function public.get_appointment_team_availability(uuid,uuid,date,time,integer,uuid) to authenticated,service_role;
grant execute on function public.save_appointment_team(uuid,bigint,jsonb,uuid[]) to authenticated,service_role;
grant execute on function public.set_appointment_state(uuid,bigint,public.appointment_status,text) to authenticated,service_role;
commit;
