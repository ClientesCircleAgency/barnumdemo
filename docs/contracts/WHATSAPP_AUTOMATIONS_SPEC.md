# WhatsApp Automations Specification

**Version**: 1.0 - Final Consolidated  
**Date**: 2026-01-31  
**Status**: Authoritative specification for all WhatsApp automations

This document is the **single source of truth** for WhatsApp automation behaviors in the Barnum clinic management system. It replaces all prior partial or incremental automation descriptions.

---

## Automation 1 — Incoming Request, Secretary Triage & Initial Decision

### Trigger
Creation of an appointment request with status **`pending`**

### Secretary Popup Behavior
When a new appointment request arrives, the secretary sees a popup containing:
- Patient's reason for consultation (free text provided by patient)
- Dropdown to select consultation duration
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

### Schema Support
**STATUS**: UNKNOWN / TO VERIFY

Must verify backend support for:
- Storage of rejection reason
- Storage of consultation duration
- Storage of suggestion metadata
- `suggested` status in appointment request enum

---

## Automation 2 — 24h Confirmation With Default Confirmation

### Trigger
Existing appointment in state **`agendado`**, 24 hours before scheduled time

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

### Schema Support
**STATUS**: UNKNOWN / TO VERIFY

Must verify backend support for:
- `confirmado` status in appointment enum
- `desistências` table existence
- Automatic state transition logic
- Link between cancelled appointment and new pending request

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

### Schema Support
**STATUS**: UNKNOWN / TO VERIFY

Must verify backend support for:
- `rescheduling` status or equivalent
- Context preservation mechanism
- Link between original and rescheduled appointments

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

### Schema Support
**STATUS**: UNKNOWN / TO VERIFY

Must verify backend support for:
- Storage of suggested slots
- Slot selection tracking

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

### Schema Support
**STATUS**: UNKNOWN / TO VERIFY

Must verify backend support for:
- Storage of cancellation reason (staff-written)
- `desistências` table
- Staff-initiated cancellation tracking

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

The 2-hour post-consultation message countdown **only begins** after the secretary/doctor clicks the "Finalizar" button.

### On "Finalizar" Click
When "Finalizar" is clicked:
1. Consultation "Notas" (summary + prescription) are **saved permanently** in consultation record
2. Consultation is **removed from active pipeline**
3. Consultation is **permanently recorded** in all relevant systems
4. Post-consultation message automation is **scheduled for 2 hours later**

### 2 Hours After "Finalizar" (ALWAYS SENT)
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
- `concluída` → waiting for "Finalizar" click (no timer)
- After "Finalizar" → `finalized` (removed from pipeline, recorded permanently)
- After 2 hours → post-consultation message **ALWAYS sent** (with or without review link)

### Data Required
- Final consultation notes ("Notas") - summary + prescription text
- Review link opt-out preference (boolean)
- Finalization timestamp

### Required Backend Support (To Be Verified/Implemented)
Must verify or add schema support for:
- `final_notes` storage on consultation record (appointments table)
- `review_opt_out` flag (boolean) - controls review link inclusion ONLY
- `finalized_at` timestamp (records when "Finalizar" was clicked)
- Delayed job scheduling mechanism (for 2-hour delay)
- Permanent consultation record storage
- Pipeline removal logic

### Schema Support
**STATUS**: PARTIAL - review_opt_out and finalized_at exist, final_notes TO BE ADDED IN PHASE 4.1

Must verify backend support for:
- ✅ Review opt-out flag (added in Phase 3)
- ✅ Finalization timestamp (added in Phase 3)
- ⚠️ **Final notes storage** (TO BE ADDED)
- ✅ Delayed job/webhook scheduling
- ⚠️ Separation between "concluída" and "finalized" states

---

## Implementation Notes

### Cross-Automation Principles

1. **New Request Pattern**: Multiple automations create new `pending` requests. This is intentional and creates a consistent entry point.

2. **Context Preservation**: When creating new requests from existing appointments, preserve all known patient and consultation data.

3. **Mandatory Text Fields**: Rejection reasons and cancellation reasons are always mandatory when applicable.

4. **Desistências Table**: Used for patients who definitively do not want to reschedule or continue.

5. **No Dashboard Patient Creation**: Patients who go to "desistências" without completing an appointment should NOT appear in the patient dashboard.

### Schema Verification Required

Before implementing these automations, the following must be verified in the Supabase schema:

- [ ] `desistências` table exists
- [ ] Appointment request statuses include: `pending`, `agendado`, `confirmado`, `rejected`, `suggested`, `cancelled`, `finalized`
- [ ] Storage for: rejection_reason, cancellation_reason, consultation_duration
- [ ] Review opt-out flag: `review_opt_out` (boolean)
- [ ] Finalization timestamp: `finalized_at`
- [ ] Slot suggestion storage mechanism
- [ ] Context preservation across request cycles
- [ ] Delayed job/webhook scheduling capability

---

## Version History

**v1.0 (2026-01-31)** - Initial consolidated specification replacing all prior partial definitions
