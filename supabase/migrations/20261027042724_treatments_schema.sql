begin;
create table public.treatments (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id) on delete restrict,
 specialty_id uuid not null references public.specialties(id) on delete restrict,
 primary_professional_id uuid not null references public.professionals(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 200), objective text not null default '' check(length(objective)<=20000),
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 version bigint not null default 1, created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 closed_by uuid references auth.users(id) on delete restrict, closed_at timestamptz
);
create table public.treatment_professionals (
 treatment_id uuid not null references public.treatments(id) on delete restrict,
 professional_id uuid not null references public.professionals(id) on delete restrict, primary key(treatment_id,professional_id)
);
create table public.treatment_sessions (
 id uuid primary key default gen_random_uuid(), treatment_id uuid not null references public.treatments(id) on delete restrict,
 ordinal integer not null check(ordinal>0), name text not null check(length(btrim(name)) between 1 and 200),
 kind text not null check(kind in ('consultation','surgery')),
 consultation_type_id uuid not null references public.consultation_types(id) on delete restrict,
 duration integer not null check(duration between 1 and 1440),
 primary_professional_id uuid not null references public.professionals(id) on delete restrict,
 appointment_id uuid unique references public.appointments(id) on delete restrict,
 disposition text not null default 'planned' check(disposition in ('planned','omitted')),
 omission_reason text, version bigint not null default 1,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(treatment_id,ordinal), check(disposition<>'omitted' or (appointment_id is null and length(btrim(omission_reason))>0))
);
create table public.treatment_session_professionals (
 session_id uuid not null references public.treatment_sessions(id) on delete restrict,
 professional_id uuid not null references public.professionals(id) on delete restrict,primary key(session_id,professional_id)
);
create table public.treatment_state_events (
 id uuid primary key default gen_random_uuid(),treatment_id uuid not null references public.treatments(id) on delete restrict,
 old_status text not null,new_status text not null,author_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index treatments_patient_idx on public.treatments(patient_id);
create index treatment_professionals_user_idx on public.treatment_professionals(professional_id);
create index treatment_session_professionals_prof_idx on public.treatment_session_professionals(professional_id);
create index treatment_state_events_parent_idx on public.treatment_state_events(treatment_id);

create function barnun_private.treatment_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'secretary') or public.has_role(auth.uid(),'doctor'));
$$;
create function barnun_private.treatment_manager() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'secretary'));
$$;
create function barnun_private.can_write_session(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select barnun_private.treatment_manager() or (public.has_role(auth.uid(),'doctor') and exists(
 select 1 from public.treatment_sessions s where s.id=p_id and
 case when s.appointment_id is not null then barnun_private.is_appointment_participant(s.appointment_id)
 else exists(select 1 from public.professionals p where p.user_id=auth.uid() and (p.id=s.primary_professional_id or exists(select 1 from public.treatment_session_professionals sp where sp.session_id=s.id and sp.professional_id=p.id))) end));
$$;
revoke all on function barnun_private.treatment_staff(),barnun_private.treatment_manager(),barnun_private.can_write_session(uuid) from public,anon;
grant execute on function barnun_private.treatment_staff(),barnun_private.can_write_session(uuid) to authenticated;
do $$ declare t text; begin
 foreach t in array array['treatments','treatment_professionals','treatment_sessions','treatment_session_professionals','treatment_state_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using (barnun_private.treatment_staff())',t);
 end loop;
end $$;

create function barnun_private.validate_treatment_team(p_specialty uuid,p_primary uuid,p_extras uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]:=array[p_primary]||coalesce(p_extras,'{}'); x uuid;
begin
 if p_primary is null or array_position(ids,null) is not null or cardinality(ids)<>(select count(distinct v) from unnest(ids) v) then raise exception 'invalid_team'; end if;
 foreach x in array ids loop
 if not exists(select 1 from public.professionals p where p.id=x and p.is_active and (p.specialty_id=p_specialty or exists(select 1 from public.professional_specialties ps where ps.professional_id=p.id and ps.specialty_id=p_specialty))) then raise exception 'invalid_professional'; end if;
 end loop;
end $$;
revoke all on function barnun_private.validate_treatment_team(uuid,uuid,uuid[]) from public,anon,authenticated;

create function public.save_treatment(p_id uuid,p_expected_version bigint,p_fields jsonb,p_professional_ids uuid[],p_primary_professional_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.treatments; extras uuid[];
begin
 if not barnun_private.treatment_manager() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is not null then
 select * into r from public.treatments where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if r.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001'; end if;
 if r.status<>'active' then raise exception 'treatment_closed'; end if;
 if p_fields ? 'patient_id' and (p_fields->>'patient_id')::uuid is distinct from r.patient_id then raise exception 'patient_immutable'; end if;
 else r.id:=gen_random_uuid();r.patient_id:=(p_fields->>'patient_id')::uuid; end if;
 if exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('patient_id','specialty_id','name','objective')) then raise exception 'invalid_field'; end if;
 r.name:=coalesce(p_fields->>'name',r.name);r.objective:=coalesce(p_fields->>'objective',r.objective,'');r.specialty_id:=coalesce((p_fields->>'specialty_id')::uuid,r.specialty_id);
 if p_id is not null and r.specialty_id is distinct from (select specialty_id from public.treatments where id=p_id) and exists(select 1 from public.treatment_sessions where treatment_id=p_id) then raise exception 'specialty_in_use'; end if;
 if p_professional_ids is null or not p_primary_professional_id=any(p_professional_ids) or cardinality(p_professional_ids)<>(select count(distinct v) from unnest(p_professional_ids) v) then raise exception 'invalid_team'; end if;
 extras:=array_remove(p_professional_ids,p_primary_professional_id);
 perform barnun_private.validate_treatment_team(r.specialty_id,p_primary_professional_id,extras);
 if p_id is null then
 insert into public.treatments(id,patient_id,specialty_id,primary_professional_id,name,objective,created_by) values(r.id,r.patient_id,r.specialty_id,p_primary_professional_id,r.name,r.objective,auth.uid());
 else update public.treatments set name=r.name,objective=r.objective,specialty_id=r.specialty_id,primary_professional_id=p_primary_professional_id,version=version+1,updated_at=now() where id=r.id; end if;
 delete from public.treatment_professionals where treatment_id=r.id;
 insert into public.treatment_professionals select r.id,v from unnest(p_professional_ids) v;
 return r.id;
end $$;

create function public.save_treatment_session(p_id uuid,p_expected_version bigint,p_treatment_id uuid,p_fields jsonb,p_additional_professional_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.treatments;s public.treatment_sessions;
begin
 if not barnun_private.treatment_manager() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into t from public.treatments where id=p_treatment_id for update;
 if not found or t.status<>'active' then raise exception 'treatment_closed'; end if;
 if p_id is not null then
 select * into s from public.treatment_sessions where id=p_id and treatment_id=t.id for update;
 if not found then raise exception 'not_found'; end if;
 if s.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001'; end if;
 if s.appointment_id is not null or s.disposition='omitted' then raise exception 'session_locked'; end if;
 else s.id:=gen_random_uuid();end if;
 if exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('name','kind','ordinal','duration','consultation_type_id','primary_professional_id')) then raise exception 'invalid_field'; end if;
 s.name:=coalesce(p_fields->>'name',s.name);s.kind:=coalesce(p_fields->>'kind',s.kind,'consultation');
 s.ordinal:=coalesce((p_fields->>'ordinal')::int,s.ordinal,(select coalesce(max(ordinal),0)+1 from public.treatment_sessions where treatment_id=t.id));
 s.duration:=coalesce((p_fields->>'duration')::int,s.duration,30);s.consultation_type_id:=coalesce((p_fields->>'consultation_type_id')::uuid,s.consultation_type_id);
 s.primary_professional_id:=coalesce((p_fields->>'primary_professional_id')::uuid,s.primary_professional_id,t.primary_professional_id);
 if not exists(select 1 from public.consultation_types where id=s.consultation_type_id and specialty_id=t.specialty_id) then raise exception 'invalid_consultation_type'; end if;
 perform barnun_private.validate_treatment_team(t.specialty_id,s.primary_professional_id,p_additional_professional_ids);
 if p_id is null then
 insert into public.treatment_sessions(id,treatment_id,name,kind,ordinal,duration,consultation_type_id,primary_professional_id,created_by) values(s.id,t.id,s.name,s.kind,s.ordinal,s.duration,s.consultation_type_id,s.primary_professional_id,auth.uid());
 else update public.treatment_sessions set name=s.name,kind=s.kind,ordinal=s.ordinal,duration=s.duration,consultation_type_id=s.consultation_type_id,primary_professional_id=s.primary_professional_id,version=version+1,updated_at=now() where id=s.id;end if;
 delete from public.treatment_session_professionals where session_id=s.id;
 insert into public.treatment_session_professionals select s.id,v from unnest(coalesce(p_additional_professional_ids,'{}')) v;
 return s.id;
end $$;

create function public.omit_treatment_session(p_id uuid,p_expected_version bigint,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.treatment_sessions; tid uuid;
begin
 if not barnun_private.treatment_manager() then raise exception 'forbidden' using errcode='42501';end if;
 select treatment_id into tid from public.treatment_sessions where id=p_id;
 perform 1 from public.treatments where id=tid and status='active' for update;
 if not found then raise exception 'treatment_closed';end if;
 select * into s from public.treatment_sessions where id=p_id for update;
 if s.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if s.appointment_id is not null or length(btrim(coalesce(p_reason,'')))=0 then raise exception 'invalid_omission';end if;
 update public.treatment_sessions set disposition='omitted',omission_reason=p_reason,version=version+1,updated_at=now() where id=p_id;return p_id;
end $$;

create function public.set_treatment_state(p_id uuid,p_expected_version bigint,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.treatments;
begin
 if not (barnun_private.treatment_manager() or (public.has_role(auth.uid(),'doctor') and exists(select 1 from public.treatment_professionals tp join public.professionals p on p.id=tp.professional_id where tp.treatment_id=p_id and p.user_id=auth.uid()))) then raise exception 'forbidden' using errcode='42501';end if;
 select * into t from public.treatments where id=p_id for update;
 if not found then raise exception 'not_found';end if;
 if t.status=p_status then return p_id;end if;
 if t.version is distinct from p_expected_version then raise exception 'stale_version' using errcode='40001';end if;
 if p_status not in ('active','completed','cancelled') then raise exception 'invalid_status';end if;
 if p_status<>'active' and exists(select 1 from public.treatment_sessions s left join public.appointments a on a.id=s.appointment_id where s.treatment_id=t.id and s.disposition<>'omitted' and (a.id is null or a.status not in ('completed','cancelled','no_show'))) then raise exception 'pending_sessions';end if;
 update public.treatments set status=p_status,version=version+1,updated_at=now(),closed_by=case when p_status='active' then null else auth.uid() end,closed_at=case when p_status='active' then null else now() end where id=p_id;
 insert into public.treatment_state_events(treatment_id,old_status,new_status,author_user_id) values(p_id,t.status,p_status,auth.uid());return p_id;
end $$;

create function public.list_treatment_patient_directory(p_query text default '') returns table(patient_id uuid,patient_name text) language plpgsql stable security definer set search_path='' as $$
begin
 if not barnun_private.treatment_staff() then raise exception 'forbidden' using errcode='42501';end if;
 return query select p.id,p.name from public.patients p where exists(select 1 from public.treatments t where t.patient_id=p.id) and p.name ilike '%'||coalesce(p_query,'')||'%' order by p.name,p.id limit 50;
end $$;
revoke all on function public.save_treatment(uuid,bigint,jsonb,uuid[],uuid),public.save_treatment_session(uuid,bigint,uuid,jsonb,uuid[]),public.omit_treatment_session(uuid,bigint,text),public.set_treatment_state(uuid,bigint,text),public.list_treatment_patient_directory(text) from public,anon;
grant execute on function public.save_treatment(uuid,bigint,jsonb,uuid[],uuid),public.save_treatment_session(uuid,bigint,uuid,jsonb,uuid[]),public.omit_treatment_session(uuid,bigint,text),public.set_treatment_state(uuid,bigint,text),public.list_treatment_patient_directory(text) to authenticated;
commit;
