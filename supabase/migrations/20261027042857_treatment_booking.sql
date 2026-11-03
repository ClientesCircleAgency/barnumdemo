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
 begin
 aid:=public.save_appointment_team(null,null,jsonb_build_object('patient_id',t.patient_id,'professional_id',s.primary_professional_id,'specialty_id',t.specialty_id,'consultation_type_id',s.consultation_type_id,'date',slot->>'date','time',slot->>'time','duration',s.duration,'status','confirmed'),extras);
 exception when check_violation then raise exception 'session_unavailable: %',s.id using errcode='23514';end;
 update public.treatment_sessions set appointment_id=aid,version=version+1,updated_at=now() where id=s.id;
 end if;
 outcome:=outcome||jsonb_build_array(jsonb_build_object('session_id',s.id,'appointment_id',aid));
 end loop;
 return outcome;
end $$;

create function public.link_treatment_appointment(p_session_id uuid,p_expected_version bigint,p_appointment_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.treatment_sessions;t public.treatments;a public.appointments;
begin
 if not barnun_private.treatment_manager() then raise exception 'forbidden' using errcode='42501';end if;
 select t0.* into t from public.treatments t0 join public.treatment_sessions s0 on s0.treatment_id=t0.id where s0.id=p_session_id for update of t0;
 if not found or t.status<>'active' then raise exception 'treatment_closed';end if;
 select * into s from public.treatment_sessions where id=p_session_id for update;
 if s.appointment_id=p_appointment_id then return p_appointment_id;end if;
 if s.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if s.appointment_id is not null or s.disposition='omitted' then raise exception 'session_locked';end if;
 select * into a from public.appointments where id=p_appointment_id for update;
 if not found or a.patient_id<>t.patient_id or a.specialty_id<>t.specialty_id then raise exception 'patient_or_specialty_mismatch';end if;
 update public.treatment_sessions set appointment_id=a.id,version=version+1,updated_at=now() where id=s.id;
 return a.id;
end $$;

-- Guard the invariant even when appointments are edited outside the treatment UI.
create function barnun_private.guard_treatment_patient_link() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='appointments' then
 if exists(select 1 from public.treatment_sessions s join public.treatments t on t.id=s.treatment_id where s.appointment_id=new.id and (t.patient_id<>new.patient_id or t.specialty_id<>new.specialty_id)) then raise exception 'patient_or_specialty_mismatch';end if;
 else
 if new.appointment_id is not null and not exists(select 1 from public.appointments a join public.treatments t on t.id=new.treatment_id where a.id=new.appointment_id and a.patient_id=t.patient_id and a.specialty_id=t.specialty_id) then raise exception 'patient_or_specialty_mismatch';end if;
 end if;
 return new;
end $$;
create trigger guard_treatment_patient_link before update of patient_id,specialty_id on public.appointments for each row execute function barnun_private.guard_treatment_patient_link();
create trigger guard_treatment_session_link before insert or update of appointment_id,treatment_id on public.treatment_sessions for each row execute function barnun_private.guard_treatment_patient_link();
revoke all on function barnun_private.guard_treatment_patient_link() from public,anon,authenticated;
revoke all on function public.book_treatment_sessions(uuid,jsonb),public.link_treatment_appointment(uuid,bigint,uuid) from public,anon;
grant execute on function public.book_treatment_sessions(uuid,jsonb),public.link_treatment_appointment(uuid,bigint,uuid) to authenticated;
commit;
