begin;
create table public.treatment_session_comments (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.treatment_sessions(id) on delete restrict,
 author_user_id uuid not null references auth.users(id) on delete restrict, author_name text not null,
 body text not null check(length(btrim(body)) between 1 and 20000),version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
 create index treatment_session_comments_parent_idx on public.treatment_session_comments(session_id);
 create table public.treatment_comment_revisions (
 id uuid primary key default gen_random_uuid(), comment_id uuid not null references public.treatment_session_comments(id) on delete restrict,
 body text not null,version bigint not null,editor_user_id uuid not null references auth.users(id) on delete restrict,
 editor_name text not null,created_at timestamptz not null default now(), unique(comment_id,version));
create table public.appointment_clinical_observations (
 id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments(id) on delete restrict,
 author_user_id uuid not null references auth.users(id) on delete restrict, author_name text not null,
 body text not null check(length(btrim(body)) between 1 and 20000),version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
 create index appointment_clinical_observations_parent_idx on public.appointment_clinical_observations(appointment_id);
 create table public.clinical_observation_revisions (
 id uuid primary key default gen_random_uuid(), observation_id uuid not null references public.appointment_clinical_observations(id) on delete restrict,
 body text not null,version bigint not null,editor_user_id uuid not null references auth.users(id) on delete restrict,
 editor_name text not null,created_at timestamptz not null default now(), unique(observation_id,version));
create function barnun_private.can_write_observation(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select barnun_private.treatment_manager() or (public.has_role(auth.uid(),'doctor') and barnun_private.is_appointment_participant(p_id));
$$;
revoke all on function barnun_private.can_write_observation(uuid) from public,anon;
grant execute on function barnun_private.can_write_observation(uuid) to authenticated;
alter table public.treatment_session_comments enable row level security;
 revoke all on public.treatment_session_comments from anon,authenticated;grant select on public.treatment_session_comments to authenticated;
 create policy staff_read on public.treatment_session_comments for select to authenticated using(barnun_private.treatment_staff());
alter table public.treatment_comment_revisions enable row level security;
 revoke all on public.treatment_comment_revisions from anon,authenticated;grant select on public.treatment_comment_revisions to authenticated;
 create policy staff_read on public.treatment_comment_revisions for select to authenticated using(barnun_private.treatment_staff());
create function public.save_treatment_comment(p_id uuid,p_expected_version bigint,p_session_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.treatment_session_comments; author text;
 begin
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
 revoke all on function public.save_treatment_comment(uuid,bigint,uuid,text) from public,anon;
 grant execute on function public.save_treatment_comment(uuid,bigint,uuid,text) to authenticated;
 create function public.get_treatment_comment_revisions(p_comment_id uuid) returns setof public.treatment_comment_revisions language plpgsql stable security definer set search_path='' as $$
 begin
 if not barnun_private.treatment_staff() then raise exception 'forbidden' using errcode='42501';end if;
 return query select * from public.treatment_comment_revisions where comment_id=p_comment_id order by version desc;
 end $$;
 revoke all on function public.get_treatment_comment_revisions(uuid) from public,anon;
 grant execute on function public.get_treatment_comment_revisions(uuid) to authenticated;
alter table public.appointment_clinical_observations enable row level security;
 revoke all on public.appointment_clinical_observations from anon,authenticated;grant select on public.appointment_clinical_observations to authenticated;
 create policy staff_read on public.appointment_clinical_observations for select to authenticated using(barnun_private.treatment_staff());
alter table public.clinical_observation_revisions enable row level security;
 revoke all on public.clinical_observation_revisions from anon,authenticated;grant select on public.clinical_observation_revisions to authenticated;
 create policy staff_read on public.clinical_observation_revisions for select to authenticated using(barnun_private.treatment_staff());
create function public.save_clinical_observation(p_id uuid,p_expected_version bigint,p_appointment_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.appointment_clinical_observations; author text;
 begin
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
 revoke all on function public.save_clinical_observation(uuid,bigint,uuid,text) from public,anon;
 grant execute on function public.save_clinical_observation(uuid,bigint,uuid,text) to authenticated;
 create function public.get_clinical_observation_revisions(p_observation_id uuid) returns setof public.clinical_observation_revisions language plpgsql stable security definer set search_path='' as $$
 begin
 if not barnun_private.treatment_staff() then raise exception 'forbidden' using errcode='42501';end if;
 return query select * from public.clinical_observation_revisions where observation_id=p_observation_id order by version desc;
 end $$;
 revoke all on function public.get_clinical_observation_revisions(uuid) from public,anon;
 grant execute on function public.get_clinical_observation_revisions(uuid) to authenticated;
create function public.finalize_appointment_with_observation(p_appointment_id uuid,p_expected_version bigint,p_final_notes text,p_send_review boolean,p_internal_observation text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
 if not barnun_private.can_write_observation(p_appointment_id) then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from public.appointments where id=p_appointment_id for update;
 if not found then raise exception 'not_found';end if;
 if a.status='completed' then return a.id;end if;
 if a.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if length(btrim(coalesce(p_internal_observation,'')))>0 then perform public.save_clinical_observation(null,null,a.id,p_internal_observation);end if;
 return public.set_appointment_state(a.id,p_expected_version,'completed',p_final_notes,p_send_review);
end $$;
revoke all on function public.finalize_appointment_with_observation(uuid,bigint,text,boolean,text) from public,anon;
grant execute on function public.finalize_appointment_with_observation(uuid,bigint,text,boolean,text) to authenticated;

-- Read only the appointment fields needed by the treatment view, not all personal data or external notes.
create function public.get_treatment_session_context(p_treatment_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not barnun_private.treatment_staff() then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('session',to_jsonb(s),'can_write',barnun_private.can_write_session(s.id),
 'additional_professional_ids',coalesce((select jsonb_agg(sp.professional_id) from public.treatment_session_professionals sp where sp.session_id=s.id),'[]'),
 'appointment',case when a.id is null then null else jsonb_build_object('id',a.id,'date',a.date,'time',a.time,'duration',a.duration,'status',a.status,'version',a.version,'professional_id',a.professional_id,'consultation_type_id',a.consultation_type_id,'professional_names',a.professional_names,'additional_professional_ids',coalesce((select jsonb_agg(ap.professional_id) from public.appointment_additional_professionals ap where ap.appointment_id=a.id),'[]')) end) order by s.ordinal)
 from public.treatment_sessions s left join public.appointments a on a.id=s.appointment_id where s.treatment_id=p_treatment_id),'[]');
end $$;
revoke all on function public.get_treatment_session_context(uuid) from public,anon;
grant execute on function public.get_treatment_session_context(uuid) to authenticated;
commit;
