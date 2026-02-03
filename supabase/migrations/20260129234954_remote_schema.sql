drop extension if exists "pg_net";

create type "public"."request_status" as enum ('pending', 'pre_confirmed', 'suggested', 'converted', 'cancelled', 'expired', 'rejected');

create type "public"."whatsapp_workflow_status" as enum ('pending', 'sent', 'delivered', 'responded', 'expired', 'failed', 'cancelled');

create type "public"."whatsapp_workflow_type" as enum ('pre_confirmation_sent', 'confirmation_24h', 'reschedule_prompt', 'slot_suggestion', 'request_cancelled');

drop trigger if exists "trigger_appointment_request_suggestion" on "public"."appointment_requests";

drop trigger if exists "trigger_send_appointment_suggestion" on "public"."appointment_suggestions";

drop trigger if exists "trigger_update_appointment_suggestions_updated_at" on "public"."appointment_suggestions";

drop trigger if exists "trigger_appointment_no_show_reschedule" on "public"."appointments";

drop trigger if exists "trigger_appointment_pre_confirmation" on "public"."appointments";

drop trigger if exists "trigger_appointment_review_reminder" on "public"."appointments";

drop trigger if exists "trigger_update_whatsapp_events_updated_at" on "public"."whatsapp_events";

drop policy "Admins can manage appointment requests" on "public"."appointment_requests";

drop policy "Anyone can submit appointment requests" on "public"."appointment_requests";

drop policy "Service role has full access to appointment_suggestions" on "public"."appointment_suggestions";

drop policy "Users can view their own appointment_suggestions" on "public"."appointment_suggestions";

drop policy "Admins can manage appointments" on "public"."appointments";

drop policy "Admins can manage clinic_settings" on "public"."clinic_settings";

drop policy "Admins can manage consultation_types" on "public"."consultation_types";

drop policy "Admins can manage contact messages" on "public"."contact_messages";

drop policy "Anyone can submit contact messages" on "public"."contact_messages";

drop policy "Admins can manage patients" on "public"."patients";

drop policy "Admins can manage professionals" on "public"."professionals";

drop policy "Admins can manage rooms" on "public"."rooms";

drop policy "Admins can manage specialties" on "public"."specialties";

drop policy "Admins can manage waitlist" on "public"."waitlist";

drop policy "Anyone can validate tokens" on "public"."whatsapp_action_tokens";

drop policy "Service role has full access to whatsapp_action_tokens" on "public"."whatsapp_action_tokens";

drop policy "Service role has full access to whatsapp_events" on "public"."whatsapp_events";

drop policy "Users can view whatsapp_events for their clinic" on "public"."whatsapp_events";

drop policy "Admins can manage whatsapp_workflows" on "public"."whatsapp_workflows";

alter table "public"."appointment_requests" drop constraint "appointment_requests_service_type_check";

alter table "public"."appointment_requests" drop constraint "appointment_requests_status_check";

alter table "public"."contact_messages" drop constraint "contact_messages_status_check";

alter table "public"."whatsapp_workflows" drop constraint "whatsapp_workflows_status_check";

alter table "public"."whatsapp_workflows" drop constraint "whatsapp_workflows_workflow_type_check";

alter table "public"."appointments" drop constraint "appointments_consultation_type_id_fkey";

drop function if exists "public"."trigger_appointment_suggestion_event"();

drop function if exists "public"."trigger_no_show_reschedule_event"();

drop function if exists "public"."trigger_pre_confirmation_event"();

drop function if exists "public"."trigger_review_reminder_event"();

drop function if exists "public"."trigger_send_appointment_suggestion"();

drop function if exists "public"."update_whatsapp_events_updated_at"();

drop index if exists "public"."idx_appointment_suggestions_request";

drop index if exists "public"."idx_appointment_suggestions_status";

drop index if exists "public"."idx_whatsapp_action_tokens_appointment";

drop index if exists "public"."idx_whatsapp_action_tokens_expires_at";

