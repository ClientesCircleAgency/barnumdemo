# Testing Edge Functions Locally

**Updated**: 2026-02-06  
**Scope**: Collaborator management via Supabase Edge Functions

---

## Prerequisites

### Required Tools

1. **Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Node.js** (for frontend):
   ```bash
   node --version  # Should be 18+
   ```

### Required Files

- `.env.local` (root directory) - see below

---

## Environment Setup

### Create .env.local

Create file at project root:

```env
# Supabase Local (from 'supabase start' output)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-start>

# Frontend URL
SITE_URL=http://localhost:5173

# Vite Frontend Variables (must start with VITE_)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key-from-supabase-start>
```

---

## Step-by-Step Local Testing

### Step 1: Start Supabase Local Stack

```bash
cd supabase
supabase start
```

**Expected Output**:
```
Started supabase local development setup.

API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGc...
service_role key: eyJhbGc...
```

**Copy** the `anon key` and `service_role key` to your `.env.local` file.

### Step 2: Serve Edge Functions

**Terminal 1** (keep running):
```bash
supabase functions serve
```

**Expected Output**:
```
Serving functions on http://localhost:54321/functions/v1
  - invite-collaborator
  - list-collaborators
```

### Step 3: Start Frontend

**Terminal 2** (keep running):
```bash
npm run dev
```

**Expected Output**:
```
VITE v5.4.19  ready in 523 ms

➜  Local:   http://localhost:5173/
```

### Step 4: Create Admin User (First Time Only)

**Option A: Via SQL** (Supabase Studio):

1. Open: http://localhost:54323 (Supabase Studio)
2. Go to: SQL Editor
3. Run:

```sql
-- Create admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  FALSE,
  ''
) RETURNING id;

-- Assign admin role (replace <user-id> with returned id)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('<user-id>', 'admin');
```

**Option B: Via Auth API** (simpler):

Navigate to: http://localhost:5173  
(If signup page exists, create account; otherwise use SQL above)

---

## Manual Test Scenarios

### Scenario 1: Invite Secretary

**Steps**:
1. Login as admin: http://localhost:5173/admin/login
   - Email: `admin@test.com`
   - Password: `admin123`
2. Navigate to: `/admin/configuracoes`
3. Scroll to: "Colaboradores" section
4. Click: "Convidar" button
5. Modal opens: "Convidar Colaborador"
6. Fill form:
   - Email: `secretary@test.com`
   - Tipo de Conta: **Secretária**
7. Click: "Enviar Convite"

**Expected**:
- ✅ Toast: "Convite enviado para secretary@test.com..."
- ✅ Modal closes
- ✅ Collaborators list refreshes
- ✅ New entry appears:
  - Initials: "SE" (from email)
  - Name: "secretary"
  - Subtitle: "Secretária"
  - Badge: Green "Secretária" badge

**SQL Validation**:
```sql
-- Check user created
SELECT u.id, u.email, u.email_confirmed_at 
FROM auth.users u 
WHERE u.email = 'secretary@test.com';
-- Expected: 1 row, email_confirmed_at = NULL (pending invite)

-- Check role assigned
SELECT ur.user_id, ur.role 
FROM user_roles ur 
JOIN auth.users u ON ur.user_id = u.id 
WHERE u.email = 'secretary@test.com';
-- Expected: 1 row, role = 'secretary'

-- Check NO professional created (secretary doesn't need one)
SELECT COUNT(*) 
FROM professionals 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'secretary@test.com');
-- Expected: 0
```

### Scenario 2: Invite Doctor + Create New Professional

**Steps**:
1. In "Convidar Colaborador" modal
2. Fill form:
   - Email: `doctor@test.com`
   - Tipo de Conta: **Médico**
3. Professional configuration appears
4. Select: **"Criar novo profissional"** (radio button)
5. Fill professional fields:
   - Nome do Profissional: `Dr. João Silva`
   - Especialidade: (select any, e.g., "Medicina Geral")
   - Cor: `#3b82f6` (blue)
6. Click: "Enviar Convite"

**Expected**:
- ✅ Toast: "Convite enviado para doctor@test.com..."
- ✅ Modal closes
- ✅ Collaborators list refreshes
- ✅ New entry appears:
  - Initials: "JS" (from "João Silva")
  - Name: "Dr. João Silva"
  - Subtitle: "Medicina Geral"
  - Badge: "Médico"

**SQL Validation**:
```sql
-- Check user created
SELECT u.id, u.email 
FROM auth.users u 
WHERE u.email = 'doctor@test.com';

-- Check role assigned
SELECT ur.role 
FROM user_roles ur 
JOIN auth.users u ON ur.user_id = u.id 
WHERE u.email = 'doctor@test.com';
-- Expected: role = 'doctor'

-- Check professional created AND linked
SELECT p.id, p.name, p.user_id, p.color 
FROM professionals p 
WHERE p.user_id = (SELECT id FROM auth.users WHERE email = 'doctor@test.com');
-- Expected: 1 row, name = 'Dr. João Silva', user_id = user.id
```

### Scenario 3: Invite Doctor + Link Existing Professional

