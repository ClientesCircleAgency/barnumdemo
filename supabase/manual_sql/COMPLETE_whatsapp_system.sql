-- ============================================================================
-- WHATSAPP WEBHOOK SYSTEM - COMPLETE MIGRATION
-- Copy this ENTIRE file and paste into Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: TABLES
-- ============================================================================

-- Table 1: Events (Outbox Pattern)
CREATE TABLE IF NOT EXISTS whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  workflow_id uuid,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending',
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  last_error text,
  scheduled_for timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table 2: Action Tokens
CREATE TABLE IF NOT EXISTS whatsapp_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  action_type text NOT NULL,
  appointment_id uuid,
  patient_id uuid NOT NULL,
  workflow_id uuid,
  metadata jsonb,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table 3: Appointment Suggestions
CREATE TABLE IF NOT EXISTS appointment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_request_id uuid,
  patient_id uuid NOT NULL,
  suggested_slots jsonb NOT NULL,
  status text DEFAULT 'pending',
  accepted_slot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- ============================================================================
-- PART 2: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_events_status ON whatsapp_events(status);
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON whatsapp_events(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON whatsapp_action_tokens(token);
CREATE INDEX IF NOT EXISTS idx_suggestions_patient ON appointment_suggestions(patient_id);

-- ============================================================================
-- PART 3: FUNCTIONS
-- ============================================================================

-- Function: Generate secure token
CREATE OR REPLACE FUNCTION generate_action_token(
  p_action_type text,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_workflow_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_expires_in_days integer DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  INSERT INTO whatsapp_action_tokens (token, action_type, appointment_id, patient_id, workflow_id, metadata, expires_at)
  VALUES (v_token, p_action_type, p_appointment_id, p_patient_id, p_workflow_id, p_metadata, now() + (p_expires_in_days || ' days')::interval);
  
  RETURN v_token;
END;
$$;

-- Function: Validate token
CREATE OR REPLACE FUNCTION validate_action_token(p_token text)
RETURNS TABLE (valid boolean, appointment_id uuid, patient_id uuid, action_type text, metadata jsonb, error_message text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec record;
BEGIN
  SELECT * INTO v_rec FROM whatsapp_action_tokens WHERE token = p_token;
  
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
$$;

-- Function: Mark token as used
CREATE OR REPLACE FUNCTION mark_token_used(p_token text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE whatsapp_action_tokens SET used_at = now() WHERE token = p_token;
END;
$$;

-- Function: Create webhook event
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
  INSERT INTO whatsapp_events (event_type, entity_type, entity_id, workflow_id, payload, scheduled_for)
  VALUES (p_event_type, p_entity_type, p_entity_id, p_workflow_id, 
          jsonb_build_object('event_type', p_event_type, 'entity_id', p_entity_id), p_scheduled_for)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- PART 4: TRIGGERS
-- ============================================================================

-- Trigger Function: Pre-confirmation
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
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'pre_confirmation', now())
      RETURNING id INTO v_wf_id;
      
      PERFORM create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_confirmation ON appointments;
CREATE TRIGGER trg_pre_confirmation AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_pre_confirmation();

-- Trigger Function: No-show reschedule
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
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'reschedule_no_show', now() + interval '1 hour')
      RETURNING id INTO v_wf_id;
      
      PERFORM create_whatsapp_event('appointment.no_show', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_show ON appointments;
CREATE TRIGGER trg_no_show AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_no_show();

-- Trigger Function: Review reminder
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
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'review_2h', now() + interval '2 hours')
      RETURNING id INTO v_wf_id;
      
      PERFORM create_whatsapp_event('appointment.review', 'appointment', NEW.id, v_wf_id, now() + interval '2 hours');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review ON appointments;
CREATE TRIGGER trg_review AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_review();

-- ============================================================================
-- DONE! All tables, functions, and triggers created
-- ============================================================================
