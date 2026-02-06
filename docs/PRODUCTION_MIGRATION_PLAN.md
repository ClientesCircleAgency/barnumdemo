# Production Migration Plan
**Barnum Clinic Management Platform**  
**Date**: 2026-02-06  
**Target Branch**: `dev` → Production Deployment

---

## Environment Variables (REQUIRED)

Before running migrations, ensure these environment variables are configured in production:

**Supabase** (existing):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Vercel Cron** (new):
- `CRON_SECRET` (optional, for additional cron auth security)

**Internal API** (existing):
- `INTERNAL_API_SECRET` (for manual `/api/internal` calls)

**WhatsApp/n8n** (existing):
- `N8N_WEBHOOK_BASE_URL`
- `WEBHOOK_SECRET`

---

## Migration Order (STRICT)

Apply these migrations in **EXACT** order. Each migration depends on the previous one.

### Migration 1: WhatsApp Automation Schema
**File**: `supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql`

**What it adds**:
- `desistências` table (lines 29-48)
- `appointment_requests.rejection_reason` column (line 66)
- `appointments.cancellation_reason` column (line 82)
- `appointments.review_opt_out` column (line 99)
- `appointments.finalized_at` column (line 119)

**Dependencies**: None (applies cleanly after `20260130002738_remote_schema.sql`)

**Validation SQL**:
```sql
-- Verify columns added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointment_requests' AND column_name = 'rejection_reason';
-- Expected: 1 row (rejection_reason, text, YES)

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
WHERE column_name IN ('cancellation_reason', 'review_opt_out', 'finalized_at');
-- Expected: 3 rows

-- Verify desistências table
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'desistências'
);
-- Expected: true
```

---

### Migration 2: Final Notes Column
**File**: `supabase/migrations/20260131160012_add_final_notes_to_appointments.sql`

**What it adds**:
- `appointments.final_notes` column (line 28-31)

**Dependencies**: None (can apply independently, but ordered after migration 1 for consistency)

**Validation SQL**:
```sql
-- Verify column added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' AND column_name = 'final_notes';
-- Expected: 1 row (final_notes, text, YES)
```

---

### Migration 3: Fix Review Trigger Condition
**File**: `supabase/migrations/20260204120100_fix_review_trigger_condition.sql`

**What it does**:
- Replaces `trigger_review_reminder_event()` function
- Changes condition from `status='completed'` to `finalized_at IS NOT NULL AND review_opt_out = false`

**Dependencies**: 
- **REQUIRES Migration 1** (adds `finalized_at` and `review_opt_out` columns)
- Will **FAIL** if applied before Migration 1

**Validation SQL**:
```sql
-- Verify function updated
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'trigger_review_reminder_event';
-- Expected: Function body contains "finalized_at IS NULL AND NEW.finalized_at IS NOT NULL"

-- Verify trigger exists
SELECT tgname, tgrelid::regclass, tgfoid::regproc 
FROM pg_trigger 
WHERE tgname = 'trigger_appointment_review_reminder';
-- Expected: 1 row (trigger_appointment_review_reminder, appointments, trigger_review_reminder_event)
```

---

### Migration 4: Restrict whatsapp_events RLS Policy
**File**: `supabase/migrations/20260204120000_restrict_whatsapp_events_rls.sql`

**What it does**:
- Drops "Users can view whatsapp_events for their clinic" SELECT policy
- Ensures only service role can access `whatsapp_events`

**Dependencies**: None (can apply independently)

**Validation SQL**:
```sql
-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'whatsapp_events';
-- Expected: (whatsapp_events, true)

-- Verify only service role policy exists
SELECT polname, polroles::regrole[], polcmd 
FROM pg_policy 
WHERE polrelid = 'public.whatsapp_events'::regclass;
-- Expected: 1 row ("Service role has full access to whatsapp_events", {service_role}, *)
-- Should NOT have "Users can view whatsapp_events" policy
```

---

## Pre-Migration Checklist

Before applying ANY migration to production:

1. ✅ Backup production database
   ```bash
   # Via Supabase dashboard: Settings > Database > Backup
   ```

2. ✅ Verify current production migration state
   ```sql
   SELECT version FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC 
   LIMIT 5;
   -- Expected last: 20260130002738
   ```

3. ✅ Test migrations locally first
   ```bash
   supabase db reset  # Reset local DB
   # Verify all migrations apply cleanly
   # Run manual tests (triage, cancellation, finalization)
   ```

4. ✅ Verify no active user sessions during migration window
   ```sql
   SELECT COUNT(*) FROM auth.sessions 
   WHERE NOT expires_at < now();
   -- Recommended: 0 (schedule migrations during low-traffic period)
   ```

---

## Migration Execution Commands

### Option A: Supabase CLI (Recommended)
```bash
# Set production project
supabase link --project-ref oziejxqmghwmtjufstfp

# Apply migrations sequentially
supabase db push

# Verify migrations applied
supabase migration list
```

### Option B: Supabase Dashboard
1. Navigate to: Database > Migrations
2. Paste each migration SQL in order
3. Click "Run" and verify success before proceeding to next