drop index if exists "public"."idx_whatsapp_events_scheduled_for";

drop index if exists "public"."idx_whatsapp_events_workflow";

drop index if exists "public"."idx_whatsapp_workflows_appointment";

drop index if exists "public"."idx_whatsapp_workflows_pending";

alter table "public"."appointments" alter column "status" drop default;

alter type "public"."app_role" rename to "app_role__old_version_to_be_dropped";

create type "public"."app_role" as enum ('admin', 'secretary', 'doctor');

alter type "public"."appointment_status" rename to "appointment_status__old_version_to_be_dropped";

create type "public"."appointment_status" as enum ('scheduled', 'pre_confirmed', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show');


  create table "public"."appointment_notes" (
    "id" uuid not null default gen_random_uuid(),
    "appointment_id" uuid not null,
    "author_user_id" uuid not null,
    "note" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."appointment_notes" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "type" text not null,
    "appointment_id" uuid,
    "title" text not null,
    "body" text,
    "is_read" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."user_profiles" (
    "user_id" uuid not null,
    "full_name" text not null,
    "photo_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_profiles" enable row level security;

alter table "public"."appointments" alter column status type "public"."appointment_status" using status::text::"public"."appointment_status";

alter table "public"."user_roles" alter column role type "public"."app_role" using role::text::"public"."app_role";

alter table "public"."appointments" alter column "status" set default 'scheduled'::public.appointment_status;

-- drop type "public"."app_role_old_version_to_be_dropped";

-- drop type "public"."appointment_status_old_version_to_be_dropped";

alter table "public"."appointment_requests" drop column "notes";

alter table "public"."appointment_requests" drop column "processed_at";

alter table "public"."appointment_requests" drop column "processed_by";

alter table "public"."appointment_requests" drop column "service_type";

alter table "public"."appointment_requests" add column "assigned_professional_id" uuid;

alter table "public"."appointment_requests" add column "cancel_reason" text;

alter table "public"."appointment_requests" add column "estimated_duration" integer;

alter table "public"."appointment_requests" add column "reason" text not null;

alter table "public"."appointment_requests" add column "specialty_id" uuid not null;

alter table "public"."appointment_requests" alter column "status" set default 'pending'::public.request_status;

alter table "public"."appointment_requests" alter column "status" set data type public.request_status using "status"::public.request_status;

alter table "public"."appointment_suggestions" alter column "created_at" drop not null;

alter table "public"."appointment_suggestions" alter column "expires_at" drop not null;

alter table "public"."appointment_suggestions" alter column "status" drop not null;

alter table "public"."appointment_suggestions" alter column "suggested_slots" set default '[]'::jsonb;

alter table "public"."appointment_suggestions" alter column "updated_at" drop not null;

alter table "public"."appointment_suggestions" disable row level security;

alter table "public"."appointments" add column "reason" text;

alter table "public"."appointments" alter column "consultation_type_id" drop not null;

alter table "public"."clinic_settings" add column "created_at" timestamp with time zone not null default now();

alter table "public"."contact_messages" drop column "status";

alter table "public"."contact_messages" add column "is_read" boolean not null default false;

alter table "public"."contact_messages" alter column "phone" drop not null;

alter table "public"."professionals" add column "user_id" uuid;

alter table "public"."whatsapp_action_tokens" alter column "created_at" drop not null;

alter table "public"."whatsapp_action_tokens" disable row level security;

alter table "public"."whatsapp_events" alter column "created_at" drop not null;

alter table "public"."whatsapp_events" alter column "max_retries" drop not null;

alter table "public"."whatsapp_events" alter column "payload" set default '{}'::jsonb;

alter table "public"."whatsapp_events" alter column "retry_count" drop not null;

alter table "public"."whatsapp_events" alter column "scheduled_for" drop not null;

alter table "public"."whatsapp_events" alter column "status" drop not null;

alter table "public"."whatsapp_events" alter column "updated_at" drop not null;

alter table "public"."whatsapp_events" disable row level security;

alter table "public"."whatsapp_workflows" drop column "patient_id";

alter table "public"."whatsapp_workflows" drop column "phone";

alter table "public"."whatsapp_workflows" add column "appointment_request_id" uuid;

alter table "public"."whatsapp_workflows" add column "patient_phone" text not null;

alter table "public"."whatsapp_workflows" alter column "scheduled_at" drop not null;

alter table "public"."whatsapp_workflows" alter column "status" set default 'pending'::public.whatsapp_workflow_status;

alter table "public"."whatsapp_workflows" alter column "status" set data type public.whatsapp_workflow_status using "status"::public.whatsapp_workflow_status;

alter table "public"."whatsapp_workflows" alter column "workflow_type" set data type public.whatsapp_workflow_type using "workflow_type"::public.whatsapp_workflow_type;

CREATE UNIQUE INDEX appointment_notes_pkey ON public.appointment_notes USING btree (id);

CREATE INDEX idx_appointment_notes_appointment ON public.appointment_notes USING btree (appointment_id);

CREATE INDEX idx_appointment_requests_created_at ON public.appointment_requests USING btree (created_at);

CREATE INDEX idx_appointment_requests_status ON public.appointment_requests USING btree (status);

CREATE INDEX idx_contact_messages_is_read ON public.contact_messages USING btree (is_read);

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read);

CREATE INDEX idx_professionals_specialty ON public.professionals USING btree (specialty_id);

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);

CREATE INDEX idx_whatsapp_events_scheduled ON public.whatsapp_events USING btree (scheduled_for);

CREATE INDEX idx_whatsapp_workflows_status_scheduled ON public.whatsapp_workflows USING btree (status, scheduled_at);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX professionals_user_id_key ON public.professionals USING btree (user_id);

CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (user_id);

alter table "public"."appointment_notes" add constraint "appointment_notes_pkey" PRIMARY KEY using index "appointment_notes_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."user_profiles" add constraint "user_profiles_pkey" PRIMARY KEY using index "user_profiles_pkey";

alter table "public"."appointment_notes" add constraint "appointment_notes_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE not valid;

alter table "public"."appointment_notes" validate constraint "appointment_notes_appointment_id_fkey";

alter table "public"."appointment_notes" add constraint "appointment_notes_author_user_id_fkey" FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."appointment_notes" validate constraint "appointment_notes_author_user_id_fkey";

alter table "public"."appointment_requests" add constraint "appointment_requests_assigned_professional_id_fkey" FOREIGN KEY (assigned_professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL not valid;

alter table "public"."appointment_requests" validate constraint "appointment_requests_assigned_professional_id_fkey";

alter table "public"."appointment_requests" add constraint "appointment_requests_specialty_id_fkey" FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE RESTRICT not valid;

alter table "public"."appointment_requests" validate constraint "appointment_requests_specialty_id_fkey";

alter table "public"."notifications" add constraint "notifications_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) not valid;

alter table "public"."notifications" validate constraint "notifications_appointment_id_fkey";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."professionals" add constraint "professionals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."professionals" validate constraint "professionals_user_id_fkey";

alter table "public"."professionals" add constraint "professionals_user_id_key" UNIQUE using index "professionals_user_id_key";

alter table "public"."user_profiles" add constraint "user_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_user_id_fkey";

alter table "public"."whatsapp_workflows" add constraint "whatsapp_workflows_appointment_request_id_fkey" FOREIGN KEY (appointment_request_id) REFERENCES public.appointment_requests(id) ON DELETE CASCADE not valid;

alter table "public"."whatsapp_workflows" validate constraint "whatsapp_workflows_appointment_request_id_fkey";

alter table "public"."appointments" add constraint "appointments_consultation_type_id_fkey" FOREIGN KEY (consultation_type_id) REFERENCES public.consultation_types(id) ON DELETE SET NULL not valid;

alter table "public"."appointments" validate constraint "appointments_consultation_type_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.notify_on_appointment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  notif_title text;
  notif_body text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    notif_type := 'appointment_created';
    notif_title := 'Nova consulta marcada';
    notif_body := 'Consulta criada para ' || new.date || ' às ' || new.time;
  else
    notif_type := 'appointment_updated';
    notif_title := 'Consulta atualizada';
    notif_body := 'Consulta atualizada para ' || new.date || ' às ' || new.time;
  end if;

  -- Create notifications for ALL staff users (admin/secretary/doctor)
  insert into public.notifications (user_id, type, appointment_id, title, body)
  select ur.user_id, notif_type, new.id, notif_title, notif_body
  from public.user_roles ur
  where ur.role in ('admin', 'secretary', 'doctor');

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_staff_on_appointment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  notif_title text;
  notif_body text;
  patient_label text;
begin
  -- Try to get a patient label safely (fallback to 'Paciente' if any issue)
  begin
    -- If patients has 'name', this works; if not, it will fail and we fallback
    select p.name into patient_label
    from public.patients p
    where p.id = new.patient_id;
  exception when others then
    patient_label := null;
  end;

  patient_label := coalesce(patient_label, 'Paciente');

  if tg_op = 'INSERT' then
    notif_title := 'Nova consulta marcada';
    notif_body := format(
      'Consulta marcada para %s em %s às %s',
      patient_label,
      to_char(new.date::date, 'DD/MM/YYYY'),
      substring(new.time::text from 1 for 5)
    );

  elsif tg_op = 'UPDATE' then
    -- Only notify on meaningful changes
    if (old.status is distinct from new.status)
      or (old.date is distinct from new.date)
      or (old.time is distinct from new.time)
    then
      notif_title := 'Consulta alterada';

      if old.status is distinct from new.status then
        notif_body := format(
          'Estado da consulta de %s: %s → %s',
          patient_label,
          old.status::text,
          new.status::text
        );
      elsif (old.date is distinct from new.date) or (old.time is distinct from new.time) then
        notif_body := format(
          'Consulta de %s reagendada para %s às %s',
          patient_label,
          to_char(new.date::date, 'DD/MM/YYYY'),
          substring(new.time::text from 1 for 5)
        );
      else
        notif_body := format('Consulta de %s atualizada', patient_label);
      end if;
    else
      return new; -- no meaningful change
    end if;
  end if;

  -- Notify all staff roles
  insert into public.notifications (user_id, type, appointment_id, title, body)
  select
    ur.user_id,
    case when tg_op = 'INSERT' then 'appointment_created' else 'appointment_updated' end,
    new.id,
    notif_title,
    notif_body
  from public.user_roles ur
  where ur.role in ('admin', 'secretary', 'doctor');

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_no_show()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- Cast enum to text for comparison
  IF OLD.status::text != 'no_show' AND NEW.status::text = 'no_show' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'reschedule_no_show', now() + interval '1 hour')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.no_show_reschedule', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_pre_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- Check against REAL enum values from public.appointment_status
  IF NEW.status::text IN ('scheduled', 'confirmed', 'pre_confirmed') THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'pre_confirmation', now())
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- Cast enum to text for comparison
  IF OLD.status::text != 'completed' AND NEW.status::text = 'completed' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'review_2h', now() + interval '2 hours')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.review_reminder', 'appointment', NEW.id, v_wf_id, now() + interval '2 hours');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_whatsapp_event(p_event_type text, p_entity_type text, p_entity_id uuid, p_workflow_id uuid DEFAULT NULL::uuid, p_scheduled_for timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.whatsapp_events (event_type, entity_type, entity_id, workflow_id, payload, scheduled_for)
  VALUES (p_event_type, p_entity_type, p_entity_id, p_workflow_id, 
          jsonb_build_object('event_type', p_event_type, 'entity_id', p_entity_id, 'created_at', now()), 
          p_scheduled_for)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_action_token(p_action_type text, p_appointment_id uuid, p_patient_id uuid, p_workflow_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT NULL::jsonb, p_expires_in_days integer DEFAULT 7)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_token text;
