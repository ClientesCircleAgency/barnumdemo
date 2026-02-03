# Project Snapshot

**Date**: 2026-02-03  
**Source**: Evidence from `ChatGPT_5.2_context.md`, `package.json`, and repository structure

---

## Project Purpose

**Barnum Clinic Management Platform** is a comprehensive web application for managing medical clinic operations, including:
- Patient management (registration, history, NIF lookup)
- Appointment scheduling (manual creation + public booking requests)
- Professional/staff management (doctors, specialties, consultation types)
- Waitlist and waiting room workflows
- WhatsApp automation integration (via n8n - planned/in progress)

**Target Users**: Clinic administrators and healthcare professionals  
**Geography**: Portugal (Portuguese language, NIF validation)

---

## Tech Stack (Evidence-Based)

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19
- **Routing**: React Router DOM 6.30.1
- **State Management**: 
  - React Query (@tanstack/react-query 5.83.0)
  - Context API (ClinicContext for shared state)
- **Forms**: react-hook-form 7.61.1 + Zod 3.25.76 validation
- **UI Library**: Radix UI primitives + shadcn/ui components
- **Styling**: TailwindCSS 3.4.17 + tailwindcss-animate
- **Date Handling**: date-fns 3.6.0
- **Icons**: lucide-react 0.462.0
- **Charts**: recharts 2.15.4

### Backend
- **Database**: Supabase PostgreSQL
- **Project Reference**: `oziejxqmghwmtjufstfp`
- **Client**: @supabase/supabase-js 2.89.0
- **Authentication**: Supabase Auth (inferred from useAuth hook)
- **Row Level Security**: Active (confirmed in context doc)

### Hosting/Deployment
- **Platform**: Vercel (evidenced by `vercel.json`, `@vercel/node` in devDeps)
- **API Routes**: Serverless functions in `/api` directory
- **Environment**: Development (local) + Production (Vercel-hosted)

### Development Environment
- **OS**: Windows with Docker Desktop (WSL2)
- **Docker**: Required for Supabase CLI shadow database operations
- **Package Manager**: npm (package-lock.json exists)
- **Supabase CLI**: v2.72.7 (from context doc)

---

## Key Entities (Evidence from ONLY verified sources)

### Database Tables (from context doc migrations)
**Note**: Full schema is in `docs/contracts/SUPABASE_BACKEND_SNAPSHOT.md` (if exists) or migrations in `supabase/migrations/`

**Confirmed tables** (from migration filenames and context):
- `appointments` - Appointment records
- `patients` - Patient data
- `professionals` - Healthcare providers (doctors, staff)
- `specialties` - Medical specialties
- `consultation_types` - Types of consultations
- `rooms` - Physical consultation rooms
- `waitlist` - Waitlist management
- `appointment_requests` - Public booking requests
- `whatsapp_workflows` - n8n automation data (migration 20260128020127)
- `whatsapp_events` - WhatsApp event log (migration 20260128020128)

### Enums (Evidence from backlog)
- `AppointmentStatus`: scheduled, confirmed, cancelled, no_show, completed (+ rejected per migration 20260128105000)

### Frontend Routes (Evidence from App.tsx analysis in docs)
**Public routes**:
- `/` - Landing page (Index)
- `/admin/login` - Admin login

**Admin routes** (under `/admin` layout):
- `/admin/dashboard` - Dashboard
- `/admin/agenda` - Today's schedule
- `/admin/pedidos` - Appointment requests
- `/admin/pacientes` - Patients list
- `/admin/pacientes/:id` - Patient detail
- `/admin/lista-espera` - Waitlist
- `/admin/sala-espera` - Waiting room
- `/admin/configuracoes` - Settings
- `/admin/plano` - Plan/subscription page
- `/admin/estatisticas` - Statistics

---

## Environments

