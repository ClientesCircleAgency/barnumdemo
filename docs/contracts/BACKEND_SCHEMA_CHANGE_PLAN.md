# Backend Schema Change Plan — Option 1: Minimal Changes

**Date**: 2026-01-31  
**Version**: 1.0  
**Purpose**: Implement minimal schema changes to support WhatsApp Automations 1–6  
**Status**: Proposed (NOT applied to production)

---

## Summary of Gaps Found

Based on `BACKEND_VERIFICATION_REPORT.md`, the following critical items were identified:

### ❌ NOT FOUND (6 items)

1. **`desistências` table** - No dedicated storage for abandoned appointments
2. **`rejection_reason`** - Cannot store secretary's reason for rejecting request
3. **`review_opt_out`** - No flag to prevent sending review messages (Automation 6)
4. **`finalized_at`** - No timestamp to track when "Finalizar" was clicked (Automation 6)
5. **`appointments.cancellation_reason`** - Only exists in requests, not appointments (Automation 5)
6. **`finalized` status** - No distinction between "completed" and "finalized"

### ⚠️ AMBIGUOUS (relevant items)

1. **`estimated_duration` vs `consultation_duration`** - Field exists as `estimated_duration` in `appointment_requests`
   - **Decision**: Use existing field, update documentation to clarify naming

---

## Proposed Minimal Changes

### 1. Create `desistências` Table

**Purpose**: Store patients who definitively abandon the scheduling process  
**Supports**: Automation 2, Automation 5

```sql
CREATE TABLE IF NOT EXISTS public.desistências (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id),
  appointment_request_id uuid REFERENCES public.appointment_requests(id),
  appointment_id uuid REFERENCES public.appointments(id),
  reason text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
```

**Fields**:
- `patient_id` - Link to patient record (may not exist if never completed appointment)
- `appointment_request_id` - Original request that led to desistência
- `appointment_id` - Confirmed appointment if cancelled (nullable)
- `reason` - Why patient abandoned (e.g., "Patient declined reschedule")
- `created_by_user_id` - Staff member who recorded desistência
- `notes` - Additional context

**Backwards Compatibility**: New table, no impact on existing data

---

### 2. Add `rejection_reason` to `appointment_requests`

**Purpose**: Store secretary's written reason for rejecting appointment request  
**Supports**: Automation 1

```sql
ALTER TABLE public.appointment_requests 
ADD COLUMN IF NOT EXISTS rejection_reason text;
```

**Usage**: When secretary clicks "Rejeitar", they write a mandatory reason that is stored here and sent to patient via WhatsApp

**Backwards Compatibility**: Nullable column, existing records unaffected

---

### 3. Add `cancellation_reason` to `appointments`

**Purpose**: Store secretary's written reason for staff-initiated cancellation  
**Supports**: Automation 5

```sql
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS cancellation_reason text;
```

**Usage**: When staff cancels or cancel+reschedules from dashboard, reason is stored here

**Note**: `appointment_requests` already has `cancel_reason` for request-level cancellations. This new field is for confirmed appointments.

**Backwards Compatibility**: Nullable column, existing records unaffected

---

### 4. Add `review_opt_out` to `appointments`

**Purpose**: Flag to prevent sending post-consultation review message  
**Supports**: Automation 6

```sql
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS review_opt_out boolean NOT NULL DEFAULT false;
```

**Usage**: When secretary/doctor clicks "Finalizar", if checkbox "Não enviar review" is checked, this is set to `true`

**Backwards Compatibility**: Default `false` means existing appointments will send review (safe default)

---

### 5. Add `finalized_at` to `appointments`

**Purpose**: Record exact timestamp when "Finalizar" button was clicked  
**Supports**: Automation 6

```sql
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
```

**Usage**: 
- When "Finalizar" clicked → set to `now()`
- The 2-hour countdown for review automation starts from this timestamp
- Consultation is removed from active pipeline after this is set

**Backwards Compatibility**: Nullable, existing completed appointments have `NULL` (indicating they were not finalized via new flow)

---

## Mapping: Changes → Automation Requirements

| Proposed Change | Automation | Requirement |
|----------------|-----------|-------------|
| `desistências` table | **Automation 2** | Move to "desistências" when patient clicks "Não" after cancellation |
| `desistências` table | **Automation 5** | Move to "desistências" when patient confirms cancellation |
| `rejection_reason` | **Automation 1** | Store and send secretary's mandatory rejection reason |
| `cancellation_reason` | **Automation 5** | Store and send secretary's mandatory cancellation reason |
| `review_opt_out` | **Automation 6** | Prevent review message if checkbox checked |
| `finalized_at` | **Automation 6** | Trigger 2-hour countdown only after "Finalizar" clicked |

