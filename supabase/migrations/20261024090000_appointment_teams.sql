begin;

alter table public.appointments add column version bigint not null default 1;

create table public.appointment_additional_professionals (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  professional_name text not null,
  primary key (appointment_id, professional_id)
);
create index appointment_additional_professionals_professional_idx
  on public.appointment_additional_professionals(professional_id, appointment_id);
alter table public.appointment_additional_professionals enable row level security;
revoke all on public.appointment_additional_professionals from public, anon, authenticated;
grant select on public.appointment_additional_professionals to authenticated;
grant all on public.appointment_additional_professionals to service_role;

-- The private predicate avoids circular RLS evaluation between appointments and participants.
create schema if not exists barnun_private;
revoke all on schema barnun_private from public, anon;
grant usage on schema barnun_private to authenticated;

create function barnun_private.is_appointment_participant(p_appointment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.appointments a
    join public.professionals p on p.id = a.professional_id
    where a.id = p_appointment_id and p.user_id = auth.uid()
  ) or exists (
    select 1 from public.appointment_additional_professionals ap
    join public.professionals p on p.id = ap.professional_id
    where ap.appointment_id = p_appointment_id and p.user_id = auth.uid()
  );
$$;
revoke all on function barnun_private.is_appointment_participant(uuid) from public, anon;
grant execute on function barnun_private.is_appointment_participant(uuid) to authenticated;

create policy "Staff read appointment team" on public.appointment_additional_professionals
for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'secretary')
  or (public.has_role(auth.uid(), 'doctor') and barnun_private.is_appointment_participant(appointment_id))
);
create policy "Participants read shared appointments" on public.appointments
for select to authenticated using (
  public.has_role(auth.uid(), 'doctor') and barnun_private.is_appointment_participant(id)
);

-- A deferred check also protects primary changes made by privileged integrations.
create function barnun_private.check_distinct_appointment_team()
returns trigger language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if tg_table_name = 'appointments' then v_id := new.id;
  else v_id := new.appointment_id; end if;
  if exists (
    select 1 from public.appointment_additional_professionals ap
    join public.appointments a on a.id = ap.appointment_id
    where a.id = v_id and ap.professional_id = a.professional_id
  ) then raise exception 'duplicate_professional' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function barnun_private.check_distinct_appointment_team() from public, anon, authenticated;
create constraint trigger check_distinct_appointment_additional
after insert or update on public.appointment_additional_professionals
deferrable initially deferred for each row execute function barnun_private.check_distinct_appointment_team();
create constraint trigger check_distinct_appointment_primary
after update on public.appointments
deferrable initially deferred for each row execute function barnun_private.check_distinct_appointment_team();

commit;
