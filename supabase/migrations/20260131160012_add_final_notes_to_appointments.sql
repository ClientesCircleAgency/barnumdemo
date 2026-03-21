-- =====================================================
-- Migration: add_final_notes_to_appointments
-- Created: 2026-01-31
-- Purpose: Add final_notes column to support Automation 6 "Notas"
-- Phase: 4.1
-- =====================================================

-- This migration adds storage for final consultation notes
-- written by doctor/secretary when clicking "Finalizar".
--
-- These notes include:
-- - Summary of consultation
-- - Prescription details
--
-- The notes are included in the post-consultation WhatsApp message
-- sent 2 hours after finalization.

-- =====================================================
-- Add final_notes column to appointments table
-- =====================================================
-- Supports: Automation 6 (Post-Consultation Message)
--
-- Purpose: Store consultation summary + prescription written during finalization
-- Usage: Populated when doctor/secretary clicks "Finalizar" and writes in "Notas" field
-- Delivered: Included in WhatsApp message sent 2 hours after finalization
-- =====================================================

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS final_notes text;

COMMENT ON COLUMN public.appointments.final_notes IS 'Final consultation notes (summary + prescription) written by doctor/secretary during finalization. Included in post-consultation WhatsApp message sent 2 hours after finalization.';

-- =====================================================
-- Migration Complete
-- =====================================================
-- Backwards compatible: nullable column, existing data unaffected
-- =====================================================
