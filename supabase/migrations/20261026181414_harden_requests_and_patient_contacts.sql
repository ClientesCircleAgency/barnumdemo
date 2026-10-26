begin;
-- Managers retain their separate management policy. Public submissions start pending.
alter policy "Public can insert appointment_requests" on public.appointment_requests
with check (
 status='pending'
 and coalesce(suggested_slots,'[]'::jsonb)='[]'::jsonb
 and accepted_slot is null and rejection_reason is null
 and assigned_professional_id is null and suggestion_expires_at is null
 and cancel_reason is null
);
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
   final_notes=case when p_status='completed' then coalesce(nullif(btrim(p_final_notes),''),final_notes) else final_notes end,
   send_review=case when p_status='completed' then coalesce(p_send_review,send_review) else send_review end,
   finalized_by=case when p_status='completed' then coalesce(finalized_by,auth.uid()) else finalized_by end,
   finalized_at=case when p_status='completed' then coalesce(finalized_at,now()) else finalized_at end where id=a.id;
 return a.id;
end;
$$;
revoke all on function public.set_appointment_state(uuid,bigint,public.appointment_status,text,boolean) from public,anon;
grant execute on function public.set_appointment_state(uuid,bigint,public.appointment_status,text,boolean) to authenticated,service_role;

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
 on conflict(nif) do nothing returning id into patient;
 if patient is null then select id into patient from public.patients where nif=new.nif; end if;
 if patient is null then raise exception 'patient_not_found'; end if;
 appointment := public.save_appointment_team(null,null,jsonb_build_object(
   'patient_id',patient,'professional_id',main,'specialty_id',new.specialty_id,'consultation_type_id',typ,
   'date',slot->>'date','time',slot->>'time','duration',coalesce((slot->>'duration')::integer,new.estimated_duration,30),
   'status','confirmed','reason',new.reason,'notes','Convertido de pedido online.'),extras);
 update public.appointments set source_request_id=new.id where id=appointment;
 return new;
end;
$$;


-- No historical bulk backfill: only explicit patient contact corrections propagate.
-- Completed review-enabled appointments are included because n8n owns delivery state.
create or replace function barnun_private.sync_patient_appointment_contacts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.appointments
 set patient_name=new.name, patient_phone=new.phone
 where patient_id=new.id
   and (status::text in ('scheduled','pre_confirmed','confirmed','waiting','in_progress')
        or (status='completed' and send_review))
   and (patient_name is distinct from new.name or patient_phone is distinct from new.phone);
 return new;
end;
$$;
revoke all on function barnun_private.sync_patient_appointment_contacts() from public,anon,authenticated;
create trigger sync_patient_appointment_contacts
 after update of name,phone on public.patients for each row
 when (old.name is distinct from new.name or old.phone is distinct from new.phone)
 execute function barnun_private.sync_patient_appointment_contacts();
commit;
