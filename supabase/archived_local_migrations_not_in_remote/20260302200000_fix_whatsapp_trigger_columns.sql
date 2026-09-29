-- Fix trigger functions that reference dropped columns (patient_id, phone)
-- whatsapp_workflows now uses: patient_phone (text), no patient_id column
-- workflow_type enum values: pre_confirmation_sent, confirmation_24h, reschedule_prompt, slot_suggestion, request_cancelled

CREATE OR REPLACE FUNCTION public.trigger_pre_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF NEW.status::text IN ('scheduled', 'confirmed', 'pre_confirmed') THEN
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;

    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_phone, workflow_type, scheduled_at)
      VALUES (NEW.id, v_phone, 'pre_confirmation_sent', now())
      RETURNING id INTO v_wf_id;

      PERFORM public.create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_no_show()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF OLD.status::text != 'no_show' AND NEW.status::text = 'no_show' THEN
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;

    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_phone, workflow_type, scheduled_at)
      VALUES (NEW.id, v_phone, 'reschedule_prompt', now() + interval '1 hour')
      RETURNING id INTO v_wf_id;

      PERFORM public.create_whatsapp_event('appointment.no_show_reschedule', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_phone text;
BEGIN
  IF OLD.status::text != 'completed' AND NEW.status::text = 'completed' THEN
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;

    IF v_phone IS NOT NULL THEN
      PERFORM public.create_whatsapp_event('appointment.review_reminder', 'appointment', NEW.id, NULL, now() + interval '2 hours');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
