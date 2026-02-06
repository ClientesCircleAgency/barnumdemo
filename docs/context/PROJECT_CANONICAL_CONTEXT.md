# Barnum — Project Canonical Context

> **Last updated:** 2026-02-06
> **Role:** Single source of truth. Only updated after verified changes.
> **Rule:** Every claim here is backed by code/migrations. No speculation.

---

## 1. Project Overview

**Name:** Barnum (dental clinic management SaaS)
**Goal:** Full-featured clinic management platform for dental clinics, with WhatsApp automations via n8n. Designed to be sold and customized per clinic.

**Business model:** Sell to dental clinics → customize branding, specialties, professionals per client.

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 18.3.1 |
| Build | Vite (SWC) | 5.4.19 |
| UI | Radix UI + Tailwind CSS + shadcn/ui | 3.4.17 |
| Forms | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| State | TanStack React Query | 5.83.0 |
| Database | Supabase (PostgreSQL) | supabase-js 2.89.0 |
| Auth | Supabase Auth (email/password) | Built-in |
| Edge Functions | Supabase Edge Functions (Deno) | 4 functions |
| API | Vercel Serverless (Node.js) | @vercel/node 5.5.28 |
| Hosting | Vercel | SPA with rewrites |
| Automations | n8n (external) | Partner-managed |
| WhatsApp | Via n8n → WhatsApp Business API | External |

---

## 3. Core Architectural Rules

### Rule 1: n8n is the ONLY scheduler
- Backend owns ZERO time-based logic (no cron, no setInterval)
- Backend is purely reactive: webhook endpoints + DB writes
- n8n decides WHEN to trigger automations
- Reference: `docs/contracts/N8N_PARTNER_COMPLETE_GUIDE.md`

### Rule 2: Edge Functions for admin operations
- Collaborator management (invite/list/update/delete) runs via Supabase Edge Functions
- `SUPABASE_SERVICE_ROLE_KEY` is NEVER exposed to the frontend
- Frontend calls Edge Functions via `supabase.functions.invoke()`
- Auth: `x-user-token` header with user JWT, decoded locally in Edge Function

### Rule 3: Duration is per-request, not per-type
- Consultation types = name + color only (no fixed duration)
- The secretary sets duration manually for each appointment request during triage
- `consultation_types.default_duration` column exists in DB but is NOT used in UI

### Rule 4: Self-signup disabled
- Only admins can invite new users via the "Colaboradores" section
- Login page has no signup option
- Supabase Auth configured for invite-only

---

## 4. Roles & Permissions (RBAC)

| Area | Admin | Secretary | Doctor |
|------|-------|-----------|--------|
| Dashboard | Full | Full | Generic (P2) |
| Agenda | All doctors | All doctors | Own only |
| Pedidos (Requests) | Full CRUD | Full CRUD | Hidden |
| Pacientes | All | All | All |
| Sala de Espera | All | All | Own only |
| Mensagens | Full | Full | Hidden |
| Lista de Espera | Full | Full | Hidden |
| Estatísticas | Full | Hidden | Hidden |
| Configurações | Full | Full (no user mgmt) | Hidden |
| Colaboradores | Full CRUD | View only | Hidden |

**Implementation:**
- `src/hooks/useAuth.ts`: Role detection via `has_role()` RPC
- `src/components/admin/ProtectedRoute.tsx`: Route guards with `allowedRoles`
- `src/components/admin/AdminSidebar.tsx`: Menu visibility per role
- `src/App.tsx`: Route-level guards

---

## 5. Database Schema (Key Tables)

### Auth & Roles
- **`user_roles`**: `user_id` → `role` (app_role: admin/secretary/doctor)
- **`user_profiles`**: `user_id` → `full_name`, `photo_url`
- **`has_role(user_id, role)`**: PostgreSQL function for role checking

### Clinic Configuration
- **`clinic_settings`**: Key-value store (`key` TEXT, `value` JSONB)
- **`consultation_types`**: `name`, `color`, `default_duration` (unused in UI)
- **`specialties`**: `name`
- **`rooms`**: `name`, `specialty_id`
- **`professionals`**: `name`, `specialty_id`, `color`, `user_id` (links to auth.users)

### Patients & Appointments
- **`patients`**: `name`, `phone`, `email`, `nif` (unique), `birth_date`, `notes`, `tags`
- **`appointments`**: `patient_id`, `professional_id`, `date`, `time`, `duration`, `status`, `reason`, `cancellation_reason`, `final_notes`, `finalized_at`, `review_opt_out`
- **`appointment_requests`**: `name`, `email`, `phone`, `reason`, `preferred_date`, `preferred_time`, `status`, `rejection_reason`, `estimated_duration`
- **`appointment_suggestions`**: `appointment_request_id`, `patient_id`, `suggested_slots` (JSONB)

### WhatsApp Automations
- **`whatsapp_events`**: Outbox table. `event_type`, `entity_id`, `payload`, `status`, `scheduled_for`
- **`whatsapp_workflows`**: Tracks workflow lifecycle. `workflow_type`, `status`, `appointment_id`
- **`whatsapp_action_tokens`**: Secure tokens for patient action links
- **`notification_log`** / **`notifications`**: Staff notifications

