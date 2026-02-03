# Decisions and Rationale

**Purpose**: Document major technical decisions with evidence of WHY they were made

---

## Decision 1: Use Modal-Based Appointment Creation (Not Route-Based Page)

**Date**: Pre-Phase 5B (existing architecture)  
**Evidence**: `AppointmentWizard.tsx` is a Dialog component, not a page

**Decision**:  
Manual appointment creation uses a modal (`AppointmentWizard`) instead of dedicated route (`/admin/consulta/nova`)

**Rationale**:
- **UX**: Modal keeps user in context (doesn't leave current page)
- **Reusability**: Same wizard component used from 6 different entry points:
  - AdminSidebar (global "+ Nova Consulta" button)
  - AgendaPage (create with preselected date)
  - PatientsPage (create with preselected patient)
  - PatientDetailPage (contextual creation)
  - WaitlistPage (convert waitlist to appointment)
  - AdminLayout (global mount point)
- **State management**: Simpler - modal state vs route state

**Constraints**:
- Must handle pre-selected patient and/or date
- Two-step wizard (patient lookup → appointment details)

---

## Decision 2: Use react-hook-form with Zod Validation

**Date**: Pre-Phase 5B (existing architecture)  
**Evidence**: `package.json` dependencies, form components throughout codebase

**Decision**:  
All forms use react-hook-form 7.61.1 + Zod 3.25.76 for validation

**Rationale**:
- **Type safety**: Zod provides runtime validation matching TypeScript types
- **DX**: react-hook-form reduces boilerplate vs useState for each field
- **Validation**: Centralized schema files in `src/lib/validations/`
- **Error handling**: Built-in error states and messages

**Implementation pattern**:
```tsx
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {...}
});

<Form {...form}>
  <FormField control={form.control} name="field">
    {/* field content */}
  </FormField>
</Form>
```

**Constraints**:
- FormLabel/FormField/Form components MUST be inside `<Form>` wrapper
- Standalone inputs use regular `<Label>` component (Phase 5B.2 lesson learned)

---

## Decision 3: Direct Supabase Client Calls (No Backend API Layer)

**Date**: Pre-Phase 5B  
**Evidence**: Frontend hooks (`useAppointments.ts`, `usePatients.ts`) call Supabase directly

**Decision**:  
Frontend uses `@supabase/supabase-js` client directly for database operations

**Rationale**:
- **Simplicity**: No need for Express/Next.js API routes for CRUD
- **RLS**: Supabase Row Level Security policies enforce authorization
- **Real-time**: Direct access to Supabase real-time subscriptions
- **Type safety**: Generated types from `supabase gen types typescript`

**Trade-offs**:
- ✅ Faster development (no backend middleware)
- ✅ Fewer moving parts
- ❌ Less flexibility for complex business logic
- ❌ Supabase client bundle size

**Note**: `/api` directory exists for serverless functions (Vercel), likely for webhooks/n8n integration

---

## Decision 4: Context API + React Query for State Management

**Date**: Pre-Phase 5B  
**Evidence**: `ClinicContext.tsx`, React Query usage throughout

**Decision**:  
Use ClinicContext (React Context API) + React Query for global state

**Architecture**:
- **React Query**: Server state (appointments, patients, professionals)
- **ClinicContext**: Wrapper providing hooks and mutation functions
- **No Redux/Zustand**: Simpler stack for this app size

**Rationale**:
- **Caching**: React Query handles data caching/invalidation
- **Optimistic updates**: Built-in support
- **Mutations**: `addAppointment`, `updatePatient`, etc. centralized
- **Less boilerplate**: No reducers/actions needed

**Pattern**:
```tsx
const { appointments, addAppointment } = useClinic();
// addAppointment internally uses React Query mutation
```

---

## Decision 5: snake_case Database, camelCase Frontend

**Date**: Pre-Phase 5B  
**Evidence**: Type mappings in hooks, manual field transformation

**Decision**:  
Database uses snake_case (`patient_id`, `specialty_id`), frontend uses camelCase

**Rationale**:
- **Database convention**: PostgreSQL standard is snake_case
- **TypeScript convention**: JavaScript/TypeScript standard is camelCase
- **Mapping**: Handled in hooks layer (e.g., `useAddAppointment`)

**Implementation**:
```tsx
// Frontend camelCase
const data = { patientId: '...', specialtyId: '...' };

// Hook maps to snake_case
.insert({
  patient_id: data.patientId,
  specialty_id: data.specialtyId
})
```

**Phase 5B.1 lesson**: Specialty mismatch bug was caused by passing NAME instead of ID, not case mismatch

---

## Decision 6: No Production Changes During Stabilization

**Date**: Phase 5B.1, Phase 5B.2  
**Evidence**: Explicit constraint in `ChatGPT_5.2_context.md`

**Decision**:  
ALL fixes and changes are local-only during stabilization phases

**Rationale**:
- **Risk mitigation**: Avoid breaking production during debugging
- **Testing**: Verify locally before any deployment
- **Rollback**: Easy to discard changes if needed

**Workflow**:
1. Fix locally
2. Test locally (`npm run dev`)
3. Document changes
4. Coordinate deployment with ChatGPT 5.2 (external)

**Constraint**: Do NOT push to main branch or deploy to Vercel during stabilization

---

## Decision 7: Supabase Local Link (Not Standalone)

**Date**: 2026-01-30 (from context doc)  
**Evidence**: `supabase link --project-ref oziejxqmghwmtjufstfp`

**Decision**:  
Local Supabase CLI is LINKED to remote project, not running standalone local DB

**Rationale**:
- **Schema sync**: `supabase db pull` verifies no drift
- **Migration verification**: Test migrations against shadow database
- **Single source of truth**: Remote DB is canonical

**NOT chosen**: Fully local Supabase instance  
**Why**: Simpler to link to existing remote, avoid dual-DB complexity

**Requires**: Docker Desktop running (for shadow database operations)

---

## Decision 8: Evidence-Based Documentation Only

**Date**: Phase 5B.1, 5B.2, 5C  
**Evidence**: Repeated "UNKNOWN" markers in docs where info not available

**Decision**:  
Documentation MUST be evidence-based - no invented schema/routes/tables

**Rationale**:
- **Accuracy**: Better to say "UNKNOWN" than guess wrong
- **Trust**: Subsequent agents can rely on documented facts
- **Debugging**: Incorrect assumptions cause wasted investigation time

**Rule**: If you can't prove it from files/runtime, mark it UNKNOWN

---

## Decision 9: Minimal Blast Radius Fixes

**Date**: Phase 5B.1, 5B.2  
**Evidence**: Single-line fixes, no refactoring

**Decision**:  
Fixes should be minimal changes to affected code only

**Examples**:
- Phase 5B.1: Changed 3 lines in `ManageProfessionalsModal.tsx`
- Phase 5B.2: Changed 2 lines in `PatientLookupByNIF.tsx`

**NOT chosen**: Large refactors, architectural changes

**Rationale**:
- **Risk**: Smaller changes = less can break
- **Review**: Easier for coordinator to verify
- **Rollback**: Simple to revert if needed

---

## Decision 10: Phase-Based Workflow

**Date**: Ongoing  
**Evidence**: Phase 5B.1, 5B.2 structure in context doc

**Decision**:  
Work is organized into phases: Audit → Fix → Validate → Document

**Standard phase workflow**:
1. **Planning** (if needed): Create implementation_plan.md
2. **Execution**: Make changes
3. **Verification**: Runtime or static testing
4. **Documentation**: Update context + backlog + walkthrough

**Each phase updates**:
- Code files (if applicable)
- `ChatGPT_5.2_context.md` (append phase section)
- `FRONTEND_STABILIZATION_BACKLOG.md` (mark status)
- Artifacts (walkthrough.md, task.md)

**Rationale**: Consistent structure makes handoffs easier

---

## Constraints (Hard Rules)

These are NON-NEGOTIABLE constraints from context doc:

1. **Do NOT touch production** - Local changes only
2. **Do NOT delete existing docs** - Only add/update
3. **Do NOT create new migrations** - Use existing schema
4. **Do NOT disable RLS** - Row Level Security must stay active
5. **Do NOT guess** - Mark UNKNOWN explicitly
6. **Do NOT refactor without explicit request** - Minimal fixes only

---

**Sources**:
- `ChatGPT_5.2_context.md` (decision evidence)
- `package.json` (tech stack decisions)
- Code structure analysis (architectural decisions)
- Phase 5B.1/5B.2 completed work (workflow decisions)

**Updated**: 2026-02-03 (Phase 5C)
