-- ============================================================================
-- DIAGNOSTIC SQL - Run this FIRST to understand the issue
-- ============================================================================

-- Check 1: Verify table exists and is in public schema
SELECT 
  'appointments table check' as test,
  to_regclass('appointments') as unqualified,
  to_regclass('public.appointments') as qualified,
  CASE 
    WHEN to_regclass('public.appointments') IS NOT NULL THEN '✓ Table exists in public schema'
    ELSE '✗ Table NOT found'
  END as result;

-- Check 2: Current search path
SELECT current_setting('search_path') as search_path;

-- Check 3: Verify appointments.status column exists
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'appointments' 
  AND column_name = 'status';

-- Check 4: Get the actual enum values for appointment_status
SELECT 
  n.nspname as schema,
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'appointment_status'
ORDER BY e.enumsortorder;

-- Check 5: Verify whatsapp_workflows table exists and check workflow_type values
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_workflows' 
  AND column_name = 'workflow_type';

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- appointment_status enum should have these values:
-- - scheduled
-- - confirmed
-- - waiting
-- - in_progress
-- - completed
-- - cancelled
-- - no_show
-- - pre_confirmed
--
-- whatsapp_workflows.workflow_type should be TEXT (not enum)
-- ============================================================================