### Other
- **`waitlist`**: Patient waitlist entries
- **`contact_messages`**: Public contact form submissions
- **`appointment_notes`**: Per-appointment notes by staff
- **`desistências`**: Cancellation/dropout records

---

## 6. Supabase Edge Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `invite-collaborator` | Create user + assign role + link professional | Admin only (x-user-token) |
| `list-collaborators` | List all users with roles and professional data | Admin only |
| `update-collaborator` | Change role, link/unlink professional | Admin only |
| `delete-collaborator` | Remove user account and all associations | Admin only |

**JWT handling:** Edge Functions decode `x-user-token` locally (atob), verify user via `auth.admin.getUserById()`, check admin role via `has_role()` RPC. This bypasses the Supabase API Gateway ES256/HS256 conflict.

---

## 7. Vercel API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/action` | GET | Patient action links (confirm/cancel) | Token-based |
| `/api/webhook` | POST | n8n callbacks (confirm/cancel/reschedule) | HMAC signature |
| `/api/n8n/process-events` | POST | Process pending whatsapp_events | x-n8n-secret |
| `/api/n8n/create-24h-confirmations` | POST | Create 24h confirmation events | x-n8n-secret |
| `/api/internal` | POST | Manual testing only (deprecated) | Bearer INTERNAL_API_SECRET |

---

## 8. WhatsApp Automations (DB Triggers)

| # | Automation | Trigger | DB Event |
|---|-----------|---------|----------|
| 1 | Pre-confirmation | New appointment created | `trigger_appointment_pre_confirmation` |
| 2 | 24h Confirmation | n8n calls `/api/n8n/create-24h-confirmations` | No DB trigger (n8n-driven) |
| 3 | No-show Reschedule | Status → 'no_show' | `trigger_appointment_no_show_reschedule` |
| 4 | Slot Suggestions | `suggested_slots` populated | `trigger_send_appointment_suggestion` |
| 5 | Cancellation | Status → 'cancelled' (manual via UI) | No specific trigger (event created by cron processor) |
| 6 | Review Reminder | `finalized_at` set + `review_opt_out = false` | `trigger_appointment_review_reminder` |

---

## 9. Frontend Pages

| Route | Page | Access |
|-------|------|--------|
| `/` | Public landing + appointment request form | Public |
| `/admin/login` | Admin login | Public |
| `/admin/dashboard` | Dashboard with KPIs | Admin, Secretary |
| `/admin/agenda` | Calendar view | All roles (doctor: own) |
| `/admin/pedidos` | Appointment requests triage | Admin, Secretary |
| `/admin/pacientes` | Patient management | All roles |
| `/admin/pacientes/:id` | Patient detail | All roles |
| `/admin/sala-de-espera` | Waiting room | All roles (doctor: own) |
| `/admin/lista-de-espera` | Waitlist | Admin, Secretary |
| `/admin/mensagens` | Contact messages | Admin, Secretary |
| `/admin/configuracoes` | Settings + Collaborators | Admin, Secretary |
| `/admin/estatisticas` | Statistics | Admin only |
| `/admin/plano` | Subscription plan | Admin, Secretary |

---

## 10. Pending Migrations (Not Yet in Production)

| Order | Migration | What it adds |
|-------|-----------|-------------|
| 1 | `20260131121545_support_whatsapp_automations_option1.sql` | `cancellation_reason`, `review_opt_out`, `finalized_at`, `rejection_reason`, `desistências` table |
| 2 | `20260131160012_add_final_notes_to_appointments.sql` | `final_notes` column |
| 3 | `20260204120000_fix_whatsapp_events_rls.sql` | Restrict whatsapp_events to service role only |
| 4 | `20260204120100_fix_review_trigger_condition.sql` | Fix review trigger to use finalized_at |

**Apply order is strict.** See `docs/operations/PRODUCTION_MIGRATION_PLAN.md`.

---

## 11. Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Frontend (.env) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (.env) | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + Edge Functions | Service role (server-only) |
| `WEBHOOK_SECRET` | Vercel | HMAC validation for webhooks |
| `N8N_WEBHOOK_SECRET` | Vercel + n8n | Auth for n8n endpoints |
| `N8N_WEBHOOK_BASE_URL` | Vercel | n8n webhook URL |
| `INTERNAL_API_SECRET` | Vercel | Manual testing endpoint |
| `SITE_URL` | Edge Functions | For invite email links |

---

## 12. Known Limitations / Future Work

- **P2-001:** Professional working hours table (for enhanced availability)
- **P2-003:** Pre-fill AppointmentWizard from request data
- **P2-004:** Structured logging (replace console.error with Sentry or similar)
- **P2-005:** Test suite (unit + integration)
- **P2-R7:** Doctor-specific dashboard
- **P2-E3:** Resend invite email functionality
- **Future:** Full conversational rescheduling via WhatsApp (Automation 3 enhanced)
- **Future:** 6-slot generation logic for suggestions (3 same hour/different days + 3 same day/different hours)
