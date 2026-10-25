begin;
alter table public.professionals add column is_active boolean not null default true;
-- Preserve legacy unlinked professionals, but remember all future unlink/deletion events.
create or replace function barnun_private.deactivate_unlinked_professional()
returns trigger language plpgsql set search_path = '' as $$
begin
 if old.user_id is not null and new.user_id is null then new.is_active := false; end if;
 return new;
end;
$$;
create trigger deactivate_unlinked_professional before update on public.professionals
for each row execute function barnun_private.deactivate_unlinked_professional();
create or replace function barnun_private.availability_reason(
 p_professional_id uuid, p_specialty_id uuid, p_consultation_type_id uuid,
 p_date date, p_time time, p_duration integer, p_exclude_appointment_id uuid
) returns text language plpgsql security definer set search_path = '' as $$
declare p public.professionals; profile public.user_profiles; weekday text; shift jsonb;
begin
 if p_date is null or p_time is null or p_duration is null or p_duration <= 0
   or extract(epoch from p_time)/60 + p_duration > 1440 then return 'invalid_interval'; end if;
 -- Reject nonexistent and ambiguous Lisbon civil times; the schema has no UTC offset.
 if ((p_date+p_time) at time zone 'Europe/Lisbon') at time zone 'Europe/Lisbon' <> p_date+p_time
   or (((p_date+p_time) at time zone 'Europe/Lisbon') - interval '1 hour') at time zone 'Europe/Lisbon' = p_date+p_time
   or (((p_date+p_time) at time zone 'Europe/Lisbon') + interval '1 hour') at time zone 'Europe/Lisbon' = p_date+p_time then return 'invalid_interval'; end if;
 select * into p from public.professionals where id=p_professional_id;
 if not found or not p.is_active then return 'inactive'; end if;
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


commit;
