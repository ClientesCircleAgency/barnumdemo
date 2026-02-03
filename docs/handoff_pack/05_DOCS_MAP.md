# Documentation Map

**Purpose**: Navigate project documentation - what exists, what to trust, what's deprecated

---

## Documentation Hierarchy (Trust Level)

### Tier 1: CANONICAL (Always Trust)

**`ChatGPT_5.2_context.md`** (root directory)
- **Purpose**: Living context file - single source of truth
- **Content**: Current project state, phase history, decisions, constraints
- **Last Updated**: 2026-02-03 (Phase 5C section added)
- **Lines**: 1198
- **Status**: ✅ ACTIVELY MAINTAINED
- **Rule**: When in doubt, trust this file over all others

---

### Tier 2: CONTRACTS (Current State Documentation)

**Location**: `docs/contracts/`

**Files**:

1. **`FRONTEND_STABILIZATION_BACKLOG.md`** ✅ CANONICAL
   - Issue tracking (P0/P1/P2)
   - Status: Updated in Phase 5B.1, 5B.2
   - Use For: Current bugs/issues/priorities

2. **`FRONTEND_DB_CONTRACT.md`** ✅ CANONICAL
   - Frontend → Database interaction patterns
   - Payload shapes, target tables, UI flows
   - Use For: Understanding how frontend writes to Supabase

3. **`FRONTEND_ENUMS_AND_TYPES.md`** ✅ CANONICAL
   - TypeScript types, enums, validation schemas
   - Use For: Type definitions, enum values

4. **`VERCEL_API_CONTRACT.md`** ✅ CANONICAL
   - Serverless API routes (`/api` directory)
   - Use For: Understanding backend API endpoints

5. **`WHATSAPP_AUTOMATIONS_SPEC.md`** ⚠️ FUTURE FEATURE
   - n8n WhatsApp integration spec
   - Status: Planned, not implemented
   - Use For: Future reference only

6. **`supabase_backend_snapshot.md`** ⚠️ PARTIAL
   - Backend schema snapshot (4KB - likely incomplete)
   - Status: May be outdated/partial
   - Use For: Quick reference (verify against migrations)

7. **`P0_INVESTIGATION_REPORT.md`** 📄 HISTORICAL
   - Phase 5B investigation (concluded "no P0" - incorrect)
   - Status: Superseded by runtime discovery in 5B.2
   - Use For: Understanding investigation process (not conclusions)

**Verification Reports** (Evidence/Audit):
- `BACKEND_SCHEMA_CHANGE_PLAN.md`
- `BACKEND_VERIFICATION_REPORT.md`
- `LOCAL_MIGRATION_VALIDATION_REPORT.md` (+ Phase 4.1 version)

**Status**: Historical evidence, not living docs

---

### Tier 3: CONTEXT (Background & Historical)

**Location**: `docs/context/`

**Files** (14 total):

**Audit Documents**:
- `AUDIT_REPORT.md` (17KB)
- `SUPABASE_AUDIT.md` (13KB)
- `SUPABASE_AUDIT_REPORT.md` (35KB)
- `TECHNICAL_AUDIT_MASTER.md` (29KB)

**Purpose**: Historical audits, may contain outdated info  
**Use For**: Understanding project history, not current state

**Planning/Analysis**:
- `ACTION_PLAN.md`
- `FUNCTIONAL_ANALYSIS.md` (42KB - large)
- `IMPLEMENTATION_PLAN.md`
- `project-plan.md`

**Purpose**: Historical plans, may not reflect current implementation  
**Use For**: Background context only

**Setup/Technical**:
- `BACKEND_REPLICATION.md` (49KB - large)
- `CONFIRMACAO_TECNICA.md`
- `GUIA_SETUP_DATABASE.md`
- `SETUP_DATABASE.sql` (17KB SQL file)

**Purpose**: Setup guides, may be pre-Supabase-CLI  
**Use For**: Historical database setup reference

**Reference**:
- `GLOSSARY.md` - Project terminology
- `README.md` - Context folder index

**Status**: ⚠️ MAY BE OUTDATED - Cross-reference with canonical docs

---

### Tier 4: ARCHIVE (Deprecated/Future)

**Location**: `docs/archive/`

**Files**:

1. **`SUPABASE_BACKEND_SNAPSHOT.md`** (2.4KB)
   - Likely duplicate/older version of contracts/supabase_backend_snapshot.md
   - Status: Check if different from contracts version

2. **`knowledge-base.md`** (2.5KB)
   - Exploratory knowledge base
   - Status: Not actively maintained

3. **`mapa-de-webhooks-endpoints.md`** (29KB)
   - n8n/webhook endpoints guide
   - Status: Not finalized for current phase

**Subdirectory**: `docs/archive/n8n/`
- n8n WhatsApp guides (multiple, not listed here for brevity)
- Status: Future feature prep, not current phase

**Rule**: ⚠️ DO NOT TRUST for current state - archive is historical/future work

---

### Tier 5: HANDOFF PACK (You Are Here)

**Location**: `docs/handoff_pack/`

**Files**:
1. `00_README_START_HERE.md` - Entry point
2. `01_PROJECT_SNAPSHOT.md` - Tech stack + current state
3. `02_DECISIONS_AND_RATIONALE.md` - Why decisions were made
4. `03_STATUS_BOARD.md` - P0/P1/P2 tracker
5. `04_RUNBOOK_LOCAL_DEV.md` - How to run locally
6. `05_DOCS_MAP.md` - This file

**Purpose**: Quick onboarding for new agent  
**Status**: ✅ CURRENT (generated 2026-02-03)

---

## README Files (Multiple Locations)

**Root**: `/README.md`
- Project overview (standard GitHub README)
- Status: Likely current

