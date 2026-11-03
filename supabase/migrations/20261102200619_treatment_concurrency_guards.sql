begin;
create or replace function public.save_treatment_comment(p_id uuid,p_expected_version bigint,p_session_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.treatment_session_comments; author text;
 begin
 perform 1 from public.treatment_sessions where id=p_session_id for update;
 perform 1 from public.appointments where id=(select appointment_id from public.treatment_sessions where id=p_session_id) for update;
 if not barnun_private.can_write_session(p_session_id) then raise exception 'forbidden' using errcode='42501';end if;
 if length(btrim(coalesce(p_body,''))) not between 1 and 20000 then raise exception 'invalid_body';end if;
 select coalesce(nullif(full_name,''),'Colaborador') into author from public.user_profiles where user_id=auth.uid();author:=coalesce(author,'Colaborador');
 if p_id is null then
 insert into public.treatment_session_comments(session_id,author_user_id,author_name,body) values(p_session_id,auth.uid(),author,p_body) returning id into p_id;
 else
 select * into r from public.treatment_session_comments where id=p_id and session_id=p_session_id for update;
 if not found then raise exception 'not_found';end if;
 if r.author_user_id<>auth.uid() and not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501';end if;
 if r.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if r.body=p_body then return p_id;end if;
 insert into public.treatment_comment_revisions(comment_id,body,version,editor_user_id,editor_name) values(r.id,r.body,r.version,auth.uid(),author);
 update public.treatment_session_comments set body=p_body,version=version+1,updated_at=now() where id=p_id;
 end if;
 return p_id;
 end $$;
create or replace function public.save_clinical_observation(p_id uuid,p_expected_version bigint,p_appointment_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.appointment_clinical_observations; author text;
 begin
 perform 1 from public.appointments where id=p_appointment_id for update;
 if not barnun_private.can_write_observation(p_appointment_id) then raise exception 'forbidden' using errcode='42501';end if;
 if length(btrim(coalesce(p_body,''))) not between 1 and 20000 then raise exception 'invalid_body';end if;
 select coalesce(nullif(full_name,''),'Colaborador') into author from public.user_profiles where user_id=auth.uid();author:=coalesce(author,'Colaborador');
 if p_id is null then
 insert into public.appointment_clinical_observations(appointment_id,author_user_id,author_name,body) values(p_appointment_id,auth.uid(),author,p_body) returning id into p_id;
 else
 select * into r from public.appointment_clinical_observations where id=p_id and appointment_id=p_appointment_id for update;
 if not found then raise exception 'not_found';end if;
 if r.author_user_id<>auth.uid() and not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501';end if;
 if r.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if r.body=p_body then return p_id;end if;
 insert into public.clinical_observation_revisions(observation_id,body,version,editor_user_id,editor_name) values(r.id,r.body,r.version,auth.uid(),author);
 update public.appointment_clinical_observations set body=p_body,version=version+1,updated_at=now() where id=p_id;
 end if;
 return p_id;
 end $$;
create or replace function public.finalize_appointment_with_observation(p_appointment_id uuid,p_expected_version bigint,p_final_notes text,p_send_review boolean,p_internal_observation text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
 perform 1 from public.appointments where id=p_appointment_id for update;
 if not barnun_private.can_write_observation(p_appointment_id) then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from public.appointments where id=p_appointment_id for update;
 if not found then raise exception 'not_found';end if;
 if a.status='completed' then return a.id;end if;
 if a.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if length(btrim(coalesce(p_internal_observation,'')))>0 then perform public.save_clinical_observation(null,null,a.id,p_internal_observation);end if;
 return public.set_appointment_state(a.id,p_expected_version,'completed',p_final_notes,p_send_review);
end $$;
-- Runs after guard_appointment_booking, which acquires professional locks.
-- Do not change avulsa-versus-avulsa policy; protect every treatment reservation.
create function barnun_private.guard_treatment_patient_slot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status not in ('confirmed','waiting','in_progress') then return new;end if;
 if tg_op='UPDATE' and (new.patient_id,new.date,new.time,new.duration) is not distinct from (old.patient_id,old.date,old.time,old.duration)
 and old.status in ('confirmed','waiting','in_progress') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('barnun-patient:'||new.patient_id::text,0));
 if exists(select 1 from public.appointments a where a.id<>new.id and a.patient_id=new.patient_id and a.status in ('confirmed','waiting','in_progress')
 and (a.date+a.time)<(new.date+new.time+make_interval(mins=>new.duration))
 and (a.date+a.time+make_interval(mins=>a.duration))>(new.date+new.time)
 and (exists(select 1 from public.treatment_sessions s where s.appointment_id=a.id) or exists(select 1 from public.treatment_sessions s where s.appointment_id=new.id))) then
 raise exception 'patient_unavailable' using errcode='23514';end if;
 return new;
end $$;
revoke all on function barnun_private.guard_treatment_patient_slot() from public,anon,authenticated;
create trigger zz_guard_treatment_patient_slot before insert or update of patient_id,date,time,duration,status on public.appointments for each row execute function barnun_private.guard_treatment_patient_slot();
commit;