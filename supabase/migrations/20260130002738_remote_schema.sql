drop policy "Admins can view all roles" on "public"."user_roles";

drop function if exists "public"."has_role"(_user_id uuid, _role public.app_role__old_version_to_be_dropped);

drop type "public"."app_role__old_version_to_be_dropped";

drop type "public"."appointment_status__old_version_to_be_dropped";

set check_function_bodies = off;

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


  create policy "Admins can view all roles"
  on "public"."user_roles"
  as permissive
  for select
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));



