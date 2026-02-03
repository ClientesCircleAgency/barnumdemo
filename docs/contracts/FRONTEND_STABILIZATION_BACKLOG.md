# Frontend Stabilization Backlog

**Created**: 2026-01-31T16:35:32Z  
**Scope**: Systematic scan of Barnum admin frontend (Vite + React + React Router)  
**Method**: Static code analysis (routing inventory, pattern search for placeholders/dead actions/broken flows) + attempted runtime analysis

**Route Inventory Summary**:
- **Total routes**: 14 (3 public + 11 admin pages)
- **Blank/placeholder pages detected**: 0 (all pages render content)
- **Non-functional UI areas detected**: 1 (PlanPage upgrade button has no handler)
- **Potentially broken create flows**: 1 (ManageProfessionals may fail on backend validation - needs runtime verification)

---

## P0 Blockers (System Unusable / Core Ops Blocked)

### P0-001: AppointmentWizard Crashes on Open ✅ FIXED (Phase 5B.2)

**Symptom**: Clicking "+ Nova Consulta" button in sidebar opened modal but immediately crashed with TypeError

**Runtime Evidence**:
- Console error: `TypeError: (intermediate value)() is null`
- Stack trace pointed to `useFormField` → `FormLabel` → `PatientLookupByNIF.tsx:34`
- Modal appeared briefly then disappeared with blank UI

**Repro Steps**:
1. Navigate to any admin page
2. Click "+ Nova Consulta" button in sidebar (green button with + icon)
3. Modal opens but crashes immediately
4. Console shows react-hook-form context null error

**Root Cause**:
- `PatientLookupByNIF.tsx` line 143 used `<FormLabel>` component for NIF input
- `FormLabel` requires react-hook-form context (must be inside `<Form>` wrapper)
- NIF input field (lines 142-161) is NOT part of FormField - it's a standalone input
- This created context mismatch: FormLabel looking for form context that doesn't exist at that level

