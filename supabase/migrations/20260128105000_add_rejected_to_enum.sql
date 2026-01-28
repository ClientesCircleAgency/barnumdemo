-- Migration to add 'rejected' to request_status enum
-- This fixes the error: invalid input value for enum request_status: "rejected"

DO $$
BEGIN
  -- Handle the case where the type might be named request_status or appointment_request_status
  -- We assume request_status because of the specific error message
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'rejected';
  END IF;
END $$;
