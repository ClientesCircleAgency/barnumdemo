-- WhatsApp Event Triggers - MINIMAL VERSION
-- Run this AFTER the infrastructure migration

-- Helper function to create events
CREATE OR REPLACE FUNCTION create_whatsapp_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_workflow_id uuid DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO whatsapp_events (
    event_type, entity_type, entity_id, workflow_id, payload, scheduled_for
  ) VALUES (
    p_event_type, p_entity_type, p_entity_id, p_workflow_id,
    jsonb_build_object('event_type', p_event_type, 'entity_id', p_entity_id),
    p_scheduled_for
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Trigger 1: Pre-confirmation
CREATE OR REPLACE FUNCTION trigger_pre_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF NEW.status IN ('scheduled', 'confirmed') THEN
    SELECT phone INTO v_phone FROM patients WHERE id = NEW.patient_id;
    
    INSERT INTO whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
    VALUES (NEW.id, NEW.patient_id, v_phone, 'pre_confirmation', now())
    RETURNING id INTO v_wf_id;
    
    PERFORM create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_confirmation ON appointments;
CREATE TRIGGER trg_pre_confirmation
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_pre_confirmation();

-- Trigger 2: No-show reschedule
CREATE OR REPLACE FUNCTION trigger_no_show()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'no_show' AND NEW.status = 'no_show' THEN
    SELECT phone INTO v_phone FROM patients WHERE id = NEW.patient_id;
    
    INSERT INTO whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
    VALUES (NEW.id, NEW.patient_id, v_phone, 'reschedule_no_show', now() + interval '1 hour')
    RETURNING id INTO v_wf_id;
    
    PERFORM create_whatsapp_event('appointment.no_show', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_show ON appointments;
CREATE TRIGGER trg_no_show
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_no_show();

-- Trigger 3: Review reminder
CREATE OR REPLACE FUNCTION trigger_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    SELECT phone INTO v_phone FROM patients WHERE id = NEW.patient_id;
    
    INSERT INTO whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
    VALUES (NEW.id, NEW.patient_id, v_phone, 'review_2h', now() + interval '2 hours')
    RETURNING id INTO v_wf_id;
    
    PERFORM create_whatsapp_event('appointment.review', 'appointment', NEW.id, v_wf_id, now() + interval '2 hours');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review ON appointments;
CREATE TRIGGER trg_review
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_review();
