# Barnum — ChatGPT Context File

> **Last updated:** 2026-02-06
> **Purpose:** Give ChatGPT full context about the Barnum project so it can help effectively.
> **Rule:** Update this file after every significant change to the project.

---

## Who Am I

I'm not a developer. I had an idea for a dental clinic management platform and I'm building it with AI assistance (Cursor + ChatGPT). My goal is to finish this product and sell it to other dental clinics, customizing it per client.

---

## What Is Barnum

Barnum is a SaaS platform for dental clinic management. It handles:
- Patient management (CRUD, search, history)
- Appointment scheduling (calendar, triage, waiting room)
- Team management (doctors, secretaries, admin roles)
- WhatsApp automations (confirmations, reminders, rescheduling — via n8n)
- Public landing page where patients can request appointments
- Settings (working hours, consultation types, clinic rules)

---

## Rules for ChatGPT

### Architecture Rules (NEVER violate)
1. **n8n is the ONLY scheduler.** The backend does NOT have cron jobs or timers. n8n (external tool managed by a partner) controls all timing.
2. **SUPABASE_SERVICE_ROLE_KEY is NEVER in the frontend.** Server-side operations (invite users, delete users) go through Supabase Edge Functions.
3. **Consultation types have NO fixed duration.** Types are just name + color. The secretary decides the duration for each appointment request individually.
4. **Self-signup is disabled.** Only admins can invite new users (doctors/secretaries) through the "Colaboradores" section in Settings.

### Working Rules
5. **Evidence-based only.** Don't guess. If unsure, say so.
6. **Prefer code over docs** when there's a conflict — code is the truth.
7. **Keep changes minimal.** Don't refactor things that aren't broken.
8. **Always update context files** after making changes (this file + docs/context/AGENT_CONTEXT.md).
9. **Portuguese (Portugal) for UI text.** Not Brazilian Portuguese.

### Role Rules
10. When I ask you to work on this project, you are a senior full-stack engineer.
11. You must verify before changing — read the current code first.
12. If something is unclear or risky, STOP and ask me before proceeding.

---

## Tech Stack

| What | Technology |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Radix UI + shadcn/ui |
| Forms | React Hook Form + Zod validation |
| State | TanStack React Query |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password, invite-only) |
| Server Functions | Supabase Edge Functions (Deno) — for admin operations |
| API | Vercel Serverless Functions — for webhooks and n8n endpoints |
| Hosting | Vercel |
| Automations | n8n (external, managed by partner) |
| WhatsApp | n8n → WhatsApp Business API |

---

## Roles & Permissions

### Admin
- Access to EVERYTHING
- Can invite/edit/delete collaborators
- Can see all statistics
- Can manage settings, types, working hours

### Secretary
- Access to everything EXCEPT Statistics page
- Can manage appointments, patients, requests, waiting room
- Can see Settings but CANNOT manage collaborators
- Can triage requests (set duration, choose doctor, accept/reject)

### Doctor
- Agenda: ONLY their own appointments
- Waiting Room: ONLY their own patients
- Patients: ALL patients (read-only for now)
- CANNOT see: Settings, Statistics, Requests, Messages, Waitlist

---

## Current State (2026-02-06)

### DONE (working)
- Full login system with role-based access
- Admin can invite doctors/secretaries (via Edge Functions)
- Admin can edit/delete collaborators
- Appointment requests from public landing page
- Secretary triage: set duration manually → check doctor availability → schedule or suggest alternatives
- Appointment CRUD with full calendar view
- Waiting room with finalization (notes + review opt-out)
- Cancellation with mandatory reason
- Patient management with search/filters
- Consultation types (name + color, no fixed duration)
- Settings persistence (working hours, parameters, rules)
- WhatsApp event outbox (DB triggers fire automatically)
- n8n webhook endpoints ready

