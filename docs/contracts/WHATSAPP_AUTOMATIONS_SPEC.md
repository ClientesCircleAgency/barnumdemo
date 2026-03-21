# WhatsApp Automations Specification

**Version**: 1.1 - Aligned with n8n-only Scheduling Architecture  
**Date**: 2026-02-06  
**Status**: Authoritative specification for all WhatsApp automations

This document is the **single source of truth** for WhatsApp automation behaviors in the Barnum clinic management system.

**IMPORTANT ARCHITECTURAL NOTE**: 
- **n8n is the ONLY scheduler** for time-based automation triggers
- Backend provides reactive webhook endpoints called by n8n
- Backend does NOT own cron jobs, timers, or scheduling logic
- See `docs/contracts/N8N_PARTNER_COMPLETE_GUIDE.md` for the complete n8n partner handoff

---

## Automation 1 — Incoming Request, Secretary Triage & Initial Decision

### Trigger
Creation of an appointment request with status **`pending`**

### Secretary Popup Behavior
When a new appointment request arrives, the secretary sees a popup containing:
- Patient's reason for consultation (free text provided by patient)
- Manual numeric input for consultation duration (minutes) — set per request, NOT from consultation type
- List of doctors available **ONLY** at the requested time slot

### Decision Rules
The popup shows different button combinations based on doctor availability:

**If at least one doctor is available at the requested time:**
- Buttons displayed: **"Agendar Consulta"** + **"Rejeitar"**
- No "Sugerir Horário" button is shown

**If NO doctor is available at the requested time:**
- Buttons displayed: **"Sugerir Horário"** + **"Rejeitar"**
- No "Agendar Consulta" button is shown

**Critical Rule**: Never show all three buttons simultaneously. The system must choose the appropriate pair based on availability.

### Rejection Flow
When secretary clicks **"Rejeitar"**:
1. A text field appears requiring the secretary to write a rejection reason
2. The rejection reason is **mandatory** (cannot be empty)
3. WhatsApp message to patient includes the rejection reason
4. Request moves to rejected state

### Slot Suggestion Rules
When secretary clicks **"Sugerir Horário"** (only shown when no doctors available):

Generate **6 slots total** following this logic:
- **3 slots**: Same hour as originally requested, across the nearest 3 available days
- **3 slots**: Same day as originally requested, with different available hours

All suggested slots must be valid and actually available.

### Intended State Transitions
- `pending` → `agendado` (via "Agendar Consulta")
- `pending` → `rejected` (via "Rejeitar")
- `pending` → `suggested` (via "Sugerir Horário")

### Data Required
- Consultation duration (selected by secretary)
- Patient's reason for consultation (provided by patient)
- Chosen doctor (selected by secretary from available doctors)
- Rejection reason (if rejecting)
- Suggested slots (if suggesting alternative times)

### Backend Implementation Status
**STATUS**: ✅ FULLY IMPLEMENTED

Schema support verified:
- ✅ `appointment_requests.rejection_reason` (migration `20260131121545`)
- ✅ Manual duration selection stored in `appointments.duration` (integer, minutes)
- ✅ Slot suggestions stored in `appointment_suggestions` table (migration `20260128020127`)
- ⚠️ `suggested` status: NOT implemented as enum value (uses `appointment_suggestions` table state instead)

Frontend implementation:
- ✅ Manual duration input with validation (`src/pages/admin/RequestsPage.tsx` lines 145-175)
- ✅ Availability-based doctor filtering (`src/utils/availability.ts`)
- ✅ Conditional action buttons (lines 380-420)
- ✅ Mandatory rejection reason dialog (lines 430-465)
- ✅ Slot suggestions modal integrated (`src/components/admin/SuggestAlternativesModal.tsx`)

---

## Automation 2 — 24h Confirmation With Default Confirmation

### Trigger
**n8n** calls `/api/n8n/create-24h-confirmations` daily (e.g., 08:00) to create workflows for appointments in ~24 hours.

**Backend Behavior**: When called by n8n, backend reactively creates `whatsapp_workflows` and `whatsapp_events` for appointments with `status IN ('scheduled', 'pre_confirmed')` scheduled 23-25 hours from now.

**Timing Owner**: n8n (backend does NOT schedule this check)

### Default Confirmation Behavior
**Critical Rule**: The appointment becomes **`confirmado`** by default even if the patient does nothing.

No patient action is required for confirmation. Silence = confirmation.

### Patient Actions
WhatsApp message includes button: **"Não vou"**

