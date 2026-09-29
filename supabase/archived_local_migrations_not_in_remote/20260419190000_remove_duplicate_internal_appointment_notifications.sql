-- Remove duplicate internal notifications for appointments.
-- Keep the staff-aware triggers and remove the older generic trigger.
-- This does not touch WhatsApp/n8n flows that listen to appointments changes.

DROP TRIGGER IF EXISTS trg_notify_appointment_change ON public.appointments;
DROP FUNCTION IF EXISTS public.notify_on_appointment_change();