**Prerequisites**: Create unlinked professional first:

```sql
INSERT INTO professionals (id, name, specialty_id, color, user_id)
VALUES (
  gen_random_uuid(),
  'Dra. Maria Santos',
  (SELECT id FROM specialties LIMIT 1),
  '#ec4899',
  NULL  -- No user_id = available for linking
);
```

**Steps**:
1. In "Convidar Colaborador" modal
2. Fill form:
   - Email: `doctor2@test.com`
   - Tipo de Conta: **Médico**
3. Select: **"Ligar a profissional existente"** (radio button)
4. Dropdown appears: "Selecionar Profissional"
5. Select: "Dra. Maria Santos"
6. Click: "Enviar Convite"

**Expected**:
- ✅ Toast: "Convite enviado..."
- ✅ Collaborators list refreshes
- ✅ "Dra. Maria Santos" now shows "Médico" badge (was "Sem conta" before)

**SQL Validation**:
```sql
-- Check professional linked
SELECT p.name, p.user_id, u.email 
FROM professionals p 
JOIN auth.users u ON p.user_id = u.id 
WHERE u.email = 'doctor2@test.com';
-- Expected: 1 row, name = 'Dra. Maria Santos', user_id linked
```

---

## Error Scenarios

### Error 1: Non-Admin Tries to Invite

**Steps**:
1. Login as secretary (if exists)
2. Navigate to `/admin/configuracoes`
3. "Convidar" button should be HIDDEN (Badge "Admin" shown instead)

**If button visible and clicked**:
- ✅ Edge Function returns 403: "Forbidden: Admin role required"
- ✅ Toast error shown

### Error 2: Link Already-Linked Professional

**Steps**:
1. Try to invite doctor and link to professional that already has `user_id`

**Expected**:
- ✅ Toast error: "Professional already linked to another user"
- ✅ User NOT created (atomic rollback)

**SQL Validation**:
```sql
-- Check no orphan user created
SELECT COUNT(*) FROM auth.users WHERE email = '<failed-email>';
-- Expected: 0
```

### Error 3: Invalid Email Format

**Steps**:
1. Enter email: `invalidemail`
2. Click "Enviar Convite"

**Expected**:
- ✅ Edge Function returns 400: "Invalid email address"
- ✅ Toast error shown

---

## Debugging

### View Edge Function Logs

**Terminal 1** (where `supabase functions serve` is running):
- All console.log() and console.error() appear here
- Check for errors after each test

### View Email Invites (Inbucket)

1. Open: http://localhost:54324
2. Click on recipient email
3. View invite email with password reset link

### Check Database State

**Supabase Studio**: http://localhost:54323

**Quick queries**:
```sql
-- All users with roles
SELECT u.email, ur.role, p.name AS professional_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN professionals p ON p.user_id = u.id
ORDER BY ur.role, u.email;

-- Professionals with/without accounts
SELECT p.name, p.user_id, u.email
FROM professionals p
LEFT JOIN auth.users u ON p.user_id = u.id
ORDER BY p.name;
```

---

## Common Issues

### Issue: "Function not found"

**Cause**: Edge Function not served  
**Fix**:
```bash
# Stop and restart
supabase functions serve
```

### Issue: "Missing authorization header"

**Cause**: Session expired  
**Fix**: Logout and login again

### Issue: "Invalid or expired token"

**Cause**: JWT expired (default: 1 hour)  
**Fix**: Logout and login again

### Issue: Collaborators list empty

**Cause**: Edge Function `list-collaborators` not running  
**Fix**:
```bash
# Verify both functions served
supabase functions serve

# Should show:
# - invite-collaborator
# - list-collaborators
```

### Issue: CORS error in browser console

**Cause**: CORS headers missing or incorrect  
**Fix**: Both Edge Functions already have CORS headers (lines 6-10)

---

## Production Testing

### Deploy Functions

```bash
# Login
supabase login

# Link project
supabase link --project-ref <your-project-ref>

# Deploy both functions
supabase functions deploy invite-collaborator
supabase functions deploy list-collaborators

# Verify deployed
supabase functions list
```

### Set Environment Variables

**Supabase Dashboard → Edge Functions → Configuration**:
```
SITE_URL=https://your-production-domain.com
```

### Test in Production

1. Navigate to: `https://your-domain.com/admin/configuracoes`
2. Follow same manual test scenarios as local
3. Check production logs in Supabase Dashboard → Edge Functions → Logs

---

## Quick Smoke Test (5 Minutes)

**All-in-one validation**:

1. ✅ `supabase start` → services running
2. ✅ `supabase functions serve` → both functions listed
3. ✅ `npm run dev` → frontend running
4. ✅ Login as admin → Settings page loads
5. ✅ "Colaboradores" section visible
6. ✅ Click "Convidar" → modal opens
7. ✅ Invite secretary → success toast
8. ✅ List refreshes → secretary appears
9. ✅ Invite doctor (create) → success toast
10. ✅ List shows both secretary + doctor

**If all 10 pass**: ✅ System functional

---

**End of Testing Guide**
