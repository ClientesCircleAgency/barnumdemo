-- Migration: WhatsApp Webhook System - SIMPLIFIED VERSION
-- Description: Creates only the essential tables without complex triggers
-- Date: 2026-01-28
-- Run this FIRST, then run the triggers migration

-- ============================================================================
-- 1. Create whatsapp_events table (Outbox Pattern)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  workflow_id uuid,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_status ON public.whatsapp_events(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_scheduled_for ON public.whatsapp_events(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_entity ON public.whatsapp_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_workflow ON public.whatsapp_events(workflow_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_whatsapp_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_whatsapp_events_updated_at ON public.whatsapp_events;
CREATE TRIGGER trigger_update_whatsapp_events_updated_at
  BEFORE UPDATE ON public.whatsapp_events
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_events_updated_at();

-- RLS Policies
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to whatsapp_events" ON public.whatsapp_events;
CREATE POLICY "Service role has full access to whatsapp_events"
  ON public.whatsapp_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view whatsapp_events for their clinic" ON public.whatsapp_events;
CREATE POLICY "Users can view whatsapp_events for their clinic"
  ON public.whatsapp_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = entity_id
    )
  );

-- ============================================================================
-- 2. Create whatsapp_action_tokens table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  action_type text NOT NULL,
  appointment_id uuid,
  patient_id uuid NOT NULL,
  workflow_id uuid,
  metadata jsonb,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_action_tokens_token ON public.whatsapp_action_tokens(token);
CREATE INDEX IF NOT EXISTS idx_whatsapp_action_tokens_appointment ON public.whatsapp_action_tokens(appointment_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_action_tokens_expires_at ON public.whatsapp_action_tokens(expires_at);

-- RLS Policies
ALTER TABLE public.whatsapp_action_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.whatsapp_action_tokens;
CREATE POLICY "Anyone can validate tokens"
  ON public.whatsapp_action_tokens FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "Service role has full access to whatsapp_action_tokens" ON public.whatsapp_action_tokens;
CREATE POLICY "Service role has full access to whatsapp_action_tokens"
  ON public.whatsapp_action_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. Create appointment_suggestions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_request_id uuid,
  patient_id uuid NOT NULL,
  suggested_slots jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  accepted_slot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_appointment_suggestions_request ON public.appointment_suggestions(appointment_request_id);
CREATE INDEX IF NOT EXISTS idx_appointment_suggestions_patient ON public.appointment_suggestions(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_suggestions_status ON public.appointment_suggestions(status);

DROP TRIGGER IF EXISTS trigger_update_appointment_suggestions_updated_at ON public.appointment_suggestions;
CREATE TRIGGER trigger_update_appointment_suggestions_updated_at
  BEFORE UPDATE ON public.appointment_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_events_updated_at();

-- RLS Policies
ALTER TABLE public.appointment_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to appointment_suggestions" ON public.appointment_suggestions;
CREATE POLICY "Service role has full access to appointment_suggestions"
  ON public.appointment_suggestions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own appointment_suggestions" ON public.appointment_suggestions;
CREATE POLICY "Users can view their own appointment_suggestions"
  ON public.appointment_suggestions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients WHERE id = patient_id
    )
  );

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Generate secure action token
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
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  INSERT INTO public.whatsapp_action_tokens (
    token, action_type, appointment_id, patient_id, workflow_id, metadata, expires_at
  ) VALUES (
    v_token, p_action_type, p_appointment_id, p_patient_id, p_workflow_id, p_metadata,
    now() + (p_expires_in_days || ' days')::interval
  );
  
  RETURN v_token;
END;
$$;

-- Validate action token
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
SECURITY DEFINER
AS $$
DECLARE
  v_token_record record;
BEGIN
  SELECT * INTO v_token_record FROM public.whatsapp_action_tokens WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token not found'::text;
    RETURN;
  END IF;
  
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token already used'::text;
    RETURN;
  END IF;
  
  IF v_token_record.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token expired'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    true,
    v_token_record.appointment_id,
    v_token_record.patient_id,
    v_token_record.action_type,
    v_token_record.metadata,
    NULL::text;
END;
$$;

-- Mark token as used
CREATE OR REPLACE FUNCTION mark_token_used(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.whatsapp_action_tokens SET used_at = now() WHERE token = p_token;
END;
$$;

-- ============================================================================
-- DONE: Core tables and functions created
-- ============================================================================
