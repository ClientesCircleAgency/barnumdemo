-- WhatsApp Webhook Infrastructure - MINIMAL VERSION
-- Copy and paste this entire file into Supabase SQL Editor

-- Table 1: whatsapp_events
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

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_status ON whatsapp_events(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_scheduled ON whatsapp_events(scheduled_for);

-- Table 2: whatsapp_action_tokens
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

CREATE INDEX IF NOT EXISTS idx_tokens_token ON whatsapp_action_tokens(token);

-- Table 3: appointment_suggestions
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

-- Function 1: Generate token
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
  
  INSERT INTO whatsapp_action_tokens (
    token, action_type, appointment_id, patient_id, workflow_id, metadata, expires_at
  ) VALUES (
    v_token, p_action_type, p_appointment_id, p_patient_id, p_workflow_id, p_metadata,
    now() + (p_expires_in_days || ' days')::interval
  );
  
  RETURN v_token;
END;
$$;

-- Function 2: Validate token
CREATE OR REPLACE FUNCTION validate_action_token(p_token text)
RETURNS TABLE (
  valid boolean,
  appointment_id uuid,
  patient_id uuid,
  action_type text,
  metadata jsonb,
  error_message text
)
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
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token already used'::text;
    RETURN;
  END IF;
  
  IF v_rec.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token expired'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_rec.appointment_id, v_rec.patient_id, v_rec.action_type, v_rec.metadata, NULL::text;
END;
$$;

-- Function 3: Mark token used
CREATE OR REPLACE FUNCTION mark_token_used(p_token text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE whatsapp_action_tokens SET used_at = now() WHERE token = p_token;
END;
$$;
