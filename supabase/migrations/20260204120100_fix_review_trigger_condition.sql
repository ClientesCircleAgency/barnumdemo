-- Migration: Fix Review Reminder Trigger Condition
-- Description: Update trigger to fire on finalized_at instead of status='completed'
-- Date: 2026-02-04
-- Issue: P0-003 - Review Trigger Inconsistency
-- 
-- PROBLEM:
-- Current trigger fires when status changes to 'completed', but per spec (Automation 6):
-- - Review countdown should start from "Finalizar" button click (finalized_at timestamp)
-- - Should respect "Não enviar link de review" checkbox (review_opt_out = true)
-- - Current implementation fires too early (status change, not finalization)
--
-- FIX:
-- Update trigger condition to check finalized_at transition and review_opt_out flag
--
-- DEPENDENCIES:
-- ⚠️ REQUIRES migration 20260131121545_support_whatsapp_automations_option1.sql
-- That migration adds the finalized_at and review_opt_out columns to appointments table.
-- Without those columns, this migration will FAIL.

-- ============================================================================
-- Update Review Reminder Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_review_reminder_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  -- NEW CONDITION: Fire when finalized_at goes from NULL to NOT NULL, and review_opt_out is false
  IF OLD.finalized_at IS NULL AND NEW.finalized_at IS NOT NULL AND NEW.review_opt_out = false THEN
    
    -- Get patient phone number
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    -- Create workflow record
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'review_2h',
      now() + interval '2 hours'  -- 2 hours after finalization
    )
    RETURNING id INTO v_workflow_id;
    
    -- Create event in outbox
    PERFORM create_whatsapp_event(
      'appointment.review_reminder',
      'appointment',
      NEW.id,
      v_workflow_id,
      now() + interval '2 hours'  -- Scheduled 2 hours from finalization
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Trigger remains the same (AFTER UPDATE on appointments)
-- ============================================================================
-- The trigger definition itself doesn't need to change, only the function logic.
-- But we recreate it for clarity/idempotency:

DROP TRIGGER IF EXISTS trigger_appointment_review_reminder ON public.appointments;
CREATE TRIGGER trigger_appointment_review_reminder
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_review_reminder_event();

-- ============================================================================
-- Result: Trigger now fires correctly per Automation 6 spec
-- ============================================================================
-- 
-- OLD BEHAVIOR:
-- - Fired when status changed to 'completed'
-- - Ignored review_opt_out flag
-- - Started countdown from status change, not finalization click
--
-- NEW BEHAVIOR:
-- ✅ Fires when finalized_at set (staff clicks "Finalizar" button)
-- ✅ Respects review_opt_out flag (no event if checkbox checked)
-- ✅ 2-hour countdown starts from correct moment
-- ✅ Only fires once per finalization (NULL -> NOT NULL transition)
