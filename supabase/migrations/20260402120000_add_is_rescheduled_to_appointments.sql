-- Add persistent reschedule flag for n8n webhook detection
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN NOT NULL DEFAULT false;