**docs**: `/docs/README.md`
- Docs folder overview
- Status: Check if up-to-date

**docs/context**: `/docs/context/README.md`
- Context subfolder index
- Status: Historical

**docs/contracts**: `/docs/contracts/README.md`
- Contracts subfolder index (3KB)
- Status: Likely current

**Rule**: Root README is most likely to be current

---

## Known Contradictions/Duplicates

### 1. Backend Snapshot (2 versions)

**Version A**: `docs/contracts/supabase_backend_snapshot.md` (4KB)  
**Version B**: `docs/archive/SUPABASE_BACKEND_SNAPSHOT.md` (2.4KB)

**Status**: ⚠️ May be duplicates or different snapshots  
**Recommendation**: Use migrations in `supabase/migrations/` as source of truth

### 2. P0 Investigation vs Reality

**Document**: `docs/contracts/P0_INVESTIGATION_REPORT.md`  
**Conclusion**: "No P0 blocker exists"

**Reality**: Runtime testing found P0-001 (AppointmentWizard crash)

**Lesson**: Static analysis can miss runtime issues  
**Trust**: Runtime verification > static analysis

### 3. Multiple Audit Reports

**Files**:
- `AUDIT_REPORT.md`
- `SUPABASE_AUDIT.md`  
- SUPABASE_AUDIT_REPORT.md`
- `TECHNICAL_AUDIT_MASTER.md`

**Status**: Likely iterative audits from different phases  
**Recommendation**: Check dates/phases, trust newest

---

## When to Use Each Doc

### Starting new work
1. Read `ChatGPT_5.2_context.md` (what's been done)
2. Check `FRONTEND_STABILIZATION_BACKLOG.md` (what needs doing)
3. Review handoff pack (quick context)

### Understanding frontend code
1. `FRONTEND_DB_CONTRACT.md` (how data flows)
2. `FRONTEND_ENUMS_AND_TYPES.md` (type definitions)
3. Source code (final authority)

### Understanding backend
1. Migrations in `supabase/migrations/` (schema truth)
2. `VERCEL_API_CONTRACT.md` (API routes)
3. Context/audit docs (background only)

### Debugging an issue
1. `FRONTEND_STABILIZATION_BACKLOG.md` (known issues)
2. `ChatGPT_5.2_context.md` (recent fixes)
3. Browser DevTools (runtime evidence)

### Planning new feature
1. `ChatGPT_5.2_context.md` (current constraints)
2. `02_DECISIONS_AND_RATIONALE.md` (this handoff pack)
3. Coordinate with ChatGPT 5.2

---

## Documentation Maintenance Rules

### When to Update Docs

**Always update** (after ANY phase):
- ✅ `ChatGPT_5.2_context.md` (append phase section)
- ✅ `FRONTEND_STABILIZATION_BACKLOG.md` (mark issues fixed/open)

**Update if modified**:
- ✅ Relevant contract docs (if code contract changed)
- ✅ Handoff pack status board (if P0/P1/P2 status changed)

**Create new**:
- ✅ Walkthrough artifact (for completed phase)
- ✅ Task artifact (for phase tracking)

### Never Update (Archives)
- ❌ `docs/archive/*` - Historical, leave as-is
- ❌ `docs/context/*` - Unless explicitly maintaining

---

## File Size Reference (Large Docs)

Warning: These files are large, read selectively:

- `BACKEND_REPLICATION.md` (49KB)
- `FUNCTIONAL_ANALYSIS.md` (42KB)
- `SUPABASE_AUDIT_REPORT.md` (35KB)
- `TECHNICAL_AUDIT_MASTER.md` (29KB)
- `mapa-de-webhooks-endpoints.md` (29KB)

**Tip**: Use text search (Ctrl+F) instead of reading linearly

---

## Quick Reference: Where is X?

| What You Need | Where to Find It |
|---------------|------------------|
| Current project state | `ChatGPT_5.2_context.md` |
| Known bugs/issues | `docs/contracts/FRONTEND_STABILIZATION_BACKLOG.md` |
| Issue priorities (P0/P1/P2) | `docs/handoff_pack/03_STATUS_BOARD.md` |
| How to run locally | `docs/handoff_pack/04_RUNBOOK_LOCAL_DEV.md` |
| Tech decisions rationale | `docs/handoff_pack/02_DECISIONS_AND_RATIONALE.md` |
| Database schema | `supabase/migrations/*.sql` (primary) |
| Frontend types | `docs/contracts/FRONTEND_ENUMS_AND_TYPES.md` |
| API routes | `docs/contracts/VERCEL_API_CONTRACT.md` |
| Database interactions | `docs/contracts/FRONTEND_DB_CONTRACT.md` |
| Project history | `docs/context/*` (audits, plans) |
| n8n/WhatsApp stuff | `docs/archive/n8n/*` (future feature) |

---

## Deprecated Docs (Do Not Use)

**None explicitly marked deprecated**

**However, use with caution**:
- Docs in `docs/archive/` (outdated or future)
- Docs in `docs/context/` dated before 2026-01-30 (may be pre-current-phase)
- Any doc contradicting `ChatGPT_5.2_context.md`

**Rule**: When contradiction exists, trust canonical context file

---

## Next Agent Actions

1. **Scan this map** to know what documentation exists
2. **Read canonical docs first** (`ChatGPT_5.2_context.md`, contracts)
3. **Use handoff pack** for quick start (this folder)
4. **Ignore archives** unless researching history
5. **Always update** canonical docs when making changes

---

**Generated**: 2026-02-03 (Phase 5C)  
**Purpose**: Navigation guide for Barnum project documentation  
**Maintenance**: Update when new docs added or structure changes
