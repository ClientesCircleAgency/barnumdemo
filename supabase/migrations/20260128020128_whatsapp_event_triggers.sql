-- Migration: WhatsApp Event Triggers - SIMPLIFIED VERSION
-- Description: Creates triggers to automatically generate webhook events
-- Date: 2026-01-28
-- Run this AFTER the infrastructure migration

-- ============================================================================
-- Helper Function: Create Webhook Event
-- ============================================================================

CREATE OR REPLACE FUNCTION create_whatsapp_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_workflow_id uuid DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_payload jsonb;
BEGIN
  -- Build simple payload (can be enhanced later)
  v_payload := jsonb_build_object(
    'event_type', p_event_type,
    'timestamp', now(),
    'entity_id', p_entity_id,
    'entity_type', p_entity_type
  );
  
  -- Insert the event
  INSERT INTO public.whatsapp_events (
    event_type,
    entity_type,
    entity_id,
    workflow_id,
    payload,
    scheduled_for
  ) VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_workflow_id,
    v_payload,
    p_scheduled_for
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- Trigger 1: Pre-confirmation on Appointment Insert
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_pre_confirmation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  -- Only trigger for new appointments
  IF NEW.status IN ('scheduled', 'pre_confirmed', 'confirmed') THEN
    
    -- Get patient phone
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    -- Create workflow record (without status - it has a default)
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'pre_confirmation',
      now()
    )
    RETURNING id INTO v_workflow_id;
    
    -- Create webhook event
    PERFORM create_whatsapp_event(
      'appointment.pre_confirmed',
      'appointment',
      NEW.id,
      v_workflow_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_appointment_pre_confirmation ON public.appointments;
CREATE TRIGGER trigger_appointment_pre_confirmation
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_pre_confirmation_event();

-- ============================================================================
-- Trigger 2: No-Show Reschedule
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_no_show_reschedule_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'no_show' AND NEW.status = 'no_show' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'reschedule_no_show',
      now() + interval '1 hour'
    )
    RETURNING id INTO v_workflow_id;
    
    PERFORM create_whatsapp_event(
      'appointment.no_show_reschedule',
      'appointment',
      NEW.id,
      v_workflow_id,
      now() + interval '1 hour'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_appointment_no_show_reschedule ON public.appointments;
CREATE TRIGGER trigger_appointment_no_show_reschedule
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_no_show_reschedule_event();

-- ============================================================================
-- Trigger 3: Review Reminder 2h After Completion
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_review_reminder_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'review_2h',
      now() + interval '2 hours'
    )
    RETURNING id INTO v_workflow_id;
    
    PERFORM create_whatsapp_event(
      'appointment.review_reminder',
      'appointment',
      NEW.id,
      v_workflow_id,
      now() + interval '2 hours'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_appointment_review_reminder ON public.appointments;
CREATE TRIGGER trigger_appointment_review_reminder
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_review_reminder_event();

-- ============================================================================
-- Trigger 4: Appointment Request Suggestion
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_appointment_suggestion_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create empty suggestion record
  INSERT INTO public.appointment_suggestions (
    appointment_request_id,
    patient_id,
    suggested_slots
  ) VALUES (
    NEW.id,
    NEW.patient_id,
    '[]'::jsonb
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_appointment_request_suggestion ON public.appointment_requests;
CREATE TRIGGER trigger_appointment_request_suggestion
  AFTER INSERT ON public.appointment_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_appointment_suggestion_event();

-- ============================================================================
-- Trigger 5: Send Suggestion When Slots Populated
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_send_appointment_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  IF (OLD.suggested_slots IS NULL OR OLD.suggested_slots = '[]'::jsonb) 
     AND NEW.suggested_slots != '[]'::jsonb THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    INSERT INTO public.whatsapp_workflows (
      patient_id,
      phone,
      workflow_type,
      scheduled_at,
      message_payload
    ) VALUES (
      NEW.patient_id,
      v_phone,
      'appointment_suggestion',
      now(),
      jsonb_build_object('suggestion_id', NEW.id, 'slots', NEW.suggested_slots)
    )
    RETURNING id INTO v_workflow_id;
    
    PERFORM create_whatsapp_event(
      'appointment.suggestion_ready',
      'appointment_request',
      NEW.appointment_request_id,
      v_workflow_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_appointment_suggestion ON public.appointment_suggestions;
CREATE TRIGGER trigger_send_appointment_suggestion
  AFTER UPDATE ON public.appointment_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_appointment_suggestion();

-- ============================================================================
-- DONE: All triggers created
-- ============================================================================
