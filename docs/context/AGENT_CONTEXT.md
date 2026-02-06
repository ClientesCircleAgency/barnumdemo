# Barnum — Agent Context (Cursor / AI Agents)

> **Auto-updated after each task.** This file is the fast-reference for any AI agent working on this codebase.
> **Last updated:** 2026-02-06

---

## Quick Summary

Barnum is a dental clinic management SaaS built with React + Supabase + Vercel. WhatsApp automations are handled by n8n (external). The owner is not a developer — clarity and simplicity matter.

---

## Critical Rules (NEVER violate)

1. **n8n is the ONLY scheduler.** Backend has ZERO cron/timing logic.
2. **SUPABASE_SERVICE_ROLE_KEY never in frontend.** Admin ops go through Edge Functions.
3. **Duration is per-request.** Consultation types = name + color. Secretary decides duration during triage.
4. **Self-signup disabled.** Only admin invites via "Colaboradores" section.
5. **Evidence-based claims only.** Every technical statement must reference file path + line range.
6. **Update this file** at the end of every task with a short entry in the Session Log below.

---

## Current State (2026-02-06)

### What's DONE
- Full RBAC (admin/secretary/doctor) with route guards, sidebar filtering, data filtering
- Collaborator management via Edge Functions (invite/list/update/delete)
- Appointment CRUD with calendar view
- Appointment requests triage with manual duration + availability check
- Patient CRUD with search and filters
- Waiting room with finalization flow (final_notes, review_opt_out)
- Cancellation with mandatory reason
- Slot suggestions modal (saves to appointment_suggestions)
- Consultation types CRUD (name + color, no duration)
- Clinic settings persistence (working hours, general settings, rules)
- WhatsApp event outbox (DB triggers create events automatically)
- n8n webhook endpoints (process-events, create-24h-confirmations)
- Public landing page with appointment request form

### What's PENDING
- Apply 4 migrations to production (strict order — see PRODUCTION_MIGRATION_PLAN.md)
- n8n partner implements workflows (see N8N_PARTNER_COMPLETE_GUIDE.md)
- Set N8N_WEBHOOK_SECRET in Vercel + n8n
- Professional working hours table (P2)
- Doctor-specific dashboard (P2)
- Test suite (P2)
- Structured logging / Sentry (P2)

---

## Key File Locations

### Configuration
- `.env` — Environment variables (Supabase URL, keys)
- `vercel.json` — Vercel deployment config
- `supabase/config.toml` — Supabase project config
- `package.json` — Dependencies

### Backend
- `api/action.ts` — Patient action links (GET)
- `api/webhook.ts` — n8n callbacks (POST, HMAC)
- `api/n8n/process-events.ts` — Process whatsapp_events outbox
- `api/n8n/create-24h-confirmations.ts` — Create 24h confirmation events
- `api/lib/internal-processor.ts` — Shared event processing logic
- `api/lib/supabase.ts` — Supabase admin client
- `api/lib/security.ts` — HMAC signature validation

### Edge Functions
- `supabase/functions/invite-collaborator/index.ts`
- `supabase/functions/list-collaborators/index.ts`
- `supabase/functions/update-collaborator/index.ts`
- `supabase/functions/delete-collaborator/index.ts`

### Frontend Core
- `src/App.tsx` — Router + route guards
- `src/hooks/useAuth.ts` — Auth + role detection
- `src/context/ClinicContext.tsx` — Central data context
- `src/integrations/supabase/client.ts` — Supabase client init
- `src/integrations/supabase/types.ts` — Generated DB types

### Frontend Pages
- `src/pages/admin/SettingsPage.tsx` — Settings + collaborators
- `src/pages/admin/RequestsPage.tsx` — Triage flow
- `src/pages/admin/WaitingRoomPage.tsx` — Waiting room + finalization
- `src/pages/admin/AgendaPage.tsx` — Calendar
- `src/pages/admin/PatientsPage.tsx` — Patient list

### Key Hooks
- `src/hooks/useCollaborators.ts` — Edge Function calls for collaborator CRUD
- `src/hooks/useAppointments.ts` — Appointment queries
- `src/hooks/useAppointmentRequests.ts` — Request management
- `src/hooks/useSettings.ts` — Clinic settings persistence

### Migrations (pending production)
- `supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql`
- `supabase/migrations/20260131160012_add_final_notes_to_appointments.sql`
- `supabase/migrations/20260204120000_fix_whatsapp_events_rls.sql`
- `supabase/migrations/20260204120100_fix_review_trigger_condition.sql`

---

## Database Quick Reference

### Enums
- `app_role`: admin, secretary, doctor
- `appointment_status`: scheduled, pre_confirmed, confirmed, waiting, in_progress, completed, cancelled, no_show
- `request_status`: pending, pre_confirmed, suggested, converted, cancelled, expired, rejected
- `whatsapp_workflow_type`: pre_confirmation_sent, confirmation_24h, reschedule_prompt, slot_suggestion, request_cancelled
- `whatsapp_workflow_status`: pending, sent, delivered, responded, expired, failed, cancelled

### Key Functions
- `has_role(user_id UUID, role app_role)` — Check if user has specific role
- `create_whatsapp_event(...)` — Insert into whatsapp_events outbox
- `generate_action_token(...)` — Create secure patient action token
- `validate_action_token(...)` — Validate and return token data

---

## RBAC Quick Reference

| Route | Admin | Secretary | Doctor |
|-------|-------|-----------|--------|
| `/admin/dashboard` | Yes | Yes | Yes (generic) |
| `/admin/agenda` | All | All | Own only |
| `/admin/pedidos` | Yes | Yes | No |
| `/admin/pacientes` | Yes | Yes | Yes (all) |
| `/admin/sala-de-espera` | All | All | Own only |
| `/admin/configuracoes` | Yes | Yes | No |
| `/admin/estatisticas` | Yes | No | No |

---

## Session Log

### 2026-02-06 — Documentation Overhaul
- Rewrote all documentation from scratch
- Created AGENT_CONTEXT.md (this file)
- Created N8N_PARTNER_COMPLETE_GUIDE.md for n8n partner
- Updated ChatGPT_5.2_context.md with rules and current state
- Archived 20+ obsolete docs
- Removed fixed duration from consultation types (name + color only)
