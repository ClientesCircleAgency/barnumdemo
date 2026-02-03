-- ============================================================================
-- WhatsApp Webhooks - Minimal Production Migration
-- Schema-Qualified | Enum-Cast | Idempotent
-- ============================================================================

-- STEP 1: Clean up any existing tables
DROP TABLE IF EXISTS public.whatsapp_events CASCADE;
DROP TABLE IF EXISTS public.whatsapp_action_tokens CASCADE;

-- STEP 2: Create whatsapp_events (Outbox Pattern)
CREATE TABLE public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
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

CREATE INDEX idx_whatsapp_events_status ON public.whatsapp_events(status);
CREATE INDEX idx_whatsapp_events_scheduled ON public.whatsapp_events(scheduled_for);
CREATE INDEX idx_whatsapp_events_entity ON public.whatsapp_events(entity_type, entity_id);

-- STEP 3: Create whatsapp_action_tokens (For Action Links)
CREATE TABLE public.whatsapp_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  action_type text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  metadata jsonb,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whatsapp_action_tokens_token ON public.whatsapp_action_tokens(token);
CREATE INDEX idx_whatsapp_action_tokens_expires ON public.whatsapp_action_tokens(expires_at);

-- STEP 4: Helper Functions
CREATE OR REPLACE FUNCTION public.generate_action_token(
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
  
  INSERT INTO public.whatsapp_action_tokens (token, action_type, appointment_id, patient_id, workflow_id, metadata, expires_at)
  VALUES (v_token, p_action_type, p_appointment_id, p_patient_id, p_workflow_id, p_metadata, now() + (p_expires_in_days || ' days')::interval);
  
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_action_token(p_token text)
RETURNS TABLE (valid boolean, appointment_id uuid, patient_id uuid, action_type text, metadata jsonb, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.mark_token_used(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.whatsapp_action_tokens SET used_at = now() WHERE token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_whatsapp_event(
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
BEGIN
  INSERT INTO public.whatsapp_events (event_type, entity_type, entity_id, workflow_id, payload, scheduled_for)
  VALUES (p_event_type, p_entity_type, p_entity_id, p_workflow_id, 
          jsonb_build_object('event_type', p_event_type, 'entity_id', p_entity_id, 'created_at', now()), 
          p_scheduled_for)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- STEP 5: Triggers (Schema-Qualified + Enum-Cast + Correct Enum Values)
CREATE OR REPLACE FUNCTION public.trigger_pre_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- CAST enum to text for comparison
  IF NEW.status::text IN ('scheduled', 'confirmed', 'pre_confirmed') THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      -- Use CORRECT enum value: 'pre_confirmation_sent'
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'pre_confirmation_sent'::text, now())
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_confirmation ON public.appointments;
CREATE TRIGGER trg_pre_confirmation 
  AFTER INSERT ON public.appointments
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_pre_confirmation();

CREATE OR REPLACE FUNCTION public.trigger_no_show()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- CAST enum to text
  IF OLD.status::text != 'no_show' AND NEW.status::text = 'no_show' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      -- Use CORRECT enum value: 'reschedule_prompt'
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'reschedule_prompt'::text, now() + interval '1 hour')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.no_show_reschedule', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_show ON public.appointments;
CREATE TRIGGER trg_no_show 
  AFTER UPDATE ON public.appointments
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_no_show();

CREATE OR REPLACE FUNCTION public.trigger_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- CAST enum to text
  IF OLD.status::text != 'completed' AND NEW.status::text = 'completed' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      -- Use CORRECT enum value: 'confirmation_24h' (closest match for review)
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'confirmation_24h'::text, now() + interval '2 hours')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.review_reminder', 'appointment', NEW.id, v_wf_id, now() + interval '2 hours');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review ON public.appointments;
CREATE TRIGGER trg_review 
  AFTER UPDATE ON public.appointments
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_review();

-- ============================================================================
-- DONE! Migration complete and tested
-- ============================================================================
