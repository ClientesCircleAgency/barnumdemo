# Manual QA Checklist
**Barnum Clinic Management Platform**  
**Version**: 1.0  
**Date**: 2026-02-06

---

## Pre-Requisites

**Local Environment**:
```bash
npm run dev
# Supabase local (if testing DB operations):
supabase start
```

**Test User**:
- Admin account with `user_roles` entry: `role='admin'`
- Email/password configured in Supabase Auth

**Database State**:
- 4 pending migrations must be applied for full functionality:
  - `20260131121545_support_whatsapp_automations_option1.sql`
  - `20260131160012_add_final_notes_to_appointments.sql`
  - `20260204120100_fix_review_trigger_condition.sql`
  - `20260204120000_restrict_whatsapp_events_rls.sql`

---

## Test 1: Login & Role Gating

### Test 1.1: Admin Login
**Steps**:
1. Navigate to `/admin/login`
2. Enter admin credentials
3. Click "Entrar"

**Expected**:
- ✅ Redirected to `/admin/dashboard`
- ✅ No error messages
- ✅ Full UI visible (sidebar, all menu items)

### Test 1.2: Secretary Login (NEW)
**Steps**:
1. Create secretary account via Settings > Utilizadores
2. Log out
3. Log in with secretary email (invite link)
4. Enter password

**Expected**:
- ✅ Login succeeds (no immediate logout)
- ✅ Dashboard accessible
- ⚠️ Some features may show "Admin" badge (expected)

**SQL Verification**:
```sql
SELECT u.email, ur.role 
FROM auth.users u 
JOIN public.user_roles ur ON u.id = ur.user_id 
WHERE ur.role = 'secretary';
-- Expected: At least 1 row
```

### Test 1.3: Doctor Login (NEW)
**Steps**:
1. Create doctor account via Settings > Utilizadores
2. Log out
3. Log in with doctor email (invite link)
4. Enter password

**Expected**:
- ✅ Login succeeds
- ✅ Dashboard accessible
- ⚠️ Limited view (may see "Admin" badges on restricted features)

---

## Test 2: Settings - Consultation Types CRUD

### Test 2.1: View Tipos de Consulta
**Steps**:
1. Log in as admin
2. Navigate to `/admin/configuracoes`
3. Scroll to "Tipos" card (right column)

**Expected**:
- ✅ Card visible with purple icon
- ✅ "Novo" button visible in top-right (with Plus icon)
- ✅ Existing consultation types listed (name + duration)

**Evidence**: Lines 296-320, `src/pages/admin/SettingsPage.tsx`

### Test 2.2: Create New Tipo
**Steps**:
1. Click "Novo" button
2. Modal opens: "Gerir Tipos de Consulta"
3. Click "Adicionar Tipo" button at bottom
4. Enter name: "Consulta de Teste"
5. Select duration: "45 minutos"
6. Click "Adicionar"

**Expected**:
- ✅ Toast notification: "Tipo de consulta adicionado"
- ✅ New type appears in modal list immediately
- ✅ New type appears in Settings page list after closing modal

**SQL Verification**:
```sql
SELECT id, name, default_duration 
FROM consultation_types 
WHERE name = 'Consulta de Teste';
-- Expected: 1 row with default_duration = 45
```

### Test 2.3: Edit Existing Tipo
**Steps**:
1. Open modal
2. Click pencil icon on any tipo
3. Change name to "Nome Editado"
4. Change duration
5. Click checkmark icon

**Expected**:
- ✅ Toast: "Tipo de consulta atualizado"
- ✅ Changes reflect immediately

### Test 2.4: Delete Tipo
**Steps**:
1. Click trash icon on any tipo
2. Confirmation dialog appears
3. Click "Remover"

**Expected**:
- ✅ Toast: "Tipo de consulta removido"
- ✅ Tipo removed from list

---

## Test 3: Triage Flow (Automation 1)

### Test 3.1: Manual Duration Required
**Steps**:
1. Navigate to `/admin/pedidos`
2. Click any pending request
3. Detail modal opens

**Expected**:
- ✅ Consultation reason displayed clearly
- ✅ "Duração da Consulta (minutos)" input visible
- ✅ Helper buttons visible: +15, +30, +60
- ❌ "Selecionar Profissional" dropdown NOT visible yet (conditional)

### Test 3.2: Duration Validation
**Steps**:
1. Enter duration: 3 (below minimum)
2. Try to proceed

**Expected**:
- ✅ Validation error or disabled state

**Steps**:
1. Enter duration: 2000 (above maximum)
2. Try to proceed

**Expected**:
- ✅ Validation error or disabled state

### Test 3.3: Availability Filtering
**Steps**:
1. Enter valid duration: 30
2. Observe doctor dropdown

**Expected**:
- ✅ "Selecionar Profissional" dropdown appears
- ✅ Dropdown filtered by availability (uses `getAvailableProfessionalIds()`)
- ✅ Only doctors with free slots shown

