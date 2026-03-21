-- STEP 1: Execute this FIRST to remove old tables
-- This is safe - it will only delete if they exist

DROP TABLE IF EXISTS whatsapp_events CASCADE;
DROP TABLE IF EXISTS whatsapp_action_tokens CASCADE;
DROP TABLE IF EXISTS appointment_suggestions CASCADE;

-- STEP 2: Now create the tables fresh

CREATE TABLE whatsapp_events (
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

CREATE TABLE whatsapp_action_tokens (
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

CREATE TABLE appointment_suggestions (
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

CREATE INDEX idx_whatsapp_events_status ON whatsapp_events(status);
CREATE INDEX idx_whatsapp_events_scheduled ON whatsapp_events(scheduled_for);
CREATE INDEX idx_whatsapp_action_tokens_token ON whatsapp_action_tokens(token);
CREATE INDEX idx_appointment_suggestions_patient ON appointment_suggestions(patient_id);