BEGIN
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  INSERT INTO public.whatsapp_action_tokens (token, action_type, appointment_id, patient_id, workflow_id, metadata, expires_at)
  VALUES (v_token, p_action_type, p_appointment_id, p_patient_id, p_workflow_id, p_metadata, now() + (p_expires_in_days || ' days')::interval);
  
  RETURN v_token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_action_token(p_token text)
 RETURNS TABLE(valid boolean, appointment_id uuid, patient_id uuid, action_type text, metadata jsonb, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rec record;
BEGIN
  SELECT * INTO v_rec FROM public.whatsapp_action_tokens WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token not found'::text;
    RETURN;
  END IF;
  
  IF v_rec.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Already used'::text;
    RETURN;
  END IF;
  
  IF v_rec.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Expired'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_rec.appointment_id, v_rec.patient_id, v_rec.action_type, v_rec.metadata, NULL::text;
END;
$function$
;

grant delete on table "public"."appointment_notes" to "anon";

grant insert on table "public"."appointment_notes" to "anon";

grant references on table "public"."appointment_notes" to "anon";

grant select on table "public"."appointment_notes" to "anon";

grant trigger on table "public"."appointment_notes" to "anon";

grant truncate on table "public"."appointment_notes" to "anon";

grant update on table "public"."appointment_notes" to "anon";

grant delete on table "public"."appointment_notes" to "authenticated";

grant insert on table "public"."appointment_notes" to "authenticated";

grant references on table "public"."appointment_notes" to "authenticated";

grant select on table "public"."appointment_notes" to "authenticated";

grant trigger on table "public"."appointment_notes" to "authenticated";

grant truncate on table "public"."appointment_notes" to "authenticated";

grant update on table "public"."appointment_notes" to "authenticated";

grant delete on table "public"."appointment_notes" to "service_role";

grant insert on table "public"."appointment_notes" to "service_role";

grant references on table "public"."appointment_notes" to "service_role";

grant select on table "public"."appointment_notes" to "service_role";

grant trigger on table "public"."appointment_notes" to "service_role";

grant truncate on table "public"."appointment_notes" to "service_role";

grant update on table "public"."appointment_notes" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."user_profiles" to "anon";

grant insert on table "public"."user_profiles" to "anon";

grant references on table "public"."user_profiles" to "anon";

grant select on table "public"."user_profiles" to "anon";

grant trigger on table "public"."user_profiles" to "anon";

grant truncate on table "public"."user_profiles" to "anon";

grant update on table "public"."user_profiles" to "anon";

grant delete on table "public"."user_profiles" to "authenticated";

grant insert on table "public"."user_profiles" to "authenticated";

grant references on table "public"."user_profiles" to "authenticated";

grant select on table "public"."user_profiles" to "authenticated";

grant trigger on table "public"."user_profiles" to "authenticated";

grant truncate on table "public"."user_profiles" to "authenticated";

grant update on table "public"."user_profiles" to "authenticated";

grant delete on table "public"."user_profiles" to "service_role";

grant insert on table "public"."user_profiles" to "service_role";

grant references on table "public"."user_profiles" to "service_role";

grant select on table "public"."user_profiles" to "service_role";

grant trigger on table "public"."user_profiles" to "service_role";

grant truncate on table "public"."user_profiles" to "service_role";

grant update on table "public"."user_profiles" to "service_role";


  create policy "Admin/Secretary manage appointment_notes"
  on "public"."appointment_notes"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Doctor can create notes for own appointments"
  on "public"."appointment_notes"
  as permissive
  for insert
  to authenticated
with check ((public.has_role(auth.uid(), 'doctor'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.appointments a
     JOIN public.professionals p ON ((p.id = a.professional_id)))
  WHERE ((a.id = appointment_notes.appointment_id) AND (p.user_id = auth.uid()))))));



  create policy "Doctor can view notes for own appointments"
  on "public"."appointment_notes"
  as permissive
  for select
  to authenticated
