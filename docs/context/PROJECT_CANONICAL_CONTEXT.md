# Project Canonical Context

**Last Updated**: 2026-02-06  
**Project**: Barnum Clinic Management Platform  
**Status**: Active Development - Phase 5 (Frontend Stabilization)

---

## Project Overview

**Barnum** is a clinic management platform for scheduling appointments, managing patients and professionals, and automating patient communication via WhatsApp.

---

## Tech Stack (Verified)

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.19
- **Routing**: React Router v6.30.1
- **UI Library**: Radix UI components with Tailwind CSS
- **Form Handling**: react-hook-form 7.61.1 with Zod validation
- **State Management**: React Query (@tanstack/react-query 5.83.0)

**Evidence**: `package.json` lines 13-67

### Backend
- **Database**: Supabase PostgreSQL
  - Project ID: `oziejxqmghwmtjufstfp`
  - Remote URL: `https://oziejxqmghwmtjufstfp.supabase.co`
- **API Layer**: Vercel Serverless Functions (Node.js runtime, `@vercel/node`)
  - 3 endpoints: `/api/action`, `/api/webhook`, `/api/internal`
- **Auth**: Supabase Auth (email/password)
- **Storage**: Supabase Storage

**Evidence**: 
- `ChatGPT_5.2_context.md` lines 20-21
- `api/action.ts` line 6, `api/webhook.ts` line 7, `api/internal.ts` line 10
- `ANALISE_BACKEND_EVIDENCIAS.md` lines 15-52

### External Services (Planned)
- **WhatsApp Automation**: n8n (external, not in repo)
- **Deployment**: Vercel (framework detected in `vercel.json`)

---

## Core Architectural Rules

### Rule 1: n8n Owns All Time-Based Scheduling

**Canonical Decision** (2026-02-06):
- **n8n is the ONLY scheduler** for business logic automations
- Backend does NOT own cron jobs or time-based triggers
- Backend exposes reactive webhook endpoints that n8n calls
- n8n decides WHEN to trigger flows (24h confirmations, event processing, etc.)

**Why**:
- Centralized automation logic in n8n (single source of truth)
- Backend remains stateless and reactive
- Easier debugging (all timing decisions visible in n8n workflows)
- Simpler deployment (no Vercel Cron configuration)

**Implementation**:
- Backend endpoints: `/api/n8n/process-events`, `/api/n8n/create-24h-confirmations`
- n8n schedules: Daily 08:00 for confirmations, every 5 min for event processing
- Auth: `x-n8n-secret` header (shared secret `N8N_WEBHOOK_SECRET`)

**Evidence**:
- `docs/contracts/N8N_INTEGRATION_CONTRACT.md` (full specification)
- `api/n8n/process-events.ts` lines 1-13
- `api/n8n/create-24h-confirmations.ts` lines 1-22
- `vercel.json` has NO `crons` array (removed 2026-02-06)

---

## Architecture

### Database Layer (Supabase)

**Core Tables** (verified in migrations):
- `patients` - Patient records
- `professionals` - Doctors/staff (links to `specialties`)
- `appointments` - Scheduled consultations
- `appointment_requests` - Public booking requests
- `specialties` - Medical specialties
- `consultation_types` - Service types
- `rooms` - Consultation rooms
- `waitlist` - Patient waitlist
- `user_roles` - Role assignments (admin, secretary, doctor)
- `clinic_settings` - Clinic configuration

**WhatsApp Infrastructure Tables** (verified in migrations):
- `whatsapp_workflows` - Workflow state tracking
- `whatsapp_events` - Outbox pattern for webhook delivery
- `whatsapp_action_tokens` - Secure patient action links
- `appointment_suggestions` - Slot suggestions for rescheduling
- `desistências` - Patients who abandon scheduling (local only, not in production)

**Evidence**: 
- `supabase/migrations/20260128020127_whatsapp_webhook_infrastructure.sql` lines 10-142
- `supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql` lines 29-48

