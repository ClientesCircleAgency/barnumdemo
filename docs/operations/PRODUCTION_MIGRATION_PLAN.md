# Barnum — Production Migration Plan

> **Last updated:** 2026-02-06
> **Status:** NOT YET APPLIED — migrations pending production deployment

---

## Pending Migrations (Strict Order)

These 4 migrations must be applied to production **in this exact order**. Each builds on the previous.

### Migration 1: WhatsApp Automations Support
**File:** `20260131121545_support_whatsapp_automations_option1.sql`
**What it adds:**
- `appointments.cancellation_reason` (TEXT, nullable)
- `appointments.review_opt_out` (BOOLEAN, default false)
- `appointments.finalized_at` (TIMESTAMPTZ, nullable)
- `appointment_requests.rejection_reason` (TEXT, nullable)
- `desistências` table (dropout records)
- Updated `request_status` enum to include `rejected`

### Migration 2: Final Notes
**File:** `20260131160012_add_final_notes_to_appointments.sql`
**What it adds:**
- `appointments.final_notes` (TEXT, nullable)

### Migration 3: WhatsApp Events RLS Fix
**File:** `20260204120000_fix_whatsapp_events_rls.sql`
**What it changes:**
- Restricts `whatsapp_events` to service role only (removes authenticated user access)
- PHI protection — event payloads contain patient data

### Migration 4: Review Trigger Fix
**File:** `20260204120100_fix_review_trigger_condition.sql`
**What it changes:**
- Updates review trigger to fire on `finalized_at` transition (NULL → NOT NULL)
- Adds `review_opt_out = false` condition
- Previously fired on `status = 'completed'` (incorrect)

---

## How to Apply

### Option A: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Open each migration file in order (1 → 2 → 3 → 4)
3. Run each one, wait for success before proceeding to next

### Option B: Via Supabase CLI (if linked to production)
```bash
supabase db push
```
This applies all pending migrations in order.

---

## Validation After Applying

Run these SQL queries to confirm everything was applied correctly:

```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN ('cancellation_reason', 'review_opt_out', 'finalized_at', 'final_notes');

-- Should return 4 rows

-- Check rejection_reason column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointment_requests' 
AND column_name = 'rejection_reason';

-- Should return 1 row

-- Check desistências table exists
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'desistências';

-- Should return 1

-- Check whatsapp_events RLS
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'whatsapp_events';

-- Should NOT show any policy allowing 'authenticated' role SELECT

-- Check review trigger condition
SELECT tgname, pg_get_functiondef(tgfoid) 
FROM pg_trigger 
WHERE tgname = 'trigger_appointment_review_reminder';
```

---

## Environment Variables (Required for Production)

After migrations, ensure these are set in Vercel:

| Variable | Status |
|----------|--------|
| `N8N_WEBHOOK_SECRET` | Must be set (coordinate with n8n partner) |
| `WEBHOOK_SECRET` | Must be set (coordinate with n8n partner) |
| `SUPABASE_SERVICE_ROLE_KEY` | Should already be set |
| `SITE_URL` | Set in Edge Functions secrets |

---

## n8n Scheduling

After migrations are applied and environment variables set, the n8n partner can begin implementing workflows. See `docs/contracts/N8N_PARTNER_COMPLETE_GUIDE.md` for the complete integration guide.

**The backend does NOT schedule anything.** n8n is the only scheduler.