using ((public.has_role(auth.uid(), 'doctor'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.appointments a
     JOIN public.professionals p ON ((p.id = a.professional_id)))
  WHERE ((a.id = appointment_notes.appointment_id) AND (p.user_id = auth.uid()))))));



  create policy "Admin/Secretary manage appointment_requests"
  on "public"."appointment_requests"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Public can insert appointment_requests"
  on "public"."appointment_requests"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Admin/Secretary manage appointments"
  on "public"."appointments"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Doctor can update own appointments"
  on "public"."appointments"
  as permissive
  for update
  to authenticated
using ((public.has_role(auth.uid(), 'doctor'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.professionals p
  WHERE ((p.id = appointments.professional_id) AND (p.user_id = auth.uid()))))))
with check ((public.has_role(auth.uid(), 'doctor'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.professionals p
  WHERE ((p.id = appointments.professional_id) AND (p.user_id = auth.uid()))))));



  create policy "Doctor can view own appointments"
  on "public"."appointments"
  as permissive
  for select
  to authenticated
using ((public.has_role(auth.uid(), 'doctor'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.professionals p
  WHERE ((p.id = appointments.professional_id) AND (p.user_id = auth.uid()))))));



  create policy "Admin manage clinic_settings"
  on "public"."clinic_settings"
  as permissive
  for all
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admin/Secretary manage consultation_types"
  on "public"."consultation_types"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Doctor can view consultation_types"
  on "public"."consultation_types"
  as permissive
  for select
  to authenticated