**Authentication & Authorization**:
- Function: `has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN`
  - Location: `supabase/migrations/20251231023352_0aabc462-babb-4742-873f-492150c993ae.sql` lines 17-28
  - Attributes: `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
- Enum: `app_role` = `'admin' | 'secretary' | 'doctor'`
- Table: `user_roles` - Maps auth users to roles
- Row Level Security (RLS): Enabled on all tables
  - Pattern: Admin-only access via `has_role(auth.uid(), 'admin')`
  - Evidence: `supabase/migrations/20260103122558_1f871a85-e401-4d15-a3aa-293bf4e2e2f2.sql` lines 5-57

**Status Enums** (verified):
- `appointment_status`: `'scheduled' | 'confirmed' | 'pre_confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'`
- `waitlist_priority`: `'low' | 'medium' | 'high'`
- `time_preference`: `'morning' | 'afternoon' | 'any'`

### API Layer (Vercel Functions)

**Endpoint: `/api/action`** (GET)
- **Purpose**: Patient-facing action links (confirm/cancel/reschedule)
- **Auth**: Token validation via `validate_action_token()` DB function
- **Client**: `supabaseAdmin` (service role, bypasses RLS)
- **Evidence**: `api/action.ts` lines 39-66

**Endpoint: `/api/webhook`** (POST)
- **Purpose**: n8n callback handler (6 action types)
- **Auth**: Optional HMAC signature verification (`WEBHOOK_SECRET`)
- **Actions**: confirm, cancel, reschedule, no_show_reschedule, reactivation, review
- **Evidence**: `api/webhook.ts` lines 47-91

**Endpoint: `/api/internal`** (POST)
- **Purpose**: Manual testing endpoint for event processing
- **Auth**: Required Bearer token (`INTERNAL_API_SECRET`)
- **Note**: n8n should call `/api/n8n/process-events` instead (in production)
- **Evidence**: `api/internal.ts` lines 1-8

**Endpoint: `/api/n8n/process-events`** (POST)
- **Purpose**: Process pending whatsapp_events (called by n8n on schedule)
- **Auth**: Required `x-n8n-secret` header (`N8N_WEBHOOK_SECRET`)
- **Behavior**: 
  - Queries `whatsapp_events` with `status='pending'` and `scheduled_for <= now()`
  - Sends to `N8N_WEBHOOK_BASE_URL`
  - Retry logic: max 3 attempts, exponential backoff, dead letter queue
- **Evidence**: `api/n8n/process-events.ts` lines 1-70
- **n8n Schedule**: Every 5 minutes (configured in n8n, not backend)

**Endpoint: `/api/n8n/create-24h-confirmations`** (POST)
- **Purpose**: Create pre-confirmation workflows for appointments in ~24h (called by n8n daily)
- **Auth**: Required `x-n8n-secret` header (`N8N_WEBHOOK_SECRET`)
- **Behavior**:
  - Finds appointments 23-25 hours from now with `status IN ('scheduled', 'pre_confirmed')`
  - Creates `whatsapp_workflows` + `whatsapp_events` (idempotent)
  - Events picked up by next `/api/n8n/process-events` call
- **Evidence**: `api/n8n/create-24h-confirmations.ts` lines 1-220
- **n8n Schedule**: Daily at 08:00 (configured in n8n, not backend)

**Security Helpers**:
- HMAC signature generation/verification (SHA-256)
- Idempotency key generation
- Location: `api/lib/security.ts` lines 14-61

### Frontend Layer (React SPA)

**Routing** (verified in `src/App.tsx`):
- Public routes: `/`, `/admin/login`
- Admin routes (14 total): `/admin/dashboard`, `/admin/agenda`, `/admin/pedidos`, `/admin/pacientes`, `/admin/settings`, etc.
- Layout: `AdminLayout` wrapper with sidebar navigation
- Auth Guard: `useAuth()` hook checks `has_role('admin')` before allowing access

**Key Components** (verified):
- `AppointmentWizard` - Two-step appointment creation (NIF lookup → details form)
  - Fixed crash: `PatientLookupByNIF.tsx` line 143 (FormLabel → Label)
  - Evidence: `ChatGPT_5.2_context.md` lines 1029-1043
- `ManageProfessionalsModal` - Professional CRUD
  - Fixed specialty mismatch: now stores UUID instead of name
  - Evidence: `ChatGPT_5.2_context.md` lines 942-961
- `ClinicContext` - Centralized React Query data layer

**Auth Flow**:
- `useAuth()` hook calls `supabase.rpc('has_role')` after login
- Non-admin users immediately logged out
- Evidence: `src/hooks/useAuth.ts` lines 76-100

---

## Database Migration State

### Local Environment (Docker + Supabase CLI)
**Migrations Applied**: 13 total

Last migration: `20260131160012_add_final_notes_to_appointments.sql`

**Schema Additions (Local Only, NOT in Production)**:
1. `desistências` table - Abandoned appointment tracking
2. `appointment_requests.rejection_reason` (text)
3. `appointments.cancellation_reason` (text)
4. `appointments.review_opt_out` (boolean, default false)
5. `appointments.finalized_at` (timestamptz)
6. `appointments.final_notes` (text)

**Evidence**: `ChatGPT_5.2_context.md` lines 760-838

### Production Environment (Supabase Remote)
**Migrations Applied**: 11 total (verified 2026-01-30)

**Last production migration**: `20260130002738_remote_schema.sql`

**CRITICAL**: Local has 2 unapplied migrations (`20260131121545`, `20260131160012`)

---

## WhatsApp Automations (Designed, Not Implemented)

**Specification**: `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md`

**6 Automations**:
1. Incoming Request & Secretary Triage
2. 24h Confirmation with Default Confirmation
3. Rescheduling via Chat
4. Slot Suggestion Resolution
5. Staff-Initiated Cancellation
6. Waiting Room & Finalization + Post-Consultation Review

**Backend Support Status**:
- ✅ Database triggers create events automatically
  - Pre-confirmation: `trigger_pre_confirmation_event()` on appointment INSERT
  - No-show: `trigger_no_show_reschedule_event()` on status→'no_show'
  - Review: `trigger_review_reminder_event()` on status→'completed'
  - Evidence: `supabase/migrations/20260128020128_whatsapp_event_triggers.sql` lines 59-210
- ✅ Event outbox (`whatsapp_events`) with retry/dead-letter
- ✅ Action token system (`whatsapp_action_tokens`, `validate_action_token()` function)
- ❌ CRON job NOT configured (Gap 1)
- ❌ n8n integration NOT in repo (external service)
- ⚠️ Review trigger uses `status='completed'` instead of `finalized_at IS NOT NULL` (Gap 2)

**Evidence**: `ANALISE_BACKEND_EVIDENCIAS.md` lines 241-421, 568-627

---

## Known Issues & Resolutions

### P0 Issues (RESOLVED)
- **P0-001**: AppointmentWizard crash on NIF field
  - **Fixed**: `PatientLookupByNIF.tsx` line 143 (FormLabel → Label)
  - **Date**: 2026-02-01
  - **Evidence**: `ChatGPT_5.2_context.md` lines 994-1074

### P1 Issues (RESOLVED)
- **P1-001**: Professional creation specialty mismatch
  - **Fixed**: `ManageProfessionalsModal.tsx` lines 128, 199 (value={s.name} → value={s.id})
  - **Date**: 2026-01-31
  - **Evidence**: `ChatGPT_5.2_context.md` lines 922-991

### P2 Issues (OPEN)
- **P2-001**: PlanPage "Fazer Upgrade" button has no handler (non-blocking, marketing placeholder)
- **P2-002**: MessagesPage exists but not routed (future feature)
- **P2-003**: No `type-check` script in `package.json`

**Tracking**: `docs/contracts/FRONTEND_STABILIZATION_BACKLOG.md`

---

## Critical Gaps (Production Blockers)

### Gap 1: Review Trigger Inconsistency
**Current**: Trigger fires on `status = 'completed'`  
**Spec**: Should fire on `finalized_at IS NOT NULL` (2 hours after finalization)

**Evidence**:
- `supabase/migrations/20260128020128_whatsapp_event_triggers.sql` line 174
- `ANALISE_BACKEND_EVIDENCIAS.md` lines 568-585

**Fix Required**: Apply migration `20260204120100_fix_review_trigger_condition.sql` to production

### Gap 2: RLS Policy Exposes PHI in whatsapp_events (RESOLVED - Migration Created)
**Status**: Migration `20260204120000_restrict_whatsapp_events_rls.sql` created  
**Remaining**: Apply migration to production

**Original Issue**:
- `whatsapp_events` allowed SELECT by authenticated users
- Payloads contain PHI (patient names, phones, appointment data)

**Evidence**: 
- Fix: `supabase/migrations/20260204120000_restrict_whatsapp_events_rls.sql`
- Original: `supabase/migrations/20260128020127_whatsapp_webhook_infrastructure.sql` lines 55-63

### Gap 3: Local Migrations Not in Production
**Blocker**: WhatsApp automations require new schema fields

**Missing in Production**:
- `desistências` table
- `rejection_reason`, `cancellation_reason`, `review_opt_out`, `finalized_at`, `final_notes`

**Fix Required**: Apply migrations `20260131121545` and `20260131160012` to production (after approval)

---

## Out of Scope / Not Yet Implemented

### Not in Repository
- ❌ n8n workflow definitions (external service)
- ❌ WhatsApp API integration code (handled by n8n)
- ❌ Production environment variables configuration (managed in Vercel dashboard)
- ❌ Automated tests (unit, integration, E2E)
- ❌ CI/CD pipeline configuration

### Not Verified
- Production database state (schema drift, active users, live data)
- Production deployment status (URL, environment variables, CRON jobs)
- RLS policy details beyond admin-only pattern
- Performance metrics or monitoring setup
- Backup/disaster recovery procedures

### Deferred Features
- Multi-clinic tenancy (system is single-clinic per database)
- Role-based UI for secretary/doctor (admin-only currently)
- Automated slot generation algorithm (documented but not implemented)
- Real-time notifications (infrastructure exists, UI integration incomplete)
- Message templating system (handled by n8n)

---

## Documentation Hierarchy

### Tier 1: Canonical (This File)
- **This file**: `docs/context/PROJECT_CANONICAL_CONTEXT.md`
- **Purpose**: Single source of truth, stable, evidence-based

### Tier 2: Active Contracts
- `docs/contracts/FRONTEND_DB_CONTRACT.md` - Frontend-database interface
- `docs/contracts/FRONTEND_ENUMS_AND_TYPES.md` - Frontend type system
- `docs/contracts/VERCEL_API_CONTRACT.md` - API route interfaces
- `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md` - WhatsApp automation behaviors
- `docs/contracts/supabase_backend_snapshot.md` - Backend schema reference

### Tier 3: Historical Context
- `docs/context/` - Audits, analysis, planning documents (14 files)
- `ChatGPT_5.2_context.md` - Living context file (superseded by canonical + local architecture)

### Tier 4: Archive
- `docs/archive/` - Exploratory docs, duplicates
- `docs/archive/n8n/` - n8n integration guides (not final, future-phase)

### Tier 5: Handoff Pack
- `docs/handoff_pack/` - Agent-to-agent transfer documentation (6 files)

---

## Version History

**2026-02-04**: Initial canonical context creation
- Extracted verified state from `ChatGPT_5.2_context.md` and `ANALISE_BACKEND_EVIDENCIAS.md`
- Documented tech stack, architecture, migration state, critical gaps
- Established documentation hierarchy
