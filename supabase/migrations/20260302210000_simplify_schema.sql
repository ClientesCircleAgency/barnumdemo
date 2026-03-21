-- ============================================================================
-- SCHEMA SIMPLIFICATION
-- Remove outbox pattern (whatsapp_events/workflows) and unused tables.
-- n8n now uses Supabase Database Webhooks on appointments/appointment_requests.
-- ============================================================================

-- 1. Drop triggers on appointments that wrote to whatsapp outbox
DROP TRIGGER IF EXISTS trg_pre_confirmation ON public.appointments;
DROP TRIGGER IF EXISTS trg_no_show ON public.appointments;
DROP TRIGGER IF EXISTS trg_review ON public.appointments;

-- 2. Drop the trigger functions
DROP FUNCTION IF EXISTS public.trigger_pre_confirmation();
DROP FUNCTION IF EXISTS public.trigger_no_show();
DROP FUNCTION IF EXISTS public.trigger_review();
DROP FUNCTION IF EXISTS public.create_whatsapp_event(text, text, uuid, uuid, timestamptz);
DROP FUNCTION IF EXISTS public.generate_action_token(text, uuid, uuid, uuid, jsonb, integer);

-- 3. Drop whatsapp outbox tables (replaced by DB Webhooks)
DROP TABLE IF EXISTS public.whatsapp_events CASCADE;
DROP TABLE IF EXISTS public.whatsapp_workflows CASCADE;

-- 4. Drop unused tables
DROP TABLE IF EXISTS public.appointment_notes CASCADE;
DROP TABLE IF EXISTS public.desistências CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.waitlist CASCADE;

-- 5. Drop orphaned functions related to removed tables
DROP FUNCTION IF EXISTS public.update_whatsapp_events_updated_at();