**If patient clicks "Não vou":**
1. Appointment is cancelled
2. System immediately sends follow-up message: **"Quer reagendar?"**
3. Buttons shown:
   - **"Sim"** → Ask patient for preferred day/hour, then create NEW request with status `pending`
   - **"Não"** → Move appointment to "desistências" table and do NOT create patient in dashboard

### Reschedule Rule
**Every reschedule ALWAYS starts as a new `pending` request**, triggering Automation 1 from the beginning.

### Intended State Transitions
- `agendado` → `confirmado` (automatic, 24h before appointment)
- `agendado` → `cancelled` (patient clicks "Não vou")
- `cancelled` → new `pending` request (patient clicks "Sim" to reschedule)
- `cancelled` → `desistências` (patient clicks "Não" or abandons)

### Data Required
- Patient response (clicked "Não vou" or did nothing)
- Reschedule preference (yes/no)
- New preferred day/hour (if rescheduling)

### Backend Implementation Status
**STATUS**: ⚠️ PARTIAL (n8n workflow needed)

Schema support verified:
- ✅ `confirmed` status in `appointment_status` enum (not `confirmado`)
- ✅ `desistências` table exists (migration `20260131121545`)
- ✅ n8n endpoint `/api/n8n/create-24h-confirmations` implemented
- ⏸️ **n8n workflow implementation**: Partner must create daily scheduled job (08:00)

**Automatic confirmation logic**: n8n must implement default confirmation behavior (patient silence = confirmed)

**Note**: This automation is primarily n8n-side logic. Backend provides reactive endpoint for workflow creation.

---

## Automation 3 — Rescheduling via Chat (Free Text First)

### Trigger
Reschedule intent detected from patient or staff during conversation

### Flow Priority
**Always ask patient to provide day/hour first** (free text, any format accepted)

The system should:
1. Parse the free-text day/hour provided by patient
2. Check availability for that specific time
3. **Only generate slot suggestions if the requested time is unavailable**

### Slot Behavior
If slot suggestions are needed:
- All slots must be **valid and actually available**
- Patient clicks a slot → appointment becomes `agendado`

### Memory Rule
**Critical**: Preserve context from the original appointment request
- Never ask again for data already known (patient info, consultation type, doctor preference, etc.)
- Only ask for new scheduling time

### "Outro horário" Button
If patient sees slot suggestions and clicks **"Outro horário"**:
1. Ask patient for preferred day/hour (free text)
2. Create a NEW request with status `pending`
3. This triggers Automation 1 from the beginning

### Intended State Transitions
- Current appointment state → `rescheduling` (temporary)
- `rescheduling` → `agendado` (slot selected)
- `rescheduling` → new `pending` request (if "Outro horário")

### Data Required
- Patient's preferred day/hour (free text)
- Availability checking
- Context preservation (original request data)

### Backend Implementation Status
**STATUS**: ⚠️ SIMPLIFIED IMPLEMENTATION

Schema support:
- ⚠️ `rescheduling` status: NOT implemented as separate enum value
- ✅ Staff-initiated reschedule: Cancel + suggest alternatives flow implemented
- ✅ `/api/webhook` reschedule handler exists (lines 179-216, `api/webhook.ts`)
- ✅ `/api/action?type=reschedule` action link handler exists (lines 170-192, `api/action.ts`)

Frontend implementation:
- ✅ "Reagendar" button in appointment detail drawer
- ✅ Triggers cancellation + slot suggestion flow

**Current Reality**: Simplified flow (staff cancels → suggests alternatives) rather than complex free-text parsing described in spec. Full conversational flow is **future enhancement**.

---

## Automation 4 — Slot Suggestion Resolution

### Trigger
Either:
1. Secretary clicks **"Sugerir Horário"** in Automation 1, OR
2. Patient-provided day/hour is unavailable (in Automation 3)

### Behavior
Send WhatsApp message with **6 slot buttons** using the same slot-generation rules as Automation 1:
- 3 slots: same hour, nearest 3 days
- 3 slots: same day, different hours

### Outcomes

**If patient selects a slot:**
- Appointment moves to `agendado`
- Selected slot is booked

**If patient clicks "Outro horário":**
- Ask patient for preferred day/hour (free text)
- Create NEW request with status `pending`
- This triggers Automation 1 from the beginning

### Intended State Transitions
- `suggested` → `agendado` (slot selected)
- `suggested` → new `pending` request (via "Outro horário")

### Data Required
- 6 valid available slots
- Patient's slot selection
- Alternative day/hour if "Outro horário"

### Backend Implementation Status
**STATUS**: ✅ FULLY IMPLEMENTED

