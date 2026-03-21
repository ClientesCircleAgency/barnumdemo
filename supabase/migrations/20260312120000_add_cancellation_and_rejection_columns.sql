-- ============================================================================
-- ADD MISSING COLUMNS: cancellation_reason & rejection_reason
-- These columns were already in the codebase types but missing from remote.
-- Applied directly to remote on 2026-03-12, this migration keeps local in sync.
-- ============================================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
