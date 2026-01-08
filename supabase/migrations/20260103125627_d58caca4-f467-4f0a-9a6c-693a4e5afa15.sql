-- Add new appointment statuses for the pre-confirmation flow
-- First, we need to add new values to the existing enum
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pre_confirmed';

-- Create table to track WhatsApp workflow messages
CREATE TABLE public.whatsapp_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  phone text NOT NULL,
  workflow_type text NOT NULL CHECK (workflow_type IN ('confirmation_24h', 'review_reminder', 'availability_suggestion')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'expired', 'cancelled')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  response text,
  responded_at timestamptz,
  message_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage whatsapp_workflows"
ON public.whatsapp_workflows
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient queries on pending workflows
CREATE INDEX idx_whatsapp_workflows_pending ON public.whatsapp_workflows(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_whatsapp_workflows_appointment ON public.whatsapp_workflows(appointment_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_workflows_updated_at
BEFORE UPDATE ON public.whatsapp_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();