### Option C: Direct SQL (Advanced)
```sql
-- Connect to production database with service role key

-- Migration 1
\i supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql
-- Run validation SQL above

-- Migration 2
\i supabase/migrations/20260131160012_add_final_notes_to_appointments.sql
-- Run validation SQL above

-- Migration 3
\i supabase/migrations/20260204120100_fix_review_trigger_condition.sql
-- Run validation SQL above

-- Migration 4
\i supabase/migrations/20260204120000_restrict_whatsapp_events_rls.sql
-- Run validation SQL above
```

---

## n8n Scheduling

**Backend does NOT schedule anything.** n8n is the only scheduler.

**What the backend provides:**
- Reactive webhook endpoints that n8n calls on its schedule
- Event processing logic (no timing decisions)

**For complete n8n integration details:**
- See `docs/contracts/N8N_INTEGRATION_CONTRACT.md`
- Includes: webhook URLs, authentication, schedules, environment variables

**n8n must schedule:**
1. Process events (every 5 minutes) → calls `/api/n8n/process-events`
2. Create 24h confirmations (daily 08:00) → calls `/api/n8n/create-24h-confirmations`

---

## Post-Migration Verification

### 1. Schema Verification
```sql
-- Verify all new columns exist
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('appointments', 'appointment_requests') 
  AND column_name IN (
    'rejection_reason', 
    'cancellation_reason', 
    'review_opt_out', 
    'finalized_at', 
    'final_notes'
  )
ORDER BY table_name, column_name;
-- Expected: 5 rows
```

### 2. Trigger Verification
```sql
-- Verify review trigger updated
SELECT 
  t.tgname AS trigger_name,
  t.tgrelid::regclass AS table_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname LIKE '%review%';
-- Expected: trigger_appointment_review_reminder on appointments
```

### 3. RLS Policy Verification
```sql
-- Verify whatsapp_events policies
SELECT schemaname, tablename, policyname, roles 
FROM pg_policies 
WHERE tablename = 'whatsapp_events';
-- Expected: 1 row (service_role policy only)
```

### 4. Functional Testing (Manual)

**Test 1: Rejection with Reason**
1. Create test appointment request
2. Open in admin triage modal
3. Click "Rejeitar" → Enter reason → Confirm
4. Verify: `rejection_reason` saved to DB
   ```sql
   SELECT id, status, rejection_reason 
   FROM appointment_requests 
   WHERE status = 'rejected' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Test 2: Cancellation with Reason**
1. Open existing appointment
2. Click "Cancelar Consulta" → Enter reason → Confirm
3. Verify: `cancellation_reason` saved (when implemented)

**Test 3: Finalization with Review**
1. Drag appointment to "Concluídas"
2. Finalization modal appears
3. Enter final notes, check/uncheck review opt-out
4. Click "Finalizar"
5. Verify: `finalized_at`, `final_notes`, `review_opt_out` saved (when implemented)
6. Wait 2 hours (or manually trigger)
7. Verify: Review workflow created ONLY if `review_opt_out = false`
   ```sql
   SELECT workflow_type, scheduled_at, message_payload 
   FROM whatsapp_workflows 
   WHERE workflow_type = 'review_2h' 
   ORDER BY created_at DESC 
   LIMIT 1;
   -- Should only exist if review_opt_out was false
   ```

---

## Rollback Plan

If migration causes issues, rollback using:

### Rollback Migration 4 (RLS Policy)
```sql
-- Re-add authenticated user SELECT policy if needed
CREATE POLICY "Users can view whatsapp_events for their clinic"
  ON public.whatsapp_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = entity_id
    )
  );
```

### Rollback Migration 3 (Review Trigger)
```sql
-- Restore old trigger condition
CREATE OR REPLACE FUNCTION trigger_review_reminder_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- ... original logic ...
  END IF;
  RETURN NEW;
END;
$$;
```

### Rollback Migrations 1 & 2 (Schema Changes)
**NOT RECOMMENDED** - Dropping columns will lose data. Instead:
1. Fix application code to not use new columns
2. Deploy hotfix
3. Consider dropping columns only after verification period (30 days)

---

## Timeline & Impact

**Estimated downtime**: 0 minutes (migrations are additive, backward-compatible)

**Risk level**: LOW
- All migrations are non-breaking (add columns, update triggers, no data loss)
- Application continues working during migration (RLS bypassed by service role)
- Frontend gracefully handles missing columns (TODO comments document dependencies)

**Recommended schedule**:
- Apply during low-traffic period (e.g., Sunday 2:00 AM)
- Have 1-2 team members on standby for validation
- Monitor error logs for 24 hours post-migration

---

## Success Criteria

Migration is successful when:
- ✅ All 4 migrations appear in `supabase_migrations.schema_migrations`
- ✅ All validation SQL queries return expected results
- ✅ No errors in Supabase logs (Database > Logs)
- ✅ Application functions normally (test all flows)
- ✅ CRON job processes events every 5 minutes (monitor `whatsapp_events.processed_at`)

---

## Contacts & Support

**Migration Owner**: Development Team  
**Supabase Project**: `oziejxqmghwmtjufstfp`  
**Vercel Project**: (to be configured)

**If issues occur**:
1. Check Supabase logs: Dashboard > Database > Logs
2. Check Vercel logs: Dashboard > Deployments > Function Logs
3. Verify env vars: `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_SECRET`, `N8N_WEBHOOK_BASE_URL`

---

**Document Created**: 2026-02-05  
**Status**: Ready for production application  
**Reviewed**: Pending
