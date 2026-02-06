# Edge Function: invite-collaborator

**Created**: 2026-02-06  
**Location**: `supabase/functions/invite-collaborator/index.ts`  
**Purpose**: Invite collaborators (secretary/doctor), assign roles, and link/create professionals

---

## Overview

This Supabase Edge Function replaces the deprecated Vercel endpoint `/api/admin/invite-user`.

**Key benefits**:
- Service role key never exposed to frontend
- Admin auth validation via `has_role()` RPC
- Atomic professional linking/creation
- Proper cleanup on errors

---

## Endpoint Contract

### Request

**Method**: `POST`  
**URL**: `https://<project-ref>.supabase.co/functions/v1/invite-collaborator`  
**Headers**:
```
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

**Body**:
```typescript
{
  email: string;                    // Required: valid email
  role: "secretary" | "doctor";     // Required
  professional?: {                  // Required if role="doctor"
    mode: "create" | "link";        // Required
    id?: string;                    // Required if mode="link"
    name?: string;                  // Required if mode="create"
    specialty_id?: string | null;   // Optional
    color?: string | null;          // Optional (defaults to #6366f1)
  } | null;
}
```

### Response

**Success** (200):
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "role": "doctor",
  "professional": {
    "id": "uuid"
  }
}
```

**Error** (400/401/403/409/500):
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Business Logic

### Flow

1. **Validate JWT**: Extract user from Authorization header
2. **Check Admin**: Call `has_role(user.id, 'admin')`, reject if false
3. **Validate Input**: Email format, role enum, professional config
4. **Invite User**: Call `supabaseAdmin.auth.admin.inviteUserByEmail()`
5. **Assign Role**: Insert into `user_roles` table
6. **Handle Professional** (if role=doctor):
   - **Link mode**: Update `professionals.user_id` (validates not already linked)
   - **Create mode**: Insert new `professionals` row with `user_id`
7. **Return Success**: Return user + professional info

### Error Handling

**Cleanup on failure**:
- If role insert fails → delete invited user
- If professional link/create fails → delete invited user + role

**Validation checks**:
- Professional exists (link mode)
- Professional not already linked (link mode)
- Required fields present (create mode)

---

## Security

### Authentication

- **JWT validation**: Edge function validates Bearer token via `supabaseUser.auth.getUser()`
- **Admin check**: Calls `has_role()` RPC with user's JWT context
- **Service role**: Used internally for admin operations (never exposed)

### Authorization

**Admin-only**: Only users with `admin` role can invoke this function.

**RLS bypass**: Service role client bypasses RLS for:
- `auth.users` (admin API)
- `user_roles` (insert)
- `professionals` (insert/update)

---

## Local Development

### Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Start Supabase local
supabase start
```

### Serve Edge Function

```bash
# Serve all functions
supabase functions serve

# Or serve specific function
supabase functions serve invite-collaborator --env-file .env.local
```

### Environment Variables

Create `.env.local` in root:
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-start>
SITE_URL=http://localhost:5173
```

### Test via Frontend

1. Start Supabase: `supabase start`
2. Start Edge Function: `supabase functions serve`
3. Start frontend: `npm run dev`
4. Login as admin
5. Navigate to Settings > Colaboradores
6. Click "Convidar" button
7. Fill form and submit

### Test via cURL

```bash
# Get admin JWT token first (via Supabase Dashboard or login)
ADMIN_JWT="<your-admin-jwt>"

# Invite secretary
curl -X POST http://localhost:54321/functions/v1/invite-collaborator \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "secretary@test.com",
    "role": "secretary"
  }'

# Invite doctor (create new professional)
curl -X POST http://localhost:54321/functions/v1/invite-collaborator \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@test.com",
    "role": "doctor",
    "professional": {
      "mode": "create",
      "name": "Dr. João Silva",
      "specialty_id": null,
      "color": "#3b82f6"
    }
  }'

# Invite doctor (link to existing professional)
curl -X POST http://localhost:54321/functions/v1/invite-collaborator \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor2@test.com",
    "role": "doctor",
    "professional": {
      "mode": "link",
      "id": "<professional-uuid>"
    }
  }'
```

---

## Production Deployment

### Deploy Function

```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref <your-project-ref>

# Deploy function
supabase functions deploy invite-collaborator
```

### Set Environment Variables

In Supabase Dashboard → Edge Functions → Configuration:
```
SITE_URL=https://your-production-domain.com
```

Note: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available.

### Update Frontend

Ensure frontend calls the correct URL:
```typescript
const { data, error } = await supabase.functions.invoke(
  'invite-collaborator',
  {
    body: { email, role, professional },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  }
);
```

---

## UI Integration

### Component

**File**: `src/components/admin/ManageCollaboratorsModal.tsx`

**Features**:
- Email input (required)
- Role selector: Secretary | Doctor
- Professional configuration (doctor only):
  - Radio: "Link existing" | "Create new"
  - Link mode: Dropdown of available professionals
  - Create mode: Name, specialty, color inputs

### Settings Page

**File**: `src/pages/admin/SettingsPage.tsx`

**Unified Section**: "Colaboradores" (replaced "Equipa" + "Utilizadores")

**Display**:
- List of professionals
- Badge: "Conta" (has user_id) | "Sem conta" (no user_id)
- "Convidar" button (admin only)

---

## Migration from Vercel Endpoint

### Old Endpoint (Deprecated)

**File**: `api/admin/invite-user.ts`  
**Status**: Deprecated (2026-02-06)  
**Why**: Exposed service role key risk, no professional linking

### New Edge Function

**File**: `supabase/functions/invite-collaborator/index.ts`  
**Benefits**:
- Service role secure (server-side only)
- Atomic professional operations
- Better error handling

### Breaking Changes

None. Frontend now calls `supabase.functions.invoke()` instead of `fetch('/api/admin/invite-user')`.

---

## Troubleshooting

### Error: "Invalid or expired token"

**Cause**: JWT expired or invalid  
**Fix**: Re-login to get fresh JWT

### Error: "Forbidden: Admin role required"

**Cause**: User does not have `admin` role in `user_roles` table  
**Fix**: Verify role assignment:
```sql
SELECT * FROM user_roles WHERE user_id = '<user-id>';
```

### Error: "Professional already linked to another user"

**Cause**: Trying to link a professional that has `user_id` already set  
**Fix**: Use "Create new professional" mode OR unlink existing user first:
```sql
UPDATE professionals SET user_id = NULL WHERE id = '<professional-id>';
```

### Error: "Professional not found"

**Cause**: Invalid professional ID in link mode  
**Fix**: Verify professional exists:
```sql
SELECT id, name, user_id FROM professionals WHERE id = '<professional-id>';
```

---

## Related Files

- Edge Function: `supabase/functions/invite-collaborator/index.ts`
- UI Modal: `src/components/admin/ManageCollaboratorsModal.tsx`
- Settings Page: `src/pages/admin/SettingsPage.tsx`
- Type Definition: `src/types/clinic.ts` (Professional interface)
- Deprecated Endpoint: `api/admin/invite-user.ts`

---

**Last Updated**: 2026-02-06