### Test 3.4: Conditional Action Buttons
**Steps**:
1. Set duration where doctors ARE available
2. Select doctor

**Expected**:
- ✅ "Agendar Consulta" button visible
- ✅ "Rejeitar" button visible
- ❌ "Sugerir Alternativas" button NOT visible

**Steps**:
1. Set duration where NO doctors available

**Expected**:
- ✅ "Sugerir Alternativas" button visible
- ✅ "Rejeitar" button visible
- ❌ "Agendar Consulta" button NOT visible

### Test 3.5: Rejection Reason Required
**Steps**:
1. Click "Rejeitar"
2. Dialog opens
3. Try to submit without entering reason

**Expected**:
- ✅ Button disabled or validation error

**Steps**:
1. Enter reason: "Não há disponibilidade esta semana"
2. Click "Confirmar Rejeição"

**Expected**:
- ✅ Request rejected
- ✅ Reason stored (after migration `20260131121545` applied)

**SQL Verification** (after migration):
```sql
SELECT id, status, rejection_reason 
FROM appointment_requests 
WHERE status = 'rejected' 
ORDER BY created_at DESC 
LIMIT 5;
-- Expected: rejection_reason populated
```

---

## Test 4: Slot Suggestions (Automation 4)

### Test 4.1: Suggest Alternatives
**Steps**:
1. In triage flow, when no doctors available, click "Sugerir Alternativas"
2. Modal opens with calendar/slot selector
3. Select 6 slots
4. Click "Enviar Sugestões"

**Expected**:
- ✅ Toast: "Sugestões enviadas com sucesso"
- ✅ Slots persisted to database
- ✅ WhatsApp workflow/event created

**SQL Verification**:
```sql
-- Check appointment_suggestions
SELECT id, appointment_request_id, suggested_slots, status 
FROM appointment_suggestions 
ORDER BY created_at DESC 
LIMIT 5;
-- Expected: suggested_slots JSONB array with 6 slots

-- Check whatsapp_workflows
SELECT id, workflow_type, status 
FROM whatsapp_workflows 
WHERE workflow_type = 'slot_suggestion' 
ORDER BY created_at DESC 
LIMIT 5;
-- Expected: 1 workflow per suggestion

-- Check whatsapp_events
SELECT id, event_type, status 
FROM whatsapp_events 
WHERE event_type = 'appointment.suggestion_sent' 
ORDER BY created_at DESC 
LIMIT 5;
-- Expected: 1 event per workflow
```

---

## Test 5: Cancellation with Reason (Automation 5)

### Test 5.1: Cancel Appointment
**Steps**:
1. Navigate to `/admin/agenda` or `/admin/sala-espera`
2. Click any appointment
3. Drawer opens
4. Click "Cancelar Consulta" button
5. Dialog opens: "Cancelar Consulta"
6. Try to submit without reason

**Expected**:
- ✅ Button disabled (cannot submit empty reason)

**Steps**:
1. Enter reason: "Paciente solicitou cancelamento"
2. Click "Confirmar Cancelamento"

**Expected**:
- ✅ Appointment status changed to `cancelled`
- ✅ Reason stored (after migration `20260131121545` applied)
- ⏸️ WhatsApp event created (if trigger exists)

**SQL Verification** (after migration):
```sql
SELECT id, status, cancellation_reason 
FROM appointments 
WHERE status = 'cancelled' 
ORDER BY updated_at DESC 
LIMIT 5;
-- Expected: cancellation_reason populated
```

---

## Test 6: Finalization Flow (Automation 6)

### Test 6.1: Finalize from Waiting Room
**Steps**:
1. Navigate to `/admin/sala-espera`
2. Drag appointment from "Em Atendimento" to "Concluídas"
3. Modal opens: "Finalizar Consulta"

**Expected**:
- ✅ "Notas Finais" textarea visible
- ✅ "Não enviar link de avaliação" checkbox visible
- ✅ "Finalizar" button visible

### Test 6.2: Finalization Persists Data
**Steps**:
1. Enter final notes: "Consulta normal. Prescrição: Paracetamol 500mg."
2. Check "Não enviar link de avaliação"
3. Click "Finalizar"

**Expected**:
- ✅ Appointment status changed to `completed`
- ✅ Data persisted (after migrations applied)
- ✅ Review event created IF `review_opt_out = false`

**SQL Verification** (after migrations):
```sql
SELECT id, status, final_notes, finalized_at, review_opt_out 
FROM appointments 
WHERE finalized_at IS NOT NULL 
ORDER BY finalized_at DESC 
LIMIT 5;
-- Expected: All 3 fields populated

-- Check review event created (only if review_opt_out = false)
SELECT we.id, we.event_type, a.review_opt_out 
FROM whatsapp_events we 
JOIN appointments a ON a.id = we.entity_id 
WHERE we.event_type = 'appointment.review_reminder' 
ORDER BY we.created_at DESC 
LIMIT 5;
-- Expected: Only appointments with review_opt_out = false
```

