-- Migration: Restrict whatsapp_events RLS to Service Role Only
-- Description: Removes authenticated user SELECT policy due to PHI exposure risk
-- Date: 2026-02-04
-- Issue: P0-004 - RLS Policy Exposes PHI in whatsapp_events
-- 
-- SECURITY ISSUE:
-- The previous policy "Users can view whatsapp_events for their clinic" allowed
-- any authenticated user to SELECT from whatsapp_events if a related appointment exists.
-- The payload JSONB column contains PHI (patient names, phones, appointment details).
--
-- FIX:
-- Remove the authenticated SELECT policy. Only service-role (server-side API) can access.
-- Service role bypasses RLS when using SUPABASE_SERVICE_ROLE_KEY.

-- ============================================================================
-- Drop Problematic Policy
-- ============================================================================

-- Remove the policy that allows authenticated users to view events
DROP POLICY IF EXISTS "Users can view whatsapp_events for their clinic" ON public.whatsapp_events;

-- ============================================================================
-- Verify Service Role Policy Still Exists
-- ============================================================================

-- The service role policy was created in migration 20260128020127_whatsapp_webhook_infrastructure.sql
-- It should still exist, but we ensure it's present (idempotent)
DROP POLICY IF EXISTS "Service role has full access to whatsapp_events" ON public.whatsapp_events;
CREATE POLICY "Service role has full access to whatsapp_events"
  ON public.whatsapp_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- Result: Only service-role can read/write whatsapp_events
-- ============================================================================
-- 
-- After this migration:
-- ✅ api/internal.ts (uses supabaseAdmin) can process events
-- ✅ api/webhook.ts (uses supabaseAdmin) can update events
-- ✅ api/action.ts (uses supabaseAdmin) can query events
-- ❌ Frontend authenticated users cannot read events (no PHI leak)
-- ❌ Admin dashboard cannot view events (acceptable - operational data only)
