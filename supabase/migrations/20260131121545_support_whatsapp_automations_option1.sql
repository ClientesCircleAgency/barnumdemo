-- =====================================================
-- Migration: support_whatsapp_automations_option1
-- Created: 2026-01-31
-- Purpose: Add minimal schema support for WhatsApp Automations 1-6
-- Status: NOT applied to production (awaiting review)
-- =====================================================

-- This migration implements Option 1 (Minimal Schema Changes) from
-- docs/contracts/BACKEND_SCHEMA_CHANGE_PLAN.md
--
-- Changes:
-- 1. Create desistências table (abandoned appointments)
-- 2. Add rejection_reason to appointment_requests
-- 3. Add cancellation_reason to appointments
-- 4. Add review_opt_out to appointments
-- 5. Add finalized_at to appointments


-- =====================================================
-- 1. Create desistências table
-- =====================================================
-- Supports: Automation 2 (24h confirmation flow)
--           Automation 5 (staff-initiated cancellation)
--
-- Purpose: Store patients who definitively abandon scheduling process
-- Business Rule: Patients who go to desistências do NOT appear in patient dashboard
-- =====================================================

CREATE TABLE IF NOT EXISTS public.desistências (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_request_id uuid REFERENCES public.appointment_requests(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  reason text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Create index for quick lookups by patient
CREATE INDEX IF NOT EXISTS idx_desistências_patient_id 
ON public.desistências(patient_id);

-- Create index for quick lookups by appointment request
CREATE INDEX IF NOT EXISTS idx_desistências_appointment_request_id 
ON public.desistências(appointment_request_id);

COMMENT ON TABLE public.desistências IS 'Stores patients who definitively abandon the scheduling process. Used by WhatsApp automations when patient declines rescheduling.';

COMMENT ON COLUMN public.desistências.patient_id IS 'Link to patient record (may be null if patient never completed first appointment)';
COMMENT ON COLUMN public.desistências.appointment_request_id IS 'Original appointment request that led to abandonment';
COMMENT ON COLUMN public.desistências.appointment_id IS 'Confirmed appointment if it existed before cancellation (nullable)';
COMMENT ON COLUMN public.desistências.reason IS 'Why patient abandoned (e.g., "Patient declined reschedule after cancellation")';


-- =====================================================
-- 2. Add rejection_reason to appointment_requests
-- =====================================================
-- Supports: Automation 1 (incoming request, secretary triage)
--
-- Purpose: Store secretary's written reason when rejecting appointment request
-- Business Rule: Rejection reason is mandatory and sent to patient via WhatsApp
-- =====================================================

ALTER TABLE public.appointment_requests 
ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.appointment_requests.rejection_reason IS 'Secretary-written reason for rejecting appointment request. Mandatory when status=rejected. Sent to patient via WhatsApp.';


-- =====================================================
-- 3. Add cancellation_reason to appointments
-- =====================================================
-- Supports: Automation 5 (staff-initiated cancellation)
--
-- Purpose: Store secretary's written reason for staff-initiated cancellation
-- Business Rule: Cancellation reason is mandatory and sent to patient via WhatsApp
-- Note: appointment_requests already has cancel_reason for request-level cancellations
-- =====================================================

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN public.appointments.cancellation_reason IS 'Secretary-written reason for staff-initiated cancellation. Mandatory when staff cancels from dashboard. Sent to patient via WhatsApp.';


-- =====================================================
-- 4. Add review_opt_out to appointments
-- =====================================================
-- Supports: Automation 6 (waiting room, finalization & post-consultation review)
--
-- Purpose: Flag to prevent sending post-consultation review message
-- Business Rule: When "Finalizar" button shows checkbox "Não enviar review",
--                 this is set to true if checked
-- Default: false (send review) for backwards compatibility
-- =====================================================

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS review_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.appointments.review_opt_out IS 'Prevents sending review message 2 hours after finalization. Set via "Não enviar review" checkbox in finalization popup.';


-- =====================================================
-- 5. Add finalized_at to appointments
-- =====================================================
-- Supports: Automation 6 (waiting room, finalization & post-consultation review)
--
-- Purpose: Record exact timestamp when "Finalizar" button was clicked
-- Business Rule: 
--   - The 2-hour countdown for review automation ONLY starts from this timestamp
--   - NO countdown starts before clicking "Finalizar"
--   - Consultation is removed from active pipeline after this is set
-- =====================================================

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

COMMENT ON COLUMN public.appointments.finalized_at IS 'Timestamp when "Finalizar" button was clicked. The 2-hour review countdown starts from this moment. Null means consultation not yet finalized.';

-- Create index for efficient querying of finalized appointments
CREATE INDEX IF NOT EXISTS idx_appointments_finalized_at 
ON public.appointments(finalized_at) 
WHERE finalized_at IS NOT NULL;


-- =====================================================
-- Migration Complete
-- =====================================================
-- All changes are backwards compatible:
-- - New table (desistências) is empty
-- - New columns are nullable or have safe defaults
-- - No existing data is modified
-- - No breaking changes to existing functionality
-- =====================================================