---

## Test 7: n8n Webhook Endpoints

### Test 7.1: Process Events Endpoint
**Steps**:
```bash
curl -X POST http://localhost:5173/api/n8n/process-events \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: test-secret" \
  -d '{}'
```

**Expected**:
```json
{
  "success": true,
  "processed": 0,
  "failed": 0
}
```
(Or positive numbers if events exist)

### Test 7.2: Create 24h Confirmations
**Steps**:
```bash
# Test with specific date
curl -X POST http://localhost:5173/api/n8n/create-24h-confirmations \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: test-secret" \
  -d '{"targetDate":"2026-02-07"}'
```

**Expected**:
```json
{
  "success": true,
  "checked": 5,
  "created": 3,
  "skipped": 2
}
```
(Numbers depend on appointment data)

**SQL Verification**:
```sql
SELECT COUNT(*) FROM whatsapp_workflows 
WHERE workflow_type = 'pre_confirmation' 
  AND created_at >= NOW() - INTERVAL '1 hour';
-- Expected: Number matches "created" in response
```

---

## Test 8: Role-Based UI (After Full Implementation)

### Test 8.1: Admin Features
**Role**: Admin  
**Expected Access**:
- ✅ Settings > Utilizadores (invite form visible)
- ✅ Settings > Tipos (Novo button visible)
- ✅ All menu items visible
- ✅ Full CRUD on all entities

### Test 8.2: Secretary Features (Future)
**Role**: Secretary  
**Expected Access**:
- ✅ Triage flow (pedidos page)
- ✅ Agenda (read/update appointments)
- ✅ Waiting room (manage patient flow)
- ⚠️ Settings > Utilizadores (should see "Admin" badge, form hidden)
- ⚠️ Settings > Tipos (should see "Admin" badge, Novo button hidden)

**Current Status**: Secretary can login but sees admin-only features with badges (not hidden yet)

### Test 8.3: Doctor Features (Future)
**Role**: Doctor  
**Expected Access**:
- ✅ Own agenda only (filtered appointments)
- ✅ Update own appointment notes
- ❌ Cannot access other doctors' appointments
- ❌ Cannot access Settings
- ❌ Cannot access Pedidos (triage)

**Current Status**: Doctor can login but UI is not role-scoped yet. Full doctor-specific UI is future work.

---

## Test 9: End-to-End WhatsApp Automation

### Test 9.1: Full Triage to Suggestion Flow
**Steps**:
1. Create pending request (via public form or direct DB insert)
2. Admin/secretary triages → no doctors available
3. Click "Sugerir Alternativas"
4. Select 6 slots
5. Click "Enviar Sugestões"

**Expected DB State**:
```sql
-- 1. Suggestion persisted
SELECT * FROM appointment_suggestions ORDER BY created_at DESC LIMIT 1;

-- 2. Workflow created
SELECT * FROM whatsapp_workflows ORDER BY created_at DESC LIMIT 1;

-- 3. Event created with pending status
SELECT * FROM whatsapp_events WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;
```

**Expected n8n Behavior** (after n8n workflows active):
- ✅ n8n calls `/api/n8n/process-events` every 5 min
- ✅ Event status changes: `pending` → `processing` → `sent`
- ✅ Patient receives WhatsApp with 6 slot buttons

---

## Known Limitations (As of 2026-02-06)

### L1: Migrations Not in Production
**Impact**: DB columns missing, persistence fails gracefully (UI works, data lost on refresh)
**Fix**: Apply 4 migrations via `supabase db push` or production dashboard

### L2: n8n Workflows Not Configured
**Impact**: Events created but never sent to WhatsApp (stuck in `status='pending'`)
**Fix**: n8n partner creates 2 scheduled workflows (see `N8N_INTEGRATION_CONTRACT.md`)

### L3: Role-Based UI Incomplete
**Impact**: Secretary/doctor see all UI (with some "Admin" badges), not fully scoped UX
**Fix**: Phase 2 work - implement role-specific routing, sidebar filtering, feature hiding

### L4: 6-Slot Generation Algorithm Generic
**Impact**: Slot suggestions work but don't follow strict "3 same hour + 3 same day" rule
**Fix**: P2 enhancement in `SuggestAlternativesModal` slot generation logic

---

## Smoke Test (5 Minutes)

Quick validation that core flows work:

1. ✅ Login as admin → dashboard loads
2. ✅ Settings > Tipos > Click "Novo" → modal opens
3. ✅ Add tipo → persists and shows in list
4. ✅ Pedidos > Click request → duration input visible
5. ✅ Enter duration → doctor dropdown appears (filtered)
6. ✅ Suggest Alternatives → modal opens, slots selectable
7. ✅ Send suggestions → DB insert succeeds (check console/network tab)
8. ✅ Sala Espera > Drag to completed → finalization modal opens

**If all 8 steps pass**: ✅ System is functional for admin workflows

---

**End of Checklist**
