-- Remove whatsapp_action_tokens table and related functions (no longer needed)
DROP TABLE IF EXISTS public.whatsapp_action_tokens CASCADE;
DROP FUNCTION IF EXISTS public.validate_action_token(text);
DROP FUNCTION IF EXISTS public.mark_token_used(text);
DROP FUNCTION IF EXISTS public.generate_action_token(text, uuid, uuid, uuid, jsonb, integer);