using (public.has_role(auth.uid(), 'doctor'::public.app_role));



  create policy "Admin/Secretary manage contact_messages"
  on "public"."contact_messages"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Public can insert contact_messages"
  on "public"."contact_messages"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Admin/Secretary manage patients"
  on "public"."patients"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Staff can view patients"
  on "public"."patients"
  as permissive
  for select
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));



  create policy "Admin manage professionals"
  on "public"."professionals"
  as permissive
  for all
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Staff can view professionals"
  on "public"."professionals"
  as permissive
  for select
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));



  create policy "Admin/Secretary manage rooms"
  on "public"."rooms"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Doctor can view rooms"
  on "public"."rooms"
  as permissive
  for select
  to authenticated
using (public.has_role(auth.uid(), 'doctor'::public.app_role));



  create policy "Admin/Secretary manage specialties"
  on "public"."specialties"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Doctor can view specialties"
  on "public"."specialties"
  as permissive
  for select
  to authenticated
using (public.has_role(auth.uid(), 'doctor'::public.app_role));



  create policy "Admin manage profiles"
  on "public"."user_profiles"
  as permissive
  for all
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Staff can view profiles"
  on "public"."user_profiles"
  as permissive
  for select
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));



  create policy "Users can update own profile"
  on "public"."user_profiles"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Admin manage roles"
  on "public"."user_roles"
  as permissive
  for all
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admin/Secretary manage waitlist"
  on "public"."waitlist"
  as permissive
  for all
  to authenticated
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretary'::public.app_role)));



  create policy "Doctor can view waitlist"
  on "public"."waitlist"
  as permissive
  for select
  to authenticated
using (public.has_role(auth.uid(), 'doctor'::public.app_role));



  create policy "Admin manage whatsapp_workflows"
  on "public"."whatsapp_workflows"
  as permissive
  for all
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE TRIGGER notify_staff_on_appointment_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_appointment_change();

CREATE TRIGGER notify_staff_on_appointment_update AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_appointment_change();

CREATE TRIGGER trg_no_show AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trigger_no_show();

CREATE TRIGGER trg_notify_appointment_change AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_on_appointment_change();

CREATE TRIGGER trg_pre_confirmation AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trigger_pre_confirmation();

CREATE TRIGGER trg_review AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trigger_review();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