### Local Development
- **Supabase**: Linked to remote project `oziejxqmghwmtjufstfp`
- **Schema Sync**: Confirmed no drift as of 2026-01-30
- **Migrations**: 11 migrations applied and synchronized
- **Dev Server**: `npm run dev` (Vite at http://localhost:8080 - evidenced from previous sessions)

### Production
- **Platform**: Vercel (inferred from vercel.json)
- **Database**: Remote Supabase PostgreSQL
- **Status**: UNKNOWN (no production deployment verification in docs)

### Constraints
- **Do NOT modify production** - All work is local only
- **Do NOT create new migrations** - Use existing schema
- **RLS must remain active** - Row Level Security is enforced

---

## Current Phase & What Was Completed

**Source**: `ChatGPT_5.2_context.md` Phase 5B.1 and 5B.2

### Phase 5B.1 Complete ✅
**Task**: Fix Professional Creation Specialty Mismatch (P1-001)

**Problem**: 
- `ManageProfessionalsModal` collected specialty as NAME (string)
- Backend expected `specialty_id` (UUID)
- Foreign key constraint violation on professional creation

**Fix**:
- Changed SelectItem `value={s.name}` → `value={s.id}` (lines 128, 199)
- Fixed display to show specialty name instead of UUID (line 163)

**Files Modified**:
- `src/components/admin/ManageProfessionalsModal.tsx`

**Verified**: Statically (code review), no runtime crash

---

### Phase 5B.2 Complete ✅
**Task**: Fix AppointmentWizard Crash (P0-001)

**Problem**:
- Clicking "+ Nova Consulta" button opened modal then crashed immediately
- Error: `TypeError: (intermediate value)() is null`
- Root cause: `FormLabel` used outside react-hook-form context

**Fix**:
- Added `import { Label } from '@/components/ui/label';` (line 8)
- Replaced `<FormLabel>` → `<Label>` for NIF input (line 143)

**Files Modified**:
- `src/components/admin/PatientLookupByNIF.tsx`

**Verified**: Runtime testing - user confirmed "o wizzar ficou ok"

---

### Documentation Completed
- `docs/contracts/FRONTEND_STABILIZATION_BACKLOG.md` - Issue tracking
- `docs/contracts/FRONTEND_DB_CONTRACT.md` - Frontend-DB contract
- `ChatGPT_5.2_context.md` - Living context (Phases 5B.1, 5B.2 documented)
- Investigation report and walkthrough artifacts created

---

## System Status (As of Phase 5B.2)

**Operational State**: ✅ Fully functional for core admin workflows

**Fixed Issues**:
- ✅ P0-001: AppointmentWizard crash (manual appointment creation)
- ✅ P1-001: Professional creation specialty mismatch

**Remaining Issues**:
- P2-001: PlanPage "Fazer Upgrade" button (no handler - non-functional UI)
- P2-002: MessagesPage (mock data only, not routed)
- P2-003: Missing type-check script in package.json

**Blockers**: None

---

## Next Phase Recommendations

**Option A**: Address P2 minor issues (upgrade button, type-check script)  
**Option B**: New feature work (coordinate with ChatGPT 5.2)  
**Option C**: Runtime regression testing of existing flows

**Priority**: To be determined by coordinator (ChatGPT 5.2)

---

## Unknown/Unverified Items

- **Production deployment status** - UNKNOWN (not documented)
- **n8n WhatsApp integration status** - Schema exists, automation implementation UNKNOWN
- **Full backend schema** - Partial knowledge from migrations, full snapshot UNKNOWN (check for SUPABASE_BACKEND_SNAPSHOT.md)
- **RLS policies** - Existence confirmed, specific rules UNKNOWN
- **Test coverage** - No evidence of test suite in package.json scripts

---

**Evidence Sources**:
- `ChatGPT_5.2_context.md` (lines 1-1105)
- `package.json` (complete file)
- `docs/contracts/FRONTEND_STABILIZATION_BACKLOG.md`
- Repository structure (docs/, src/, supabase/)

**Generated**: 2026-02-03 (Phase 5C - Handoff Pack Creation)
