begin;
alter table public.appointments add column finalized_by uuid references auth.users(id) on delete set null;
drop function public.set_appointment_state(uuid,bigint,public.appointment_status,text);
create function public.set_appointment_state(p_appointment_id uuid,p_expected_version bigint,p_status public.appointment_status,p_final_notes text default null,p_send_review boolean default null)
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
   final_notes=case when p_status='completed' then p_final_notes else final_notes end,
   send_review=case when p_status='completed' then coalesce(p_send_review,send_review) else send_review end,
   finalized_by=case when p_status='completed' then auth.uid() else finalized_by end,
   finalized_at=case when p_status='completed' then now() else finalized_at end where id=a.id;
 return a.id;
end;
$$;
revoke all on function public.set_appointment_state(uuid,bigint,public.appointment_status,text,boolean) from public,anon;
grant execute on function public.set_appointment_state(uuid,bigint,public.appointment_status,text,boolean) to authenticated,service_role;

-- Preserve the existing management-only deletion policy; doctors still have no DELETE policy.
grant delete on public.appointments to authenticated;

create function barnun_private.guard_note_author() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.author_user_id,new.appointment_id) is distinct from (old.author_user_id,old.appointment_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.author_user_id<>auth.uid() then raise exception 'forbidden' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function barnun_private.guard_note_author() from public,anon,authenticated;
create trigger guard_note_author before insert or update on public.appointment_notes for each row execute function barnun_private.guard_note_author();

-- Existing schema contains several redundant primary-professional FKs, including
-- cascading ones. Preserve historical consultations when a collaborator is removed.
do $$ declare constraint_name text; begin
 for constraint_name in select conname from pg_constraint where conrelid='public.appointments'::regclass
 and confrelid='public.professionals'::regclass and contype='f' loop
   execute format('alter table public.appointments drop constraint %I',constraint_name);
 end loop;
 alter table public.appointments add constraint appointments_professional_id_fkey foreign key(professional_id) references public.professionals(id) on delete restrict;
end $$;

drop policy if exists "Users can read own relevant notifications" on public.notifications;
create policy "Users can read own relevant notifications" on public.notifications for select to authenticated
using (user_id=auth.uid() and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'secretary') or barnun_private.is_appointment_participant(appointment_id)));

do $$ declare relation_name text; begin
 for relation_name in select unnest(array['appointments','appointment_additional_professionals','appointment_notes','appointment_requests','patients','notifications']) loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=relation_name) then
     execute format('alter publication supabase_realtime add table public.%I',relation_name);
   end if;
 end loop;
end $$;
commit;
