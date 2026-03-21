# Barnum — Local Development Runbook

> **Last updated:** 2026-02-06

---

## Prerequisites

- Node.js 18+ (LTS)
- npm (comes with Node)
- Git
- Supabase CLI (for Edge Functions local testing only)
- Docker Desktop (for Supabase local only — not required for frontend dev)

---

## Quick Start (Frontend Only)

```bash
# 1. Clone the repo
git clone https://github.com/ClientesCircleAgency/barnumdemo.git
cd barnumdemo

# 2. Install dependencies
npm install

# 3. Create .env file (copy from example)
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Start dev server
npm run dev
# Opens at http://localhost:8080
```

---

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Vercel (for API endpoints)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WEBHOOK_SECRET=shared-with-n8n-partner
N8N_WEBHOOK_SECRET=shared-with-n8n-partner
N8N_WEBHOOK_BASE_URL=https://your-n8n.com
INTERNAL_API_SECRET=manual-testing-secret
```

### Edge Functions (Supabase secrets)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SITE_URL=https://your-vercel-url.vercel.app
```

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend dev server (port 8080) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

### Edge Functions (requires Supabase CLI + Docker)
```bash
# Serve Edge Functions locally
supabase functions serve

# Deploy a single function
supabase functions deploy invite-collaborator

# Deploy all functions
supabase functions deploy

# View function logs
supabase functions logs invite-collaborator
```

---

## Testing Flows

### Login
1. Go to `http://localhost:8080/admin/login`
2. Use an admin account email/password
3. Should redirect to `/admin/dashboard`

### Create Appointment Request (Public)
1. Go to `http://localhost:8080`
2. Fill in the form and submit
3. Should appear in `/admin/pedidos` as "pending"

### Triage a Request
1. Go to `/admin/pedidos`
2. Click on a pending request
3. Set duration (minutes)
4. Select available doctor
5. Accept or reject (with reason)

### Invite a Collaborator
1. Go to `/admin/configuracoes`
2. Click "Novo Colaborador"
3. Fill email, role, professional details
4. Submit — user receives invite email

---

## Troubleshooting

### `vite` not found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Edge Function returns 401
- Check that `x-user-token` header is being sent
- Check that the user has admin role
- Check Supabase Edge Function logs: `supabase functions logs <name>`

### Collaborators not loading
- Check browser console for errors
- Verify Edge Functions are deployed: `supabase functions list`
- Check that `.env` points to the correct Supabase project

### TypeScript errors after migration changes
- Run `supabase gen types typescript > src/integrations/supabase/types.ts` to regenerate types
- Or manually add missing columns to the types file
