begin;
create or replace function public.book_treatment_sessions(p_treatment_id uuid,p_slots jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.treatments;s public.treatment_sessions;a public.appointments;slot jsonb;extras uuid[];prof uuid;aid uuid;outcome jsonb:='[]'; actual uuid[];
begin
 if not barnun_private.treatment_manager() then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots) not between 1 and 50 then raise exception 'invalid_slots';end if;
 if (select count(distinct x->>'session_id') from jsonb_array_elements(p_slots) x)<>jsonb_array_length(p_slots) then raise exception 'duplicate_session';end if;
 select * into t from public.treatments where id=p_treatment_id for update;
 if not found or t.status<>'active' then raise exception 'treatment_closed';end if;
 perform 1 from public.treatment_sessions where treatment_id=t.id and id in(select (x->>'session_id')::uuid from jsonb_array_elements(p_slots) x) order by id for update;
 -- Acquire the whole batch's professional locks before any appointment is inserted.
 for prof in select distinct q.id from (
 select primary_professional_id id from public.treatment_sessions where treatment_id=t.id and id in(select (x->>'session_id')::uuid from jsonb_array_elements(p_slots) x)
 union select sp.professional_id from public.treatment_session_professionals sp join public.treatment_sessions sc on sc.id=sp.session_id where sc.treatment_id=t.id and sc.id in(select (x->>'session_id')::uuid from jsonb_array_elements(p_slots) x)) q order by q.id loop
 perform pg_advisory_xact_lock(hashtextextended('barnun-professional:'||prof::text,0));end loop;
 perform pg_advisory_xact_lock(hashtextextended('barnun-patient:'||t.patient_id::text,0));
 for slot in select value from jsonb_array_elements(p_slots) loop
 select * into s from public.treatment_sessions where id=(slot->>'session_id')::uuid and treatment_id=t.id;
 if not found or s.disposition='omitted' then raise exception 'invalid_session';end if;
 select coalesce(array_agg(professional_id order by professional_id),'{}') into extras from public.treatment_session_professionals where session_id=s.id;
 if s.appointment_id is not null then
 select * into a from public.appointments where id=s.appointment_id;
 select coalesce(array_agg(professional_id order by professional_id),'{}') into actual from public.appointment_additional_professionals where appointment_id=a.id;
 if a.date is distinct from (slot->>'date')::date or a.time is distinct from (slot->>'time')::time or a.duration<>s.duration or a.professional_id<>s.primary_professional_id or a.consultation_type_id<>s.consultation_type_id or actual<>extras or a.status in ('cancelled','no_show') then raise exception 'session_already_booked: %',s.id;end if;
 aid:=a.id;
 else
 if s.version is distinct from (slot->>'expected_version')::bigint then raise exception 'stale_version' using errcode='40001';end if;
 if (slot->>'date') is null or (slot->>'time') is null or (((slot->>'date')::date + (slot->>'time')::time) at time zone 'Europe/Lisbon') <= now() then
 raise exception 'session_in_past' using errcode='23514',hint=s.id::text;end if;
 if exists(select 1 from public.appointments existing where existing.patient_id=t.patient_id and existing.status in ('confirmed','waiting','in_progress') and
 (existing.date+existing.time)<((slot->>'date')::date+(slot->>'time')::time+make_interval(mins=>s.duration)) and
 (existing.date+existing.time+make_interval(mins=>existing.duration))>((slot->>'date')::date+(slot->>'time')::time)) then
 raise exception 'patient_unavailable' using errcode='23514',hint=s.id::text;end if;
 begin
 aid:=public.save_appointment_team(null,null,jsonb_build_object('patient_id',t.patient_id,'professional_id',s.primary_professional_id,'specialty_id',t.specialty_id,'consultation_type_id',s.consultation_type_id,'date',slot->>'date','time',slot->>'time','duration',s.duration,'status','confirmed'),extras);
 exception when check_violation then raise exception 'session_unavailable: %',s.id using errcode='23514';end;
 update public.treatment_sessions set appointment_id=aid,version=version+1,updated_at=now() where id=s.id;
 end if;
 outcome:=outcome||jsonb_build_array(jsonb_build_object('session_id',s.id,'appointment_id',aid));
 end loop;
 return outcome;
end $$;


commit;
