# Local Development Runbook

**Purpose**: Minimal steps to run project locally and validate changes

---

## Prerequisites

### Required Software
- **Node.js**: v18+ (for npm)
- **Docker Desktop**: Required for Supabase CLI operations (shadow database)
- **Terminal**: PowerShell (Windows)

### Environment Files
- `.env` exists in project root (contains Supabase credentials)
- `.env.example` available as template

**Critical**: Supabase project ref is `oziejxqmghwmtjufstfp`

---

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
# From project root
npm install
```

**Expected**: No errors, `node_modules/` populated

---

### 2. Start Development Server

```bash
npm run dev
```

**Expected Output**:
```
VITE v5.4.19  ready in [time] ms

➜  Local:   http://localhost:8080/
➜  Network: http://[ip]:8080/
```

**Access**: Open http://localhost:8080/ in browser

**Hot Reload**: Changes to `.tsx` files auto-reload

---

### 3. Login to Admin

**URL**: http://localhost:8080/admin/login

**Credentials**: UNKNOWN (not in docs - ask coordinator)

**After Login**: Redirects to `/admin/dashboard`

---

## Common Commands

### Development

```bash
# Start dev server (Vite)
npm run dev

# Build production bundle
npm run build

# Build development bundle
npm run build:dev

# Preview production build
npm preview

# Run linter
npm run lint
```

**Note**: No `type-check` script exists (see P2-003 in status board)

---

## Supabase CLI Commands

**Requires**: Docker Desktop running

### Check Link Status

```bash
# Verify project link
supabase projects list

# Expected: oziejxqmghwmtjufstfp appears in list
```

### Schema Operations

```bash
# Pull remote schema (creates shadow DB)
supabase db pull

# Expected: "No schema changes found" (if in sync)
```

```bash
# Check migration status
supabase db diff

# Expected: No differences if schema synced
```

**DO NOT Run**:
- `supabase db push` - Don't push changes to remote
- `supabase db reset` - Don't reset local database
- `supabase migration new` - Don't create new migrations

---

## Validation Checklist

### After Making Code Changes

- [ ] **Lint Check**: Run `npm run lint` (no errors)
- [ ] **Build Check**: Run `npm run build` (successful compilation)
- [ ] **Dev Server**: Verify `npm run dev` still works
- [ ] **Manual Testing**: Test affected feature in browser
- [ ] **Console Clean**: No JavaScript errors in browser console (F12)

### Specific Features to Test

**Manual Appointment Creation** (P0-001 fix):
- [ ] Click "+ Nova Consulta" button in admin sidebar
- [ ] Modal opens without crash
- [ ] Enter 9-digit NIF (e.g., `123456789`)
- [ ] Search finds patient OR shows "not found" + create option
- [ ] Create appointment flow completes

**Professional Management** (P1-001 fix):
- [ ] Navigate to `/admin/configuracoes`
- [ ] Click "Gerir Profissionais"
- [ ] Click "Adicio nar Profissional"
- [ ] Select specialty from dropdown
- [ ] Verify dropdown shows specialty NAMES (not UUIDs)
- [ ] Create professional (if testing full flow)

---

## Common Failure Modes & Fixes

### "Docker not running" error

**Symptom**:
```
Error: Docker is not running
```

**Fix**:
1. Open Docker Desktop
2. Wait for Docker to fully start (green indicator)
3. Retry Supabase CLI command

---

### "Module not found" errors

**Symptom**:
```
Error: Cannot find module '@/components/...'
```

**Fix**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

### Vite port conflict (8080 already in use)

**Symptom**:
```
Port 8080 is in use, trying another one...
```

**Fix**:
- Vite will auto-select next available port (8081, 8082, etc.)
- OR kill process on port 8080:

```powershell
# Find process
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess

# Kill it (use PID from above)
Stop-Process -Id [PID]
```

---

### Supabase connection errors

**Symptom**:
```
Error: Invalid API key
```

**Fix**:
1. Check `.env` file exists
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Compare with `.env.example` format

**DO NOT** commit `.env` to git (it's in `.gitignore`)

---

### React Hook Form context null (similar to P0-001)

**Symptom**:
```
TypeError: (intermediate value)() is null
```

**Diagnosis**:
- Check if `FormLabel`, `FormField`, or `FormControl` used outside `<Form>` wrapper
- Use browser DevTools → Components tab to inspect React tree

**Fix**:
- Ensure `<Form {...form}>` wraps all FormField components
- Use regular `<Label>` for standalone inputs (not part of FormField)

---

## Environment Variables

**Required in `.env`**:

```env
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

**Optional** (check `.env.example` for full list):
- `VITE_ENABLE_REALTIME=true` (if using Supabase real-time)

**Note**: All Vite env vars must start with `VITE_` prefix

---

## Browser Testing Setup

### Recommended Dev Tools

1. **React DevTools** extension (Chrome/Edge)
   - Inspect component tree
   - Check props/state

2. **Console** (F12 → Console tab)
   - Watch for errors/warnings
   - Debug statements will appear here

3. **Network** tab (F12 → Network)
   - Monitor Supabase API calls
   - Check for failed requests (4xx, 5xx)

### Test Data

**Patient NIF examples** (if testing):
- UNKNOWN (check if test data exists in Supabase)
- Create test patient via UI if needed

**Professional/Specialty data**:
- UNKNOWN (likely seeded in database)
- Check Settings → Gerir Profissionais for existing data

---

## Deployment (DO NOT DO)

**CRITICAL**: During stabilization phase, do NOT deploy to production

**Blocked actions**:
- ❌ `git push origin main` (if main branch is production)
- ❌ Vercel deployment
- ❌ `supabase db push` (schema changes to remote)

**Allowed**:
- ✅ Local feature branches
- ✅ Local commits
- ✅ Pull requests (for review, NOT merge)

**Deployment authority**: ChatGPT 5.2 coordinator only

---

## Troubleshooting Decision Tree

```
Problem: Something doesn't work
│
├─> TypeScript/Build error?
│   └─> Run `npm run build` → see specific errors → fix types
│
├─> Runtime crash in browser?
│   ├─> Check browser console (F12)
│   ├─> Look for stack trace
│   └─> Common: React Hook Form context → check Form wrapper
│
├─> Supabase connection error?
│   ├─> Verify Docker running (for CLI)
│   ├─> Check `.env` file
│   └─> Test project link: `supabase projects list`
│
├─> Feature not working as expected?
│   ├─> Check Status Board (03_STATUS_BOARD.md) - is it a known issue?
│   ├─> Check FRONTEND_STABILIZATION_BACKLOG.md
│   └─> May need runtime debugging
│
└─> Unknown error?
    ├─> Search ChatGPT_5.2_context.md for similar issues
    ├─> Check recent phase sections (5B.1, 5B.2)
    └─> Ask coordinator (ChatGPT 5.2)
```

---

## Next Steps After Setup

1. **Verify setup**: Run through validation checklist above
2. **Review status board**: Check `03_STATUS_BOARD.md` for current task
3. **Read context**: Skim `ChatGPT_5.2_context.md` for recent work
4. **Coordinate**: Ask ChatGPT 5.2 what to work on next

---

**Last Updated**: 2026-02-03 (Phase 5C)  
**Tested On**: Windows + Docker Desktop + Node 18+
