-- ============================================================================
-- FIX: Update trigger functions to use CORRECT enum values
-- Execute this to fix the workflow_type values in triggers
-- ============================================================================

-- Trigger 1: Pre-confirmation (CORRECTED enum value)
CREATE OR REPLACE FUNCTION public.trigger_pre_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF NEW.status::text IN ('scheduled', 'confirmed', 'pre_confirmed') THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      -- FIXED: Use 'pre_confirmation_sent' (correct enum value)
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'pre_confirmation_sent', now())
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger 2: No-show reschedule (CORRECTED enum value)
CREATE OR REPLACE FUNCTION public.trigger_no_show()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF OLD.status::text != 'no_show' AND NEW.status::text = 'no_show' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      -- FIXED: Use 'reschedule_prompt' (correct enum value)
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'reschedule_prompt', now() + interval '1 hour')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.no_show_reschedule', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger 3: Review reminder (CHANGED to use confirmation_24h as closest match)
-- NOTE: There's no 'review' workflow type in the enum, so using confirmation_24h
-- You may want to add a new enum value 'review_reminder' or use a different workflow
CREATE OR REPLACE FUNCTION public.trigger_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF OLD.status::text != 'completed' AND NEW.status::text = 'completed' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      -- TEMPORARY FIX: Using 'confirmation_24h' as there's no review enum value
      -- TODO: Add 'review_reminder' to the workflow_type enum
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'confirmation_24h', now() + interval '2 hours')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.review_reminder', 'appointment', NEW.id, v_wf_id, now() + interval '2 hours');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- DONE! Triggers now use correct enum values
-- ============================================================================