---

## Backwards Compatibility & Defaults

### New Table (`desistências`)
- **Impact**: None on existing data
- **Migration**: Creates empty table
- **Application**: Frontend/API can start using immediately

### New Columns (all nullable or with defaults)
- `rejection_reason` - Nullable, existing requests unaffected
- `cancellation_reason` - Nullable, existing appointments unaffected  
- `review_opt_out` - Default `false`, existing appointments will send review
- `finalized_at` - Nullable, existing completed appointments marked as `NULL`

### No Breaking Changes
- No existing columns modified
- No data migrations required
- All changes are additive

---

## Items Explicitly Deferred

### 1. Enum Modifications
**Status**: NOT CHANGED

The verification report noted potential enum gaps, but analysis shows:
- `request_status` enum already has: `pending`, `suggested`, `rejected`, `cancelled` ✅
- `appointment_status` enum already has: `scheduled`, `confirmed`, `completed`, `waiting` ✅
- No additional enum values required for automations 1-6

**Decision**: Use existing enum values. Map automation terms to schema:
- "agendado" → `scheduled` (appointments) or `converted` (requests)
- "confirmado" → `confirmed`
- "concluída" → `completed`

### 2. `estimated_duration` Field Name
**Status**: KEEP AS-IS

The field exists as `appointment_requests.estimated_duration` (integer).  
The automation spec refers to "consultation_duration".

**Decision**: Use existing field, update automation implementation to use `estimated_duration`. Field serves the same purpose.

### 3. Slot Suggestion Storage
**Status**: ALREADY EXISTS

Verification report confirmed:
- `appointment_suggestions` table exists ✅
- `suggested_slots jsonb` field exists ✅

**Decision**: No changes needed, existing infrastructure sufficient.

### 4. Context Preservation
**Status**: ALREADY EXISTS

Verification report confirmed:
- `appointment_suggestions.appointment_request_id` exists ✅
- Link between suggestions and original requests supported ✅

**Decision**: No changes needed.

---

## Migration Strategy

### Phase 1: Generate Migration (THIS PHASE)
1. Create migration file via `supabase migration new support_whatsapp_automations_option1`
2. Add SQL for all proposed changes
3. DO NOT apply to production

### Phase 2: Local Validation (NEXT PHASE)
1. Apply migration to local Supabase instance
2. Verify schema changes applied correctly
3. Test automations against local database

### Phase 3: Production Deployment (FUTURE)
1. Review and approve migration
2. Apply to production via Supabase CLI or dashboard
3. Update frontend/API to use new fields

---

## SQL Migration Preview

The migration will include:

```sql
-- Migration: support_whatsapp_automations_option1
-- Purpose: Add minimal schema support for WhatsApp Automations 1-6
-- Status: NOT applied to production

-- =====================================================
-- 1. Create desistências table
-- Supports: Automation 2 (24h confirmation), Automation 5 (cancellation)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.desistências (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id),
  appointment_request_id uuid REFERENCES public.appointment_requests(id),
  appointment_id uuid REFERENCES public.appointments(id),
  reason text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- =====================================================
-- 2. Add rejection_reason to appointment_requests
-- Supports: Automation 1 (incoming request, secretary triage)
-- =====================================================
ALTER TABLE public.appointment_requests 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- =====================================================
-- 3. Add cancellation_reason to appointments
-- Supports: Automation 5 (staff-initiated cancellation)
-- =====================================================
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- =====================================================
-- 4. Add review_opt_out to appointments
-- Supports: Automation 6 (waiting room, finalization & review)
-- =====================================================
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS review_opt_out boolean NOT NULL DEFAULT false;

-- =====================================================
-- 5. Add finalized_at to appointments
-- Supports: Automation 6 (waiting room, finalization & review)
-- =====================================================
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
```

---

## Verification Checklist

After migration is applied (in Phase 2), verify:

- [ ] `desistências` table exists with correct schema
- [ ] `appointment_requests.rejection_reason` column exists (text, nullable)
- [ ] `appointments.cancellation_reason` column exists (text, nullable)
- [ ] `appointments.review_opt_out` column exists (boolean, default false)
- [ ] `appointments.finalized_at` column exists (timestamptz, nullable)
- [ ] Existing data unaffected (all columns nullable or with safe defaults)
- [ ] No errors in migration application

---

## Next Steps

1. **Review this plan** - Confirm proposed changes align with automation requirements
2. **Review generated migration file** - Verify SQL is correct and safe
3. **Phase 4: Local validation** - Apply migration to local instance and test
4. **Production approval** - Decide when to apply to production Supabase

---

**Plan Status**: Ready for review  
**Migration Status**: Generated, NOT applied  
**Production Impact**: None (migration not applied)