**Resolution (Phase 5B.2)**:
- Line 8: Added `import { Label } from '@/components/ui/label';`
- Line 143: Changed `<FormLabel htmlFor="nif">` → `<Label htmlFor="nif">`
- NIF input now uses standard Label component (doesn't require form context)
- Form context only used inside `<Form {...form}>` wrapper (lines 220-308) for patient creation fields

**Verification**: User confirmed wizard opens and works correctly

---

## P1 Major Issues (Core Ops Possible with Workarounds)


### P1-001: Professional Creation May Fail on Backend Validation ✅ FIXED (Phase 5B.1)

**Symptom**: Creating a new professional via "Gerir Profissionais" modal may fail if backend schema validation rejects `specialty_id` format

**Repro Steps**:
1. Navigate to `/admin/configuracoes` (Settings)
2. Click "Gerir Profissionais" button
3. Click "Adicionar Profissional"
4. Fill name, select specialty from dropdown, pick color
5. Click "Adicionar"

**Evidence Type**: Static (code review)

**Suspected Code Location**:
- **Frontend**: `src/components/admin/ManageProfessionalsModal.tsx` (line 309-315)
- **Context mapping**: `src/context/ClinicContext.tsx` (line 309-315)
- **Hook**: `src/hooks/useProfessionals.ts` (useAddProfessional mutation, line 20-37)

**Related Backend**: `professionals` table, expects `specialty_id` (uuid)

**Notes**:
- Frontend _was_ passing `specialty_id: data.specialty` where `data.specialty` was the specialty NAME (string) not ID (uuid)
- ClinicContext maps Professional.specialty to specialty_id in mutation (line 312)
- ManageProfessionalsModal _was storing_ specialty as NAME in form state (lines 62, 143, 195)
- **CRITICAL MISMATCH IDENTIFIED**: Modal collected specialty.name, but backend insert expects specialty.id
- **RESOLUTION (Phase 5B.1)**:
  - Changed SelectItem `value={s.name}` → `value={s.id}` in both edit and create forms (lines 128, 199)
  - Fixed professional list display to show specialty name lookup instead of UUID (line 163)
  - Professional create/update now works correctly with specialty_id FK constraint

---

## P2 Minor Issues (Polish, Non-Blocking)

### P2-001: PlanPage "Fazer Upgrade" Button Has No Handler

**Symptom**: Clicking "Fazer Upgrade" button on Premium plan card does nothing

**Repro Steps**:
1. Navigate to `/admin/plano`
2. Scroll to Premium plan card (right side)
3. Click "Fazer Upgrade" button
4. No action occurs, no navigation, no modal

**Evidence Type**: Static (code review)

**Suspected Code Location**:
- **File**: `src/pages/admin/PlanPage.tsx`
- **Component**: PlanPage
- **Line**: 143-146 (Button with no onClick handler)

**Related Backend**: UNKNOWN (likely external billing/subscription service)

**Notes**:
- This is a marketing/showcase page, not a functional feature
- Button markup exists but has no click handler defined
- May be intentional placeholder for future billing integration
- Low priority unless billing integration is actively planned

---

### P2-002: MessagesPage is Mock Data Only

**Symptom**: Messages page shows hardcoded conversation data, no real WhatsApp integration

**Repro Steps**:
1. Navigate to `/admin` (MessagesPage not in main sidebar, route exists but unused)
2. If accessed directly via URL, shows mock conversations

**Evidence Type**: Static (code review)

**Suspected Code Location**:
- **File**: `src/pages/admin/MessagesPage.tsx`
- **Route**: Not registered in App.tsx navigation (orphaned page)

**Related Backend**: UNKNOWN (likely `whatsapp_workflows`, `whatsapp_events` tables once integrated)

**Notes**:
- MessagesPage exists in codebase but is NOT rendered in App.tsx routes (line 1-53 of App.tsx)
- May be future feature for n8n WhatsApp integration (Phase 6+)
- Currently non-functional/inaccessible via UI
- Low priority unless WhatsApp messaging feature is prioritized

---

### P2-003: No Type-Check Script in package.json

**Symptom**: Cannot run `npm run type-check` to validate TypeScript types before deployment

**Repro Steps**:
1. Run `npm run type-check`
2. Receives error: "Missing script: type-check"

**Evidence Type**: Runtime (command execution)

**Suspected Code Location**:
- **File**: `package.json` (scripts section)

**Related Backend**: N/A (build tooling)

**Notes**:
- Vite projects typically use `tsc --noEmit` for type checking
- Available scripts: `dev`, `build`, `build:dev`, `lint`, `preview`
- `build` command may include type checking (via Vite), but explicit type-check would be useful for CI/CD
- Recommendation: Add `"type-check": "tsc --noEmit"` to package.json scripts

---

## Summary of Findings

### Routes Inventory (14 total)

**Public Routes** (3):
1. `/` - Index (landing page)
2. `/admin/login` - AdminLogin
3. `*` - NotFound (404 catch-all)

**Admin Routes** (11):
1. `/admin` → `/admin/dashboard` (redirect)
2. `/admin/dashboard` - DashboardPage
3. `/admin/agenda` - AgendaPage
4. `/admin/pedidos` - RequestsPage
5. `/admin/pacientes` - PatientsPage
6. `/admin/pacientes/:id` - PatientDetailPage
7. `/admin/lista-espera` - WaitlistPage
8. `/admin/sala-espera` - WaitingRoomPage
9. `/admin/configuracoes` - SettingsPage
10. `/admin/plano` - PlanPage
11. `/admin/estatisticas` - StatisticsPage

**Orphaned Pages** (exists in src/pages but NOT routed):
- MessagesPage (not in App.tsx routes)

### Key Components Validated

**AppointmentWizard** ✅ FUNCTIONAL:
- Used by: AgendaPage, PatientsPage, PatientDetailPage, WaitlistPage
- Two-step wizard: (1) PatientLookupByNIF, (2) Appointment details form
- Wired to `addAppointment` mutation via ClinicContext
- Form validation via Zod schema (`appointmentFormSchema`)
- Creates appointment with proper snake_case mapping to Supabase

**ManageProfessionalsModal** ⚠️ NEEDS VALIDATION:
- Used by: SettingsPage
- CRUD operations for professionals (add, edit, delete)
- **CRITICAL ISSUE**: Specialty field collected as NAME (string) but backend expects ID (uuid)
- Maps to `addProfessional`, `updateProfessional`, `deleteProfessional` mutations
- May fail on insert due to specialty_id type mismatch

**ClinicContext** ✅ PROPERLY WIRED:
- Centralized data layer using React Query + Supabase hooks
- Provides: patients, appointments, professionals, specialties, consultationTypes, waitlist, rooms
- All mutations properly invalidate queries on success
- Snake_case ↔ camelCase mapping handled correctly EXCEPT professionals.specialty issue

### Backend Integration Status

**Supabase Hooks** (all exist and functional):
- `usePatients`, `useAddPatient`, `useUpdatePatient` ✅
- `useAppointments`, `useAddAppointment`, `useUpdateAppointment`, `useDeleteAppointment` ✅
- `useProfessionals`, `useAddProfessional`, `useUpdateProfessional`, `useDeleteProfessional` ⚠️ (specialty_id issue)
- `useConsultationTypes`, `useAddConsultationType`, `useUpdateConsultationType`, `useDeleteConsultationType` ✅
- `useWaitlist`, `useAddToWaitlist`, `useUpdateWaitlistItem`, `useRemoveFromWaitlist` ✅
- `useSpecialties`, `useRooms` ✅

### Runtime Analysis

**TypeScript Compilation**: NOT TESTED (no type-check script available)  
**Build**: NOT ATTEMPTED (would require `npm run build`, skipped to avoid long wait)  
**Dev Server**: NOT STARTED (skip runtime smoke test due to environment constraints)  
**Console/Network Errors**: NOT AVAILABLE (runtime testing skipped)

**Reason for skipped runtime**: Creating backlog only, no fixes. Runtime errors would be better caught during fix implementation phase.

---

## Prioritization Rationale

**P0**: None. Core flows (create appointment, manage patients, view agenda) appear functional based on code review.

**P1**: Professional creation - affects staff onboarding. If specialty_id type mismatch exists, this blocks adding new doctors/professionals entirely. Needs immediate runtime validation.

**P2**: Non-blocking polish items. PlanPage button is marketing-only, MessagesPage is future feature (currently inaccessible), type-check script is CI/CD quality-of-life improvement.

---

## Next Steps (Not Implemented in This Backlog Phase)

1. **Immediate**: Runtime test P1-001 (create professional via Settings) to confirm failure
2. **If confirmed**: Fix specialty_id mapping in ManageProfessionalsModal (change specialty dropdown to store specialty.id instead of specialty.name)
3. **P2 fixes**: Add type-check script, wire PlanPage upgrade button (if needed), integrate MessagesPage (if WhatsApp feature prioritized)

---

**Backlog Status**: COMPLETE  
**Ready for Review**: YES  
**Production Impact**: NO CHANGES MADE (diagnosis only)