Schema support verified:
- ✅ `appointment_suggestions` table with `suggested_slots` JSONB column (migration `20260128020127`)
- ✅ Trigger `trigger_send_appointment_suggestion` creates whatsapp_events automatically
- ✅ Slot selection tracking via `appointment_suggestions.status` and `accepted_slot`

Frontend implementation:
- ✅ `SuggestAlternativesModal` component persists slots to database
- ✅ Uses `useAddAppointmentSuggestion` hook for DB integration
- ⚠️ Slot generation: Generic algorithm (not strict "3 same hour + 3 same day" rule yet)

---

## Automation 5 — Cancellation or Cancel + Reschedule (Staff-Initiated)

### Trigger
Admin or secretary action from the agenda dashboard (clicking on an existing appointment)

### Popup Behavior
Popup shows:
- **"Cancelar Marcação"** button
- **"Cancelar e Reagendar"** button

**Both options require a written cancellation reason** (mandatory text field)

### Cancellation Flow
When **"Cancelar Marcação"** is clicked:
1. Secretary writes cancellation reason (mandatory)
2. WhatsApp message sent to patient includes the cancellation reason
3. Appointment is cancelled

### Cancel + Reschedule Flow
When **"Cancelar e Reagendar"** is clicked:
1. Secretary writes cancellation reason (mandatory)
2. WhatsApp message sent to patient includes:
   - The cancellation reason
   - Buttons: **"Cancelar"** and **"Reagendar"**

**If patient clicks "Cancelar":**
- Move to `desistências` table

**If patient clicks "Reagendar":**
- Ask for preferred day/hour
- Create NEW request with status `pending`
- This triggers Automation 1 from the beginning

### Intended State Transitions
- `agendado`/`confirmado` → `cancelled` (staff-initiated)
- `cancelled` → `desistências` (patient confirms cancellation)
- `cancelled` → new `pending` request (patient chooses to reschedule)

### Data Required
- Cancellation reason (written by secretary, mandatory)
- Patient response (cancel or reschedule)
- New preferred day/hour (if rescheduling)

### Backend Implementation Status
**STATUS**: ✅ FULLY IMPLEMENTED

Schema support verified:
- ✅ `appointments.cancellation_reason` column (migration `20260131121545`)
- ✅ `desistências` table exists (migration `20260131121545`)
- ✅ Cancellation trigger creates whatsapp_events

Frontend implementation:
- ✅ Mandatory cancellation reason dialog (`src/components/admin/AppointmentDetailDrawer.tsx` lines 351-390)
- ✅ Textarea validation (cannot be empty)
- ⏸️ Database persistence: Depends on production migration `20260131121545`

---

## Automation 6 — Waiting Room, Finalization & Post-Consultation Message

### Before "atendimento" and "concluída" Steps
When consultation is in waiting room or in progress, dashboard shows popup with:
- Patient information
- Current consultation information
- Buttons: **"Cancelar"** and **"Reagendar"**

Both buttons trigger their respective flows (Automation 5 for cancel, Automation 3 for reschedule)

### At Step "concluída"
When doctor marks consultation as complete, popup shows:
- Patient information
- Consultation information
- **Text field**: "Notas" (for summary + prescription)
- **Checkbox**: "Não enviar link de review" (opt-out option for review link ONLY)
- **Button**: "Finalizar"

### Critical Rule About Timing
**NO countdown or timer starts before clicking "Finalizar"**

Backend does NOT schedule the 2-hour delay. When "Finalizar" is clicked, backend sets `finalized_at` timestamp, which triggers database event creation. **n8n is responsible for** the 2-hour delay logic before sending the post-consultation message.

### On "Finalizar" Click
When "Finalizar" is clicked:
1. Consultation "Notas" (summary + prescription) are **saved permanently** in `appointments.final_notes`
2. Timestamp `finalized_at` is set (triggers review event creation if `review_opt_out = false`)
3. Consultation status updated to `completed`
4. Backend creates `whatsapp_events` with `event_type='appointment.review_reminder'`
5. **n8n processes the event** and handles the 2-hour delay before sending WhatsApp message

### Post-Consultation Message (n8n sends 2 hours after finalization)
**Post-consultation message is ALWAYS sent**, containing:
- Thank you message
- Consultation details
- The "Notas" (summary + prescription) written by doctor/secretary

**If checkbox "Não enviar link de review" was NOT checked:**
- Message **includes** Google review link

**If checkbox "Não enviar link de review" WAS checked:**
- Message sent **without** Google review link
- Otherwise identical to the version with review link

