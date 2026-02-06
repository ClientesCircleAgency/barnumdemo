# Booking Flow Gap Analysis Report
**Barnum Clinic Management Platform**  
**Date**: 2026-02-05  
**Status**: ⚠️ **HISTORICAL DOCUMENT** - Some findings superseded by implementation

**NOTE**: This audit was performed on 2026-02-05. Subsequent implementation has resolved P0 gaps:
- Manual duration selection implemented (lines 95-120, `src/pages/admin/RequestsPage.tsx`)
- Availability-based filtering implemented (`src/utils/availability.ts`)
- Conditional action buttons implemented
- Mandatory rejection reason implemented

For current production readiness status, see `docs/context/PROJECT_CANONICAL_CONTEXT.md`.

---

## 1. Current Booking Flow (Implemented)

### Step 1: Public Request Creation

**File**: `src/components/AppointmentSection.tsx` (lines 49-337)

**What exists**:
- Public form captures:
  - Patient info: name, email, phone, NIF (lines 186-243)
  - Service type: "dentaria" or "rejuvenescimento" (lines 138-183)
  - Consultation reason: free text textarea (lines 245-257)
  - Preferred date: calendar picker (lines 259-299)
  - Preferred time: dropdown with predefined slots (lines 301-320)

**Data sent** (`AppointmentSection.tsx:76-85`):
```typescript
{
  name, email, phone, nif,
  reason,  // ✅ Captured
  specialty_id: SPECIALTY_IDS[data.serviceType],  // Hardcoded UUIDs
  preferred_date, preferred_time
}
```

**Database schema** (`supabase/migrations/20260129234954_remote_schema.sql:172-174`):
- ✅ `reason` column exists (added in migration `20260129234954`)
- ✅ `specialty_id` column exists (added in same migration)
- ✅ `preferred_date`, `preferred_time` columns exist

**Hook**: `src/hooks/useAppointmentRequests.ts:39-57`
- Uses `useAddAppointmentRequest()` mutation
- Inserts via Supabase client (line 46-48)
- No `.select()` after insert (RLS prevents public SELECT)

---

### Step 2: Request Listing (Admin View)

**File**: `src/pages/admin/RequestsPage.tsx` (lines 39-538)

**What exists**:
- ✅ List view shows pending requests (lines 71-293)
- ✅ Search by name/NIF/phone (lines 237-245)
- ✅ Status badges (lines 182-195)
- ✅ Click to open detail modal (line 259)

**What's missing**:
- ❌ No realtime subscription for new requests
- ❌ No popup on new request arrival
- ❌ No notification system for pending requests

**Data fetching** (`RequestsPage.tsx:40`):
```typescript
const { data: requests = [] } = useAppointmentRequests();
// Uses React Query, polls on mount, no realtime
```

---

### Step 3: Request Detail View

**File**: `src/pages/admin/RequestsPage.tsx` (lines 364-476)

**What exists**:
- ✅ Modal shows patient info (name, NIF, phone, email) (lines 394-416)
- ✅ Shows preferred date/time (lines 411-416)
- ✅ Shows specialty name (lines 387-391)
- ✅ Professional dropdown (lines 419-433)
- ✅ Three action buttons:
  - "Confirmar Horário" (line 443-450)
  - "Sugerir Alternativas" (line 451-458)
  - "Rejeitar Pedido" (line 462-470)

**What's missing**:
- ❌ **Consultation reason NOT displayed** (no UI element shows `request.reason`)
- ❌ **No duration dropdown** (consultation duration not selected)
- ❌ **No availability checking** (all professionals shown, not filtered)
- ❌ **No rejection reason field** (rejection happens without reason)
- ❌ **Buttons always shown** (not conditional on availability)

**Evidence**: Lines 394-417 show patient info but no `reason` field display.

---

### Step 4: Triage Actions (Current Implementation)

#### A) Convert to Appointment (`handleConvertToAppointment`)

**File**: `src/pages/admin/RequestsPage.tsx` (lines 82-139)

**What exists**:
- ✅ Creates/finds patient by NIF (lines 92-102)
- ✅ Uses first consultation type as default (line 105)
- ✅ Uses selected professional (line 107)
- ✅ Creates appointment with `status='confirmed'` (line 123)
- ✅ Sets duration from consultation type (line 122)
- ✅ Updates request status to `'converted'` (line 129)

