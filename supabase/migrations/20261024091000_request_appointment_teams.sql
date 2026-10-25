begin;
alter table public.appointments add column source_request_id uuid references public.appointment_requests(id) on delete set null;
create unique index appointments_source_request_idx on public.appointments(source_request_id) where source_request_id is not null;

create or replace function public.trg_create_appointment_on_convert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare slot jsonb; matching jsonb; matches integer; patient uuid; appointment uuid; extras uuid[]; main uuid; typ uuid;
begin
 if new.status <> 'converted' then return new; end if;
 if exists(select 1 from public.appointments where source_request_id=new.id) then return new; end if;
 if not barnun_private.can_manage_appointments() then raise exception 'forbidden' using errcode='42501'; end if;
 slot := public.normalize_accepted_slot_value(new.accepted_slot);
 if slot is null or slot->>'date' is null or slot->>'time' is null then raise exception 'invalid_accepted_slot'; end if;
 if not slot ? 'additional_professional_ids' and jsonb_array_length(coalesce(new.suggested_slots,'[]'))>0 then
   select count(*),(jsonb_agg(s)->0) into matches,matching from jsonb_array_elements(new.suggested_slots) s
   where s->>'date'=slot->>'date' and left(s->>'time',5)=left(slot->>'time',5)
   and (not slot ? 'professional_id' or s->>'professional_id'=slot->>'professional_id');
   if matches <> 1 then raise exception 'ambiguous_accepted_slot'; end if;
   slot := matching || slot;
 end if;
 main := coalesce(nullif(slot->>'professional_id','')::uuid,new.assigned_professional_id);
 typ := nullif(slot->>'consultation_type_id','')::uuid;
 if typ is null then select id into typ from public.consultation_types where specialty_id=new.specialty_id order by created_at,id limit 1; end if;
 if main is null then raise exception 'professional_required'; end if;
 select coalesce(array_agg(value::uuid),'{}') into extras from jsonb_array_elements_text(coalesce(slot->'additional_professional_ids','[]'));
 insert into public.patients(name,phone,email,nif) values(new.name,new.phone,new.email,new.nif)
 on conflict(nif) do update set name=excluded.name,phone=excluded.phone,email=coalesce(nullif(excluded.email,''),public.patients.email)
 returning id into patient;
 appointment := public.save_appointment_team(null,null,jsonb_build_object(
   'patient_id',patient,'professional_id',main,'specialty_id',new.specialty_id,'consultation_type_id',typ,
   'date',slot->>'date','time',slot->>'time','duration',coalesce((slot->>'duration')::integer,new.estimated_duration,30),
   'status','confirmed','reason',new.reason,'notes','Convertido de pedido online.'),extras);
 update public.appointments set source_request_id=new.id where id=appointment;
 return new;
end;
$$;

create function public.convert_request_to_appointment_with_team(
 p_request_id uuid,p_accepted_date date default null,p_accepted_time time default null,
 p_professional_id uuid default null,p_consultation_type_id uuid default null,p_duration integer default null,
 p_additional_professional_ids uuid[] default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.appointment_requests; slot jsonb; result uuid;
begin
 if not barnun_private.can_manage_appointments() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into r from public.appointment_requests where id=p_request_id for update;
 if not found then raise exception 'request_not_found'; end if;
 select id into result from public.appointments where source_request_id=r.id;
 if result is not null then return result; end if;
 if r.status not in ('pending','pre_confirmed','suggested') then raise exception 'invalid_request_status'; end if;
 slot := coalesce(public.normalize_accepted_slot_value(r.accepted_slot),'{}');
 slot := slot || jsonb_build_object('date',coalesce(p_accepted_date,(slot->>'date')::date,r.preferred_date),
   'time',coalesce(p_accepted_time,(slot->>'time')::time,r.preferred_time));
 if p_professional_id is not null then slot := slot || jsonb_build_object('professional_id',p_professional_id); end if;
 if p_consultation_type_id is not null then slot := slot || jsonb_build_object('consultation_type_id',p_consultation_type_id); end if;
 if p_duration is not null then slot := slot || jsonb_build_object('duration',p_duration); end if;
 if p_additional_professional_ids is not null then slot := slot || jsonb_build_object('additional_professional_ids',p_additional_professional_ids); end if;
 update public.appointment_requests set status='converted',accepted_slot=slot where id=r.id;
 select id into result from public.appointments where source_request_id=r.id;
 if result is null then raise exception 'conversion_failed'; end if;
 return result;
end;
$$;

create or replace function public.convert_request_to_appointment(
 p_request_id uuid,p_accepted_date date default null,p_accepted_time time default null,
 p_professional_id uuid default null,p_consultation_type_id uuid default null,p_duration integer default null
) returns uuid language sql security invoker set search_path='' as $$
 select public.convert_request_to_appointment_with_team(p_request_id,p_accepted_date,p_accepted_time,p_professional_id,p_consultation_type_id,p_duration,null);
$$;
revoke all on function public.convert_request_to_appointment_with_team(uuid,date,time,uuid,uuid,integer,uuid[]) from public,anon;
grant execute on function public.convert_request_to_appointment_with_team(uuid,date,time,uuid,uuid,integer,uuid[]) to authenticated,service_role;
revoke all on function public.trg_create_appointment_on_convert() from public,anon,authenticated;
commit;