### NOT YET DONE (pending)
- Apply 4 database migrations to production
- n8n partner needs to implement WhatsApp workflows
- Set environment variable `N8N_WEBHOOK_SECRET` in Vercel
- Professional working hours table (future enhancement)
- Doctor-specific dashboard (future)
- Test suite (future)
- Structured error logging (future)

---

## Database — Key Tables

| Table | Purpose |
|-------|---------|
| `patients` | Patient records (name, phone, email, NIF, birth_date) |
| `appointments` | Scheduled appointments with status, duration, notes |
| `appointment_requests` | Incoming requests from public form |
| `appointment_suggestions` | Slot suggestions sent to patients |
| `professionals` | Doctors/staff with specialty and color |
| `consultation_types` | Types of consultations (name + color) |
| `clinic_settings` | Key-value settings store |
| `user_roles` | Maps auth users to roles (admin/secretary/doctor) |
| `whatsapp_events` | Outbox for WhatsApp message events |
| `whatsapp_workflows` | Tracks WhatsApp workflow state |
| `whatsapp_action_tokens` | Secure tokens for patient action links |

---

## WhatsApp Automations (6 total)

| # | Name | Trigger | Who does what |
|---|------|---------|--------------|
| 1 | Pre-confirmation | New appointment created | DB trigger → whatsapp_event → n8n sends message |
| 2 | 24h Confirmation | Day before appointment | n8n calls `/api/n8n/create-24h-confirmations` at 08:00 |
| 3 | No-show Reschedule | Doctor marks no-show | DB trigger → whatsapp_event → n8n sends message |
| 4 | Slot Suggestions | Secretary suggests time slots | DB trigger → whatsapp_event → n8n sends message |
| 5 | Cancellation notification | Appointment cancelled | Event created during processing → n8n sends message |
| 6 | Review Reminder | Appointment finalized + review not opted out | DB trigger → whatsapp_event → n8n sends 2h later |

**Key:** The backend creates events in `whatsapp_events`. n8n reads and sends the actual WhatsApp messages.

---

## Key Files

### Must-read for any task
- `docs/context/PROJECT_CANONICAL_CONTEXT.md` — Full verified project state
- `docs/context/AGENT_CONTEXT.md` — Quick reference for AI agents
- `src/hooks/useAuth.ts` — Role system
- `src/App.tsx` — All routes and guards
- `src/context/ClinicContext.tsx` — Central data context

### For n8n partner
- `docs/contracts/N8N_PARTNER_COMPLETE_GUIDE.md` — Complete handoff guide

### For database work
- `docs/contracts/DATABASE_SCHEMA.md` — Full schema reference
- `supabase/migrations/` — All migrations in order

---

## Project Structure

```
barnumdemo-main/
├── api/                    # Vercel serverless functions
│   ├── action.ts           # Patient action links
│   ├── webhook.ts          # n8n callbacks
│   ├── n8n/                # n8n-specific endpoints
│   └── lib/                # Shared backend utilities
├── supabase/
│   ├── functions/          # Edge Functions (invite, list, update, delete collaborators)
│   └── migrations/         # Database migrations
├── src/
│   ├── pages/admin/        # Admin panel pages
│   ├── components/admin/   # Admin components
│   ├── hooks/              # React Query hooks
│   ├── context/            # React contexts
│   ├── integrations/       # Supabase client + types
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Utility functions
├── docs/
│   ├── context/            # Project context docs
│   ├── contracts/          # Technical contracts + specs
│   ├── operations/         # Deployment + QA docs
│   └── archive/            # Old/historical docs
├── public/                 # Static assets
├── ChatGPT_5.2_context.md  # THIS FILE
└── .env                    # Environment variables
```

---

## How to Give Me Context

When starting a new chat about this project:
1. Paste this entire file as context
2. If needed, also paste `docs/context/PROJECT_CANONICAL_CONTEXT.md` for deeper technical detail
3. Tell me what you want to do
4. I'll verify the current state before making changes