**What's missing**:
- ❌ **No duration selection by secretary** (uses default from consultation type)
- ❌ **No availability validation** (doesn't check if doctor is free)
- ❌ **No consultation reason mapping** (doesn't use patient's reason to suggest consultation type)

**Code** (`RequestsPage.tsx:104-125`):
```typescript
const consultationType = consultationTypes[0]; // ❌ Always first, no logic
const professional = professionals.find(p => p.id === selectedProfessionalId);
// ❌ No availability check
await addAppointment.mutateAsync({
  duration: consultationType.default_duration, // ❌ Not secretary-selected
  // ...
});
```

#### B) Reject Request (`handleReject`)

**File**: `src/pages/admin/RequestsPage.tsx` (lines 141-150)

**What exists**:
- ✅ Updates status to `'rejected'` (line 143)
- ✅ Shows success toast (line 144)

**What's missing**:
- ❌ **No rejection reason field** (spec requires mandatory text field)
- ❌ **No WhatsApp integration** (doesn't send rejection message)
- ❌ **Database column exists locally only** (`rejection_reason` in migration `20260131121545`, NOT in production)

**Code** (`RequestsPage.tsx:141-150`):
```typescript
const handleReject = async (id: string) => {
  await updateRequestStatus.mutateAsync({ id, status: 'rejected' });
  // ❌ No rejection_reason field set
};
```

#### C) Suggest Alternatives (`handleSuggestAlternatives`)

**File**: `src/pages/admin/RequestsPage.tsx` (lines 178-180, 529-535)

**What exists**:
- ✅ Opens `SuggestAlternativesModal` (line 179)

**What's missing**:
- ❌ **Not conditional on availability** (always shown, should only show when no doctors available)
- ❌ **No integration with `appointment_suggestions` table** (modal doesn't save to DB)
- ❌ **No WhatsApp workflow trigger** (doesn't create workflow/event)

---

### Step 5: Appointment Creation from Request

**File**: `src/components/admin/AppointmentWizard.tsx` (lines 51-518)

**What exists**:
- ✅ Two-step wizard (patient selection → appointment details)
- ✅ Consultation type dropdown with duration (lines 260-283)
- ✅ Professional dropdown (lines 285-312)
- ✅ Date/time picker (lines 340-395)
- ✅ Duration selector (lines 398-426)

**What's missing**:
- ❌ **Not used for triage** (`AppointmentWizard` is separate from `RequestsPage`)
- ❌ **No pre-fill from request** (doesn't accept request data as input)
- ❌ **No availability checking** (doesn't validate doctor schedule)

**Evidence**: `AppointmentWizard` has `preselectedPatient` and `preselectedDate` props (lines 47-48) but no `preselectedRequest` prop.

---

### Step 6: Availability Checking Logic

**What exists**:
- ✅ `SuggestAlternativesModal` checks basic availability (lines 62-64, 84-86)
  - Checks if `appointments.some(apt => apt.date === dateStr && apt.time === time)`
  - **Limitation**: Only checks if ANY appointment exists at that time, not per-doctor

**What's missing**:
- ❌ **No per-doctor availability function**
- ❌ **No working hours validation** (doesn't check professional schedule)
- ❌ **No duration-aware checking** (doesn't account for appointment duration)
- ❌ **No database function** for availability queries

**Evidence**: `SuggestAlternativesModal.tsx:62-64`:
```typescript
const hasAppointment = appointments.some(
  apt => apt.date === dateStr && apt.time === requestedTime
);
// ❌ Doesn't filter by professional_id
// ❌ Doesn't check duration overlaps
```

---

### Database Schema Used

**Table**: `appointment_requests`

**Columns** (from `supabase/migrations/20260129234954_remote_schema.sql:172-174`):
- ✅ `id`, `name`, `email`, `phone`, `nif`
- ✅ `specialty_id` (UUID, NOT NULL)
- ✅ `reason` (TEXT, NOT NULL)
- ✅ `preferred_date`, `preferred_time`
- ✅ `status` (enum: `pending`, `approved`, `rejected`, `converted`)
- ✅ `notes`, `created_at`, `updated_at`, `processed_at`, `processed_by`

**Missing columns** (local migration only, NOT in production):
- ⚠️ `rejection_reason` (migration `20260131121545`, line 66)
- ⚠️ `estimated_duration` (migration `20260129234954`, line 170)

**Table**: `appointments`

**Columns** (from `supabase/migrations/20251231141633:126-140`):
- ✅ `id`, `patient_id`, `professional_id`, `specialty_id`
- ✅ `consultation_type_id`, `date`, `time`, `duration`
- ✅ `status`, `notes`, `room_id`

**Table**: `consultation_types`

**Columns** (from `supabase/migrations/20251231141633:33-39`):
- ✅ `id`, `name`, `default_duration`, `color`

---

## 2. Intended Booking Flow (From Docs)

### Intended Flow: Automation 1 — Secretary Triage

**Source**: `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md` (lines 11-71)

#### Step 1: Trigger
- **When**: New `appointment_request` created with `status='pending'`
- **Expected**: Secretary sees popup immediately

#### Step 2: Secretary Popup Content

**Expected UI** (`WHATSAPP_AUTOMATIONS_SPEC.md:17-20`):
1. **Patient's reason for consultation** (free text, displayed)
2. **Dropdown to select consultation duration**
3. **List of doctors available ONLY at requested time slot**

**Expected Behavior** (`WHATSAPP_AUTOMATIONS_SPEC.md:22-33`):

**If at least one doctor available**:
- Show: **"Agendar Consulta"** + **"Rejeitar"**
- Hide: "Sugerir Horário"

**If NO doctor available**:
- Show: **"Sugerir Horário"** + **"Rejeitar"**
- Hide: "Agendar Consulta"

**Critical Rule**: Never show all three buttons simultaneously.

#### Step 3: Rejection Flow

**Expected** (`WHATSAPP_AUTOMATIONS_SPEC.md:36-40`):
1. Click "Rejeitar" → text field appears
2. Rejection reason is **mandatory** (cannot be empty)
3. WhatsApp message sent with rejection reason
4. Request status → `rejected`

#### Step 4: Slot Suggestion Flow

**Expected** (`WHATSAPP_AUTOMATIONS_SPEC.md:43-49`):
- Generate **6 slots total**:
  - **3 slots**: Same hour, nearest 3 available days
  - **3 slots**: Same day, different available hours
- All slots must be **valid and actually available**

#### Step 5: Appointment Creation

**Expected** (`WHATSAPP_AUTOMATIONS_SPEC.md:57-61`):
- Consultation duration (selected by secretary)
- Patient's reason (displayed, used for context)
- Chosen doctor (from available doctors list)
- Rejection reason (if rejecting)
- Suggested slots (if suggesting)

---

### Intended Data Flow

**From Request to Appointment**:
1. Secretary sees request popup
2. Secretary selects consultation duration (based on reason)
3. System checks doctor availability at requested time
4. System filters doctors to only those available
5. Secretary selects doctor from filtered list
6. Secretary clicks "Agendar Consulta"
7. System creates appointment with:
   - Duration from secretary's selection
   - Doctor from filtered list
   - Consultation type mapped from reason (or default)

---

## 3. Gap Matrix (Detailed Table)

| Component | Subfeature | Intended (Docs) | Implemented (Code) | Status | Backend Ready? | What's Missing |
|-----------|------------|-----------------|---------------------|--------|----------------|----------------|
| **Request Creation** | Consultation reason capture | ✅ Required field | ✅ Implemented (`AppointmentSection.tsx:247-257`) | ✅ Match | ✅ Column exists | None |
| | Preferred date/time | ✅ Required fields | ✅ Implemented (`AppointmentSection.tsx:259-320`) | ✅ Match | ✅ Columns exist | None |
| | Patient info | ✅ Required fields | ✅ Implemented (`AppointmentSection.tsx:186-243`) | ✅ Match | ✅ Columns exist | None |
| | Specialty selection | ✅ Via service type | ✅ Implemented (hardcoded UUIDs, `AppointmentSection.tsx:69-72`) | ⚠️ Partial | ✅ Column exists | Should use dropdown, not hardcoded |
| **Request Listing** | Pending requests display | ✅ List view | ✅ Implemented (`RequestsPage.tsx:254-293`) | ✅ Match | ✅ Table exists | None |
| | Real-time updates | ✅ Popup on new request | ❌ Not implemented | ❌ Missing | ✅ Realtime possible | Realtime subscription needed |
| | Detail view | ✅ Modal with all info | ⚠️ Partial (`RequestsPage.tsx:364-476`) | ⚠️ Partial | ✅ Data exists | Missing: reason display |
| **Triage UI** | Popup on new request | ✅ Automatic popup | ❌ Not implemented | ❌ Missing | ✅ Trigger possible | Realtime subscription + popup component |
| | Consultation reason display | ✅ Show patient's reason | ❌ Not displayed (`RequestsPage.tsx:394-417`) | ❌ Missing | ✅ Column exists | Add UI element to show `request.reason` |
| | Duration selection dropdown | ✅ Secretary selects duration | ❌ Not implemented | ❌ Missing | ✅ `consultation_types.default_duration` exists | Add dropdown, map reason → consultation type |
| | Doctor selection (filtered) | ✅ Only available doctors | ❌ All doctors shown (`RequestsPage.tsx:426-430`) | ❌ Missing | ⚠️ Partial | Availability checking function needed |
| | Buttons (conditional) | ✅ Based on availability | ❌ Always shown (`RequestsPage.tsx:442-470`) | ❌ Missing | ⚠️ Partial | Availability logic + conditional rendering |
| | Rejection reason field | ✅ Mandatory text field | ❌ Not implemented (`RequestsPage.tsx:141-150`) | ❌ Missing | ⚠️ Local only | Field exists locally, not in production |
| **Doctor Availability** | Check doctor schedule | ✅ Function to check | ⚠️ Basic check exists (`SuggestAlternativesModal.tsx:62-64`) | ⚠️ Partial | ✅ `appointments` table exists | Per-doctor filtering missing |
| | Integration with agenda | ✅ Use agenda data | ⚠️ Uses appointments list | ⚠️ Partial | ✅ Data exists | Duration-aware checking needed |
| | Real-time slot checking | ✅ Validate before showing | ❌ Not implemented | ❌ Missing | ✅ Data exists | Function to check availability per doctor |
| | Professional working hours | ✅ Validate hours | ❌ Not implemented | ❌ Missing | ❌ No table | `professional_working_hours` table needed |
| **Appointment Creation** | Pre-fill from request | ✅ Use request data | ❌ Not implemented (`AppointmentWizard.tsx` has no request prop) | ❌ Missing | ✅ Data exists | Add `preselectedRequest` prop |
| | Duration from consultation type | ✅ Use selected duration | ⚠️ Uses default (`RequestsPage.tsx:122`) | ⚠️ Partial | ✅ Column exists | Secretary selection needed |
| | Doctor from availability | ✅ Only available doctors | ❌ No filtering (`RequestsPage.tsx:107`) | ❌ Missing | ⚠️ Partial | Availability check needed |
| | Confirmation flow | ✅ Create appointment | ✅ Implemented (`RequestsPage.tsx:115-125`) | ✅ Match | ✅ Table exists | None |
| **WhatsApp Integration** | Trigger on new request | ✅ Create workflow/event | ⚠️ Trigger exists (`20260128020128:216-241`) | ⚠️ Partial | ✅ Infrastructure exists | Frontend doesn't trigger |
| | Trigger on triage decision | ✅ Send message | ❌ Not implemented | ❌ Missing | ✅ Infrastructure exists | API call to create workflow needed |
| | Workflow/event creation | ✅ Automatic | ⚠️ DB trigger exists | ⚠️ Partial | ✅ Tables exist | Frontend integration missing |

---

## 4. Critical Findings

### Most Critical Gap Blocking Triage

**Gap**: No secretary triage popup with availability-based button logic

**Impact**: 
- Secretary cannot see consultation reason
- Secretary cannot select duration
- Secretary cannot see which doctors are available
- Buttons are always shown (violates spec)
- Rejection happens without reason (violates spec)

**Evidence**:
- `RequestsPage.tsx:364-476` - Modal exists but missing key features
- `WHATSAPP_AUTOMATIONS_SPEC.md:17-33` - Spec requires popup with conditional buttons

---

### Dependencies on Unapplied Migrations

**Migration**: `20260131121545_support_whatsapp_automations_option1.sql`

**Status**: ✅ Applied locally, ❌ NOT in production

**Adds**:
- `appointment_requests.rejection_reason` column (line 66)
- `appointments.cancellation_reason` column (line 82)
- `appointments.review_opt_out` column (line 99)
- `appointments.finalized_at` column (line 119)
- `desistências` table (lines 29-48)

**Impact**: 
- Rejection reason cannot be stored in production
- Automation 1 rejection flow cannot work
- Automation 5 cancellation flow cannot work
- Automation 6 finalization flow cannot work

**Evidence**: `docs/context/DOCS_VS_IMPLEMENTATION_GAP_ANALYSIS.md:516-544`

---

### Dependencies on Unavailable Data

**Missing**: Professional working hours

**Impact**:
- Cannot validate if doctor works at requested time
- Cannot filter doctors by availability
- Availability checking is incomplete

**Evidence**: No `professional_working_hours` table found in migrations

---

## 5. Backend Support Analysis

### Tables: Exists vs Needed

| Table | Exists? | Location | Status |
|-------|---------|----------|--------|
| `appointment_requests` | ✅ Yes | `20260103123427` | ✅ Production |
| `appointments` | ✅ Yes | `20251231141633` | ✅ Production |
| `consultation_types` | ✅ Yes | `20251231141633` | ✅ Production |
| `professionals` | ✅ Yes | `20251231141633` | ✅ Production |
| `appointment_suggestions` | ✅ Yes | `20260128020127` | ✅ Production |
| `desistências` | ⚠️ Local only | `20260131121545` | ❌ Not in production |
| `professional_working_hours` | ❌ No | N/A | ❌ Missing |

---

### Functions: Exists vs Needed

| Function | Exists? | Location | Purpose |
|----------|---------|----------|---------|
| `check_doctor_availability()` | ❌ No | N/A | Check if doctor free at time |
| `get_available_doctors()` | ❌ No | N/A | List doctors available at time |
| `validate_action_token()` | ✅ Yes | `20260128020127` | Validate WhatsApp action tokens |
| `trigger_pre_confirmation_event()` | ✅ Yes | `20260128020128:59-108` | Create 24h confirmation workflow |
| `trigger_send_appointment_suggestion()` | ✅ Yes | `20260128020128:247-293` | Send slot suggestions |

**Missing Functions**:
- `check_doctor_availability(professional_id UUID, date DATE, time TIME, duration INTEGER) RETURNS BOOLEAN`
- `get_available_doctors(specialty_id UUID, date DATE, time TIME, duration INTEGER) RETURNS TABLE(...)`

---

### Triggers: Exists vs Needed

| Trigger | Exists? | Location | Purpose |
|---------|---------|----------|---------|
| `trigger_appointment_pre_confirmation` | ✅ Yes | `20260128020128:104-108` | Create 24h confirmation workflow |
| `trigger_send_appointment_suggestion` | ✅ Yes | `20260128020128:247-293` | Send slot suggestions |
| `trigger_secretary_triage_notification` | ❌ No | N/A | Notify secretary on new request |

**Missing Trigger**:
- Trigger on `appointment_requests` INSERT when `status='pending'` → Create notification/workflow

---

### RLS Policies: Exists vs Needed

| Policy | Exists? | Location | Status |
|--------|---------|----------|--------|
| `Anyone can submit appointment requests` | ✅ Yes | `20260103123427:23-27` | ✅ Production |
| `Admins can manage appointment requests` | ✅ Yes | `20260103123427:30-35` | ✅ Production |
| `Secretaries can read appointment requests` | ⚠️ Partial | `20260129234954` (implied) | ⚠️ RLS exists, frontend missing |

**Evidence**: `docs/context/DOCS_VS_IMPLEMENTATION_GAP_ANALYSIS.md:148-164` - RLS supports secretary role, but frontend has no secretary UI.

---

## 6. WhatsApp Automation Coupling

### Automation 1 — Secretary Triage

**Dependencies on Booking Features**:
1. ✅ Request creation (exists)
2. ❌ Triage popup (missing)
3. ❌ Availability checking (missing)
4. ❌ Rejection reason field (missing)
5. ⚠️ Slot suggestion integration (partial)

**Status**: ❌ **BLOCKED** - Core triage UI missing

---

### Automation 2 — 24h Confirmation

**Dependencies on Booking Features**:
1. ✅ Appointment creation (exists)
2. ⚠️ Trigger timing (fires on INSERT, should fire 24h before)
3. ❌ Default confirmation logic (missing)
4. ❌ `desistências` table (local only)

**Status**: ⚠️ **PARTIAL** - Trigger timing incorrect

---

### Automation 3 — Rescheduling

**Dependencies on Booking Features**:
1. ✅ Availability checking (basic exists)
2. ⚠️ Slot suggestion (UI exists, integration missing)
3. ❌ Context preservation (unclear)

**Status**: ⚠️ **PARTIAL** - Integration incomplete

---

### Automation 4 — Slot Suggestion Resolution

**Dependencies on Booking Features**:
1. ⚠️ Slot generation (UI exists, `SuggestAlternativesModal.tsx`)
2. ❌ Database integration (doesn't save to `appointment_suggestions`)
3. ❌ WhatsApp workflow trigger (doesn't create workflow/event)

**Status**: ⚠️ **PARTIAL** - Backend integration missing

---

### Automation 5 — Staff Cancellation

**Dependencies on Booking Features**:
1. ✅ Appointment detail view (exists, `AppointmentDetailDrawer.tsx`)
2. ❌ Cancellation popup (missing)
3. ❌ Cancellation reason field (local only)
4. ❌ WhatsApp workflow trigger (missing)

**Status**: ❌ **BLOCKED** - Cancellation UI missing

---

### Automation 6 — Finalization

**Dependencies on Booking Features**:
1. ✅ Waiting room page (exists, `WaitingRoomPage.tsx`)
2. ❌ Finalization popup (missing)
3. ❌ Final notes field (local only)
4. ❌ Review opt-out checkbox (local only)
5. ⚠️ Review trigger (exists but wrong condition)

**Status**: ❌ **BLOCKED** - Finalization UI missing

---

## 7. Prioritized Backlog

### P0 — Blocking Basic Triage

#### P0-001: Display Consultation Reason in Request Modal
**What**: Add UI element to show `request.reason` in `RequestsPage` detail modal  
**Where**: `src/pages/admin/RequestsPage.tsx:394-417`  
**Evidence**: Reason field exists in DB (`types.ts:30`) but not displayed  
**Complexity**: Simple  
**Estimated Time**: 15 minutes

---

#### P0-002: Add Rejection Reason Field
**What**: Add mandatory textarea for rejection reason in rejection flow  
**Where**: `src/pages/admin/RequestsPage.tsx:141-150`  
**Dependency**: Migration `20260131121545` must be applied to production  
**Evidence**: `WHATSAPP_AUTOMATIONS_SPEC.md:36-40`  
**Complexity**: Simple  
**Estimated Time**: 30 minutes

---

#### P0-003: Implement Availability Checking Function
**What**: Create function to check if doctor is available at time/duration  
**Where**: New file `src/utils/availability.ts`  
**Evidence**: `SuggestAlternativesModal.tsx:62-64` has basic check but not per-doctor  
**Complexity**: Medium  
**Estimated Time**: 2 hours

**Function signature**:
```typescript
function checkDoctorAvailability(
  professionalId: string,
  date: string,
  time: string,
  duration: number,
  existingAppointments: Appointment[]
): boolean
```

---

#### P0-004: Filter Doctors by Availability in Triage Modal
**What**: Show only available doctors in professional dropdown  
**Where**: `src/pages/admin/RequestsPage.tsx:419-433`  
**Dependency**: P0-003 must be completed  
**Evidence**: `WHATSAPP_AUTOMATIONS_SPEC.md:20`  
**Complexity**: Medium  
**Estimated Time**: 1 hour

---

#### P0-005: Conditional Button Logic Based on Availability
**What**: Show "Agendar Consulta" only if doctors available, "Sugerir Horário" only if none available  
**Where**: `src/pages/admin/RequestsPage.tsx:439-471`  
**Dependency**: P0-003 must be completed  
**Evidence**: `WHATSAPP_AUTOMATIONS_SPEC.md:22-33`  
**Complexity**: Medium  
**Estimated Time**: 1 hour

---

### P1 — Core Triage Features

#### P1-001: Add Duration Selection Dropdown
**What**: Add dropdown to select consultation duration in triage modal  
**Where**: `src/pages/admin/RequestsPage.tsx:419-433` (add after professional dropdown)  
**Evidence**: `WHATSAPP_AUTOMATIONS_SPEC.md:19`  
**Complexity**: Simple  
**Estimated Time**: 30 minutes

**Implementation**: Map consultation reason → consultation type → duration, or allow manual selection

---

#### P1-002: Realtime Subscription for New Requests
**What**: Subscribe to `appointment_requests` table changes, show popup on new `pending` request  
**Where**: `src/pages/admin/RequestsPage.tsx` (add useEffect with subscription)  
**Evidence**: `useNotifications.ts:44-59` shows pattern for realtime subscriptions  
**Complexity**: Medium  
**Estimated Time**: 1 hour

**Pattern**:
```typescript
supabase
  .channel('appointment-requests-changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'appointment_requests',
    filter: `status=eq.pending`,
  }, (payload) => {
    // Show popup with payload.new
  })
  .subscribe()
```

---

#### P1-003: Integrate Slot Suggestion with Database
**What**: Save selected slots to `appointment_suggestions` table, trigger WhatsApp workflow  
**Where**: `src/components/admin/SuggestAlternativesModal.tsx:129-135`  
**Evidence**: `appointment_suggestions` table exists (`20260128020127:104-141`)  
**Complexity**: Medium  
**Estimated Time**: 2 hours

---

#### P1-004: Map Consultation Reason to Consultation Type
**What**: Logic to suggest consultation type based on patient's reason text  
**Where**: New utility function or in `RequestsPage.tsx`  
**Evidence**: `WHATSAPP_AUTOMATIONS_SPEC.md:57` mentions "consultation duration (selected by secretary)"  
**Complexity**: Complex (requires NLP or keyword matching)  
**Estimated Time**: 4 hours

**Alternative**: Simple dropdown with all consultation types, secretary selects manually

---

### P2 — Enhancement/Automation

#### P2-001: Professional Working Hours Table
**What**: Create table to store professional working hours, validate availability against it  
**Where**: New migration file  
**Evidence**: No working hours validation exists  
**Complexity**: Medium  
**Estimated Time**: 2 hours

---

#### P2-002: Duration-Aware Availability Checking
**What**: Check if appointment duration fits in available slot, account for overlaps  
**Where**: `src/utils/availability.ts` (enhance P0-003)  
**Evidence**: Current check only validates exact time match  
**Complexity**: Complex  
**Estimated Time**: 4 hours

---

#### P2-003: Pre-fill AppointmentWizard from Request
**What**: Add `preselectedRequest` prop to `AppointmentWizard`, pre-fill fields  
**Where**: `src/components/admin/AppointmentWizard.tsx:44-49`  
**Evidence**: Wizard has `preselectedPatient` and `preselectedDate` but not request  
**Complexity**: Simple  
**Estimated Time**: 1 hour

---

## 8. Risks & Dependencies

### Migration Dependencies

**Risk**: Production database missing required columns

**Impact**: 
- Rejection reason cannot be stored
- Cancellation reason cannot be stored
- Finalization features cannot work

**Mitigation**: 
- Apply migration `20260131121545` to production
- Verify migration applied successfully
- Update frontend to use new columns

**Evidence**: `docs/context/DOCS_VS_IMPLEMENTATION_GAP_ANALYSIS.md:516-544`

---

### Data Dependencies

**Risk**: Consultation types may not exist or be incomplete

**Impact**: 
- Duration dropdown will be empty
- Cannot create appointments without consultation type

**Mitigation**: 
- Verify `consultation_types` table has data
- Add seed data if needed
- Add validation in frontend

**Evidence**: `consultation_types` table exists (`20251231141633:33-39`) but seed data not verified

---

**Risk**: Professional schedules not stored

**Impact**: 
- Cannot validate if doctor works at requested time
- Availability checking incomplete

**Mitigation**: 
- Create `professional_working_hours` table (P2-001)
- Or use default working hours (9:00-18:00)

---

### External Dependencies

**Risk**: n8n workflows not configured

**Impact**: 
- WhatsApp messages not sent
- Automation workflows not triggered

**Mitigation**: 
- Verify n8n webhook endpoints configured
- Test webhook delivery
- Add error handling for webhook failures

**Evidence**: n8n is external service, not in repo (`docs/archive/n8n/`)

---

**Risk**: CRON job not configured

**Impact**: 
- WhatsApp events never processed
- Workflows stuck in `pending` status

**Mitigation**: 
- Add Vercel Cron configuration (`vercel.json`)
- Verify CRON job runs every 5 minutes

**Evidence**: `docs/context/DOCS_VS_IMPLEMENTATION_GAP_ANALYSIS.md:425-445`

---

## 9. Recommendations

### Top 5 Next Implementation Steps

#### 1. Apply Production Migration (P0-Critical)
**Action**: Apply migration `20260131121545_support_whatsapp_automations_option1.sql` to production  
**Why**: Enables rejection reason, cancellation reason, finalization features  
**Complexity**: Simple (migration already written)  
**Estimated Time**: 30 minutes (review + apply)

---

#### 2. Display Consultation Reason (P0-001)
**Action**: Add UI element to show `request.reason` in request detail modal  
**Why**: Secretary needs to see patient's reason to make triage decision  
**Complexity**: Simple  
**Estimated Time**: 15 minutes

**Code location**: `src/pages/admin/RequestsPage.tsx:417` (add after date/time display)

---

#### 3. Implement Availability Checking (P0-003)
**Action**: Create `checkDoctorAvailability()` function  
**Why**: Required for filtering doctors and conditional button logic  
**Complexity**: Medium  
**Estimated Time**: 2 hours

**Implementation**: Check `appointments` table for overlaps at `date`/`time` with `duration`

---

#### 4. Add Rejection Reason Field (P0-002)
**Action**: Add mandatory textarea in rejection flow  
**Why**: Spec requires rejection reason, WhatsApp message needs it  
**Complexity**: Simple  
**Estimated Time**: 30 minutes

**Dependency**: Migration `20260131121545` must be applied first

---

#### 5. Conditional Button Logic (P0-005)
**Action**: Show buttons based on doctor availability  
**Why**: Core requirement from Automation 1 spec  
**Complexity**: Medium  
**Estimated Time**: 1 hour

**Dependency**: P0-003 (availability checking) must be completed first

---

### Suggested Implementation Order

**Week 1**:
1. Apply production migration (P0-Critical)
2. Display consultation reason (P0-001)
3. Add rejection reason field (P0-002)
4. Implement availability checking (P0-003)

**Week 2**:
5. Filter doctors by availability (P0-004)
6. Conditional button logic (P0-005)
7. Duration selection dropdown (P1-001)
8. Realtime subscription (P1-002)

**Week 3**:
9. Slot suggestion database integration (P1-003)
10. Pre-fill AppointmentWizard from request (P2-003)

---

### Estimated Complexity Summary

| Task | Complexity | Time Estimate |
|------|------------|---------------|
| Apply migration | Simple | 30 min |
| Display reason | Simple | 15 min |
| Rejection reason field | Simple | 30 min |
| Availability checking | Medium | 2 hours |
| Filter doctors | Medium | 1 hour |
| Conditional buttons | Medium | 1 hour |
| Duration dropdown | Simple | 30 min |
| Realtime subscription | Medium | 1 hour |
| Slot integration | Medium | 2 hours |
| **Total P0+P1** | **Mixed** | **~9 hours** |

---

## Evidence Summary

**Files Analyzed**: 25+  
**Migrations Reviewed**: 15+  
**Documentation Reviewed**: 5 key docs  
**Code References**: 50+ line citations

**Key Evidence Files**:
- `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md` - Automation 1 spec (lines 11-71)
- `src/pages/admin/RequestsPage.tsx` - Current triage implementation (lines 39-538)
- `src/components/AppointmentSection.tsx` - Public booking form (lines 49-337)
- `supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql` - Missing columns (local only)
- `supabase/migrations/20260129234954_remote_schema.sql` - Schema updates (lines 172-174)

---

**Report Generated**: 2026-02-05  
**Status**: Complete  
**Next Steps**: Address P0 items sequentially, starting with production migration application

---

**END OF REPORT**
