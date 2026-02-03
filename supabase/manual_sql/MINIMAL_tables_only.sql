-- ============================================================================
-- WHATSAPP WEBHOOK SYSTEM - FINAL WORKING VERSION
-- This version avoids any potential schema conflicts
-- Copy this ENTIRE file and paste into Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: TABLES (with minimal constraints)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  workflow_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  last_error text,
  scheduled_for timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS appointment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_request_id uuid,
  patient_id uuid NOT NULL,
  suggested_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text DEFAULT 'pending',
  accepted_slot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- ============================================================================
-- PART 2: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_status ON whatsapp_events(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_scheduled ON whatsapp_events(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_whatsapp_action_tokens_token ON whatsapp_action_tokens(token);
CREATE INDEX IF NOT EXISTS idx_appointment_suggestions_patient ON appointment_suggestions(patient_id);

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

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

CREATE OR REPLACE FUNCTION mark_token_used(p_token text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE whatsapp_action_tokens SET used_at = now() WHERE token = p_token;
END;
$$;

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
          jsonb_build_object('event_type', p_event_type, 'entity_id', p_entity_id, 'timestamp', now()), 
          p_scheduled_for)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- DONE! Tables and functions created successfully
-- You can now manually create triggers in a separate query if needed
-- ============================================================================

-- To test, run: SELECT generate_action_token('confirm', NULL, (SELECT id FROM patients LIMIT 1));
