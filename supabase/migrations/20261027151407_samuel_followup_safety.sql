begin;
-- Public requests may only supply the eight fields used by the website.
revoke insert on public.appointment_requests from anon;
grant insert (name,email,phone,nif,specialty_id,reason,preferred_date,preferred_time) on public.appointment_requests to anon;
create or replace function public.set_appointment_state(p_appointment_id uuid,p_expected_version bigint,p_status public.appointment_status,p_final_notes text default null,p_send_review boolean default null)
returns uuid language plpgsql security definer set search_path='' as $$
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
   or (a.status='no_show' and p_status='waiting')
   or (a.status='completed' and p_status='in_progress')) then raise exception 'invalid_transition'; end if;
 update public.appointments set status=p_status,
   final_notes=case when p_status='completed' then case when p_final_notes is null then final_notes else nullif(btrim(p_final_notes),'') end else final_notes end,
   send_review=case when p_status='completed' then coalesce(p_send_review,send_review) else send_review end,
   finalized_by=case when p_status='completed' then coalesce(finalized_by,auth.uid()) else finalized_by end,
   finalized_at=case when p_status='completed' then coalesce(finalized_at,now()) else finalized_at end where id=a.id;
 return a.id;
end;
$$;
revoke all on function public.set_appointment_state(uuid,bigint,public.appointment_status,text,boolean) from public,anon;
grant execute on function public.set_appointment_state(uuid,bigint,public.appointment_status,text,boolean) to authenticated,service_role;


create or replace function barnun_private.sync_patient_appointment_contacts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.appointments
 set patient_name=new.name, patient_phone=new.phone
 where patient_id=new.id
   and (status::text in ('scheduled','pre_confirmed','confirmed','waiting','in_progress')
        or (status='completed' and send_review and finalized_at >= now()-interval '4 hours'))
   and (patient_name is distinct from new.name or patient_phone is distinct from new.phone);
 return new;
end;
$$;
revoke all on function barnun_private.sync_patient_appointment_contacts() from public,anon,authenticated;

create or replace function barnun_private.guard_appointment_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare prof uuid; reason text; ids uuid[];
begin
 if tg_op='UPDATE' then
   -- Contact refreshes do not invalidate an open booking form. All other changes still do.
   if (to_jsonb(new)-array['patient_name','patient_phone','updated_at','version']) =
      (to_jsonb(old)-array['patient_name','patient_phone','updated_at','version'])
      and (new.patient_name,new.patient_phone) is distinct from (old.patient_name,old.patient_phone) then
     new.version := old.version;
     return new;
   end if;
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
commit;
