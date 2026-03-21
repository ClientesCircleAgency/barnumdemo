# Barnum — QA Checklist

> **Last updated:** 2026-02-06

---

## RBAC (Role-Based Access)

### Admin
- [ ] Can log in successfully
- [ ] Sees all sidebar items (Dashboard, Agenda, Pedidos, Pacientes, Sala de Espera, Lista de Espera, Mensagens, Configurações, Estatísticas, Plano)
- [ ] Can access `/admin/estatisticas`
- [ ] Can access `/admin/configuracoes`
- [ ] Can invite/edit/delete collaborators
- [ ] Sees all appointments in Agenda
- [ ] Sees all patients in Waiting Room

### Secretary
- [ ] Can log in successfully
- [ ] Does NOT see "Estatísticas" in sidebar
- [ ] Cannot access `/admin/estatisticas` (redirected)
- [ ] Can access `/admin/configuracoes`
- [ ] Cannot invite/delete collaborators (admin badge shown)
- [ ] Can triage requests (set duration, select doctor)
- [ ] Can manage patients
- [ ] Sees all appointments in Agenda

### Doctor
- [ ] Can log in successfully
- [ ] Sees only: Dashboard, Agenda, Pacientes, Sala de Espera
- [ ] Does NOT see: Pedidos, Mensagens, Lista de Espera, Configurações, Estatísticas
- [ ] Agenda shows ONLY own appointments
- [ ] Waiting Room shows ONLY own patients
- [ ] Patients page shows ALL patients
- [ ] Cannot access `/admin/configuracoes` (redirected to Agenda)
- [ ] Cannot access `/admin/estatisticas` (redirected)

---

## Core Flows

### Appointment Request (Public)
- [ ] Form on landing page submits successfully
- [ ] Request appears in `/admin/pedidos` as "Pendente"
- [ ] All fields saved: name, email, phone, reason, preferred date/time

### Triage (Secretary/Admin)
- [ ] Can open pending request detail
- [ ] Reason is displayed clearly
- [ ] Duration input is required (minutes, manual entry)
- [ ] Quick buttons (+15, +30, +60) work
- [ ] After setting duration: available doctors shown
- [ ] If no doctors available: "Sugerir Alternativas" button appears
- [ ] Accept button creates appointment
- [ ] Reject button requires reason (mandatory textarea)

### Appointment Management
- [ ] Create appointment from calendar
- [ ] Edit appointment details
- [ ] Cancel appointment — reason is mandatory
- [ ] Cancellation reason saved to `appointments.cancellation_reason`

### Waiting Room
- [ ] Shows appointments with status 'waiting' or 'in_progress'
- [ ] Can finalize appointment
- [ ] Finalization modal: notes textarea + review opt-out checkbox
- [ ] After finalize: `finalized_at`, `final_notes`, `review_opt_out` saved

### Consultation Types (Settings)
- [ ] "Tipos" card visible in Settings
- [ ] "Novo" button opens modal
- [ ] Can create type with name + color (NO duration field)
- [ ] Can edit existing type (name + color)
- [ ] Can delete type (with confirmation)
- [ ] Type list shows color dot + name

### Collaborator Management (Admin only)
- [ ] "Novo Colaborador" button visible
- [ ] Can invite with email + role
- [ ] For doctor: can create or link professional
- [ ] Edit button opens modal with current data
- [ ] Can change role
- [ ] Can delete collaborator (with confirmation)
- [ ] Cannot delete yourself

### Slot Suggestions
- [ ] "Sugerir Alternativas" modal opens
- [ ] Can select time slots
- [ ] Slots saved to `appointment_suggestions` table
- [ ] Request status changes to "suggested"

---

## Settings Persistence
- [ ] Working hours saved and restored on reload
- [ ] General settings (buffer, advance time) saved and restored
- [ ] Rules saved and restored
- [ ] "Guardar" button saves all settings at once

---

## Notes

- Some features (cancellation_reason, final_notes, finalized_at, review_opt_out) require pending migrations to be applied to production
- WhatsApp automations require n8n partner to implement workflows
- Doctor dashboard is generic (P2 enhancement)