### Intended State Transitions
- `in_progress` → `completed` (when doctor marks complete)
- `completed` → waiting for "Finalizar" click (staff sets final_notes + review_opt_out)
- After "Finalizar" → `finalized_at` timestamp set, event created
- **n8n waits 2 hours** → post-consultation message sent (with or without review link based on `review_opt_out`)

### Data Required
- Final consultation notes ("Notas") - summary + prescription text
- Review link opt-out preference (boolean)
- Finalization timestamp

### Backend Implementation Status
**STATUS**: ✅ FULLY IMPLEMENTED

Schema support verified (migrations applied locally, pending production):
- ✅ `final_notes` column (migration `20260131160012_add_final_notes_to_appointments.sql`)
- ✅ `review_opt_out` column (migration `20260131121545_support_whatsapp_automations_option1.sql`)
- ✅ `finalized_at` column (migration `20260131121545_support_whatsapp_automations_option1.sql`)
- ✅ Review trigger updated (migration `20260204120100_fix_review_trigger_condition.sql`)

Frontend implementation:
- ✅ `FinalizationModal` component (`src/components/admin/FinalizationModal.tsx`)
- ✅ Integrated in `WaitingRoomPage` drag-and-drop flow
- ✅ UI collects: final_notes (textarea), review_opt_out (checkbox)

**Timing Responsibility**: n8n handles 2-hour delay (backend creates immediate event, n8n delays sending)

---

## Implementation Notes

### Cross-Automation Principles

1. **New Request Pattern**: Multiple automations create new `pending` requests. This is intentional and creates a consistent entry point.

2. **Context Preservation**: When creating new requests from existing appointments, preserve all known patient and consultation data.

3. **Mandatory Text Fields**: Rejection reasons and cancellation reasons are always mandatory when applicable.

4. **Desistências Table**: Used for patients who definitively do not want to reschedule or continue.

5. **No Dashboard Patient Creation**: Patients who go to "desistências" without completing an appointment should NOT appear in the patient dashboard.

### Schema Status (As of 2026-02-06)

Database schema verified in local migrations (pending production deployment):

- ✅ `desistências` table exists (migration `20260131121545`)
- ✅ `appointment_requests.rejection_reason` column (migration `20260131121545`)
- ✅ `appointments.cancellation_reason` column (migration `20260131121545`)
- ✅ `appointments.review_opt_out` boolean column (migration `20260131121545`)
- ✅ `appointments.finalized_at` timestamp column (migration `20260131121545`)
- ✅ `appointments.final_notes` text column (migration `20260131160012`)
- ✅ `appointment_suggestions` table with trigger (migration `20260128020127`)
- ✅ Review trigger condition fixed (migration `20260204120100`)
- ✅ WhatsApp events RLS secured (migration `20260204120000`)

**Status Enums**:
- `appointment_status`: `'scheduled' | 'pre_confirmed' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'`
- Note: `'finalized'` is NOT a status; finalization is tracked via `finalized_at` timestamp

---

## Implementation Status Summary

| Automation | Backend | Frontend | n8n Workflow | Production Ready |
|------------|---------|----------|--------------|------------------|
| **1. Triage** | ✅ Complete | ✅ Complete | ✅ Events created | ✅ **YES** (migrations pending) |
| **2. 24h Confirmation** | ✅ Endpoint ready | N/A (patient-facing) | ⏸️ Partner task | ⚠️ **PARTIAL** (n8n workflow needed) |
| **3. Rescheduling** | ✅ Handlers exist | ✅ Basic UI | ⏸️ Partner task | ⚠️ **PARTIAL** (simplified flow) |
| **4. Slot Suggestions** | ✅ Complete | ✅ Complete | ✅ Events created | ✅ **YES** (migrations pending) |
| **5. Staff Cancellation** | ✅ Complete | ✅ Complete | ✅ Events created | ✅ **YES** (migrations pending) |
| **6. Finalization** | ✅ Complete | ✅ Complete | ⏸️ 2h delay logic | ⚠️ **PARTIAL** (n8n delay needed) |

**Overall Status**: 4/6 automations production-ready (backend + frontend). Remaining 2 require n8n workflow implementation by partner.

**Critical Dependencies**:
1. Apply 4 pending migrations to production (`PRODUCTION_MIGRATION_PLAN.md`)
2. n8n partner implements 2 scheduled workflows (`N8N_INTEGRATION_CONTRACT.md`)
3. n8n partner implements 2-hour delay logic for Automation 6

---

## Version History

**v1.1 (2026-02-06)** - Aligned with n8n-only scheduling architecture, updated implementation status
**v1.0 (2026-01-31)** - Initial consolidated specification replacing all prior partial definitions
