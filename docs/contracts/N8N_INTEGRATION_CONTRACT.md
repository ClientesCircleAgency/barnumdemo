# n8n Integration Contract
**Barnum Clinic Management Platform**  
**Version**: 1.0  
**Last Updated**: 2026-02-06

---

## Architecture Decision

**n8n is the ONLY scheduler.** The backend does NOT own any time-based business logic.

- Backend exposes reactive webhook endpoints
- n8n decides WHEN to call these endpoints
- Backend writes DB state and processes events when called

---

## Authentication

All n8n → Backend webhook calls require authentication:

**Header**: `x-n8n-secret`  
**Value**: `${N8N_WEBHOOK_SECRET}` (shared secret)

**Example**:
```http
POST /api/n8n/process-events
Host: your-domain.vercel.app
Content-Type: application/json
x-n8n-secret: your-secret-here

{}
```

**Security Notes**:
- `N8N_WEBHOOK_SECRET` must be configured in both n8n and Vercel
- Use a strong random secret (min 32 characters)
- Rotate periodically

---

## Webhook Endpoints

### 1. Process WhatsApp Events

**Purpose**: Process pending `whatsapp_events` and send to n8n's WhatsApp webhook.

**URL**: `POST /api/n8n/process-events`

**Auth**: `x-n8n-secret` header (required)

**Request Body**:
```json
{}
```
(Empty body or omit entirely)

**Response**:
```json
{
  "success": true,
  "processed": 5,
  "failed": 0,
  "errors": []
}
```

**Fields**:
- `success` (boolean): Overall operation success
- `processed` (number): Number of events successfully sent to n8n
- `failed` (number): Number of events that failed
- `errors` (string[], optional): Error messages if any

**n8n Schedule Recommendation**: Every 5 minutes

**Example n8n Workflow**:
```
[Cron Trigger: */5 * * * *]
  → [HTTP Request Node]
      Method: POST
      URL: https://your-domain.vercel.app/api/n8n/process-events
      Headers: { "x-n8n-secret": "{{$env.N8N_WEBHOOK_SECRET}}" }
      Body: {}
```

**Side Effects**:
- Queries `whatsapp_events` table for `status='pending'` AND `scheduled_for <= NOW()`
- Updates `status` to `'processing'` → `'sent'` or `'dead_letter'`
- Sends HTTP POST to `N8N_WEBHOOK_BASE_URL` with event payload
- Updates `whatsapp_workflows` status to `'sent'`

**Error Handling**:
- Failed events: Increments `retry_count`
- After `max_retries` (default 3): Moves to `status='dead_letter'`
- Exponential backoff: Next retry scheduled at `NOW() + retry_count * 60 seconds`

---

### 2. Create 24h Confirmation Workflows

**Purpose**: Create pre-confirmation workflows for appointments happening in ~24 hours.

**URL**: `POST /api/n8n/create-24h-confirmations`

**Auth**: `x-n8n-secret` header (required)

**Request Body**:
```json
{
  "targetDate": "2026-02-07"
}
```
(Optional: `targetDate` for testing. Omit in production to auto-calculate 24h window)

**Response**:
```json
{
  "success": true,
  "checked": 15,
  "created": 8,
  "skipped": 7,
  "errors": []
}
```

**Fields**:
- `success` (boolean): Overall operation success
- `checked` (number): Number of appointments evaluated
- `created` (number): Number of workflows created
- `skipped` (number): Number skipped (already exists or no patient phone)
- `errors` (string[], optional): Error messages if any

**n8n Schedule Recommendation**: Daily at 08:00 (to prepare next day's confirmations)

**Example n8n Workflow**:
```
[Cron Trigger: 0 8 * * *]  (Daily at 08:00)
  → [HTTP Request Node]
      Method: POST
      URL: https://your-domain.vercel.app/api/n8n/create-24h-confirmations
      Headers: { "x-n8n-secret": "{{$env.N8N_WEBHOOK_SECRET}}" }
      Body: {}
```

**Business Logic**:
- Finds appointments with `date` in 23-25 hours from now
- Filters by `status IN ('scheduled', 'pre_confirmed')`
- **Idempotent**: Checks if workflow already exists before creating
- Creates `whatsapp_workflows` record with `workflow_type='pre_confirmation'`
- Creates `whatsapp_events` record with `event_type='appointment.pre_confirmation'`
- Events are picked up by next `/api/n8n/process-events` call

**Side Effects**:
- Inserts into `whatsapp_workflows` table (if not exists)
- Inserts into `whatsapp_events` table
- Does NOT send immediately (waits for process-events call)

---

## Database Tables (Reference)

### `whatsapp_events`

Events outbox. Created by backend triggers/endpoints, consumed by n8n.

**Key Columns**:
- `id` (uuid): Primary key
- `event_type` (text): e.g., `'appointment.pre_confirmation'`, `'appointment.cancelled'`
- `entity_type` (text): e.g., `'appointment'`, `'patient'`
- `entity_id` (uuid): Foreign key to entity
- `workflow_id` (uuid, nullable): Link to `whatsapp_workflows`
- `payload` (jsonb): Event data sent to n8n
- `status` (text): `'pending'` | `'processing'` | `'sent'` | `'dead_letter'`
- `scheduled_for` (timestamptz): When to send (process-events checks this)
- `retry_count` (integer): Number of failed attempts
- `max_retries` (integer): Max attempts before dead_letter (default 3)

### `whatsapp_workflows`

Workflow tracking. One workflow may generate multiple events.

**Key Columns**:
- `id` (uuid): Primary key
- `appointment_id` (uuid, nullable): Link to appointment
- `patient_id` (uuid): Link to patient
- `phone` (text): Patient phone number
- `workflow_type` (text): e.g., `'pre_confirmation'`, `'reschedule_no_show'`
- `status` (text): `'pending'` | `'sent'` | `'completed'` | `'cancelled'`
- `scheduled_at` (timestamptz): When workflow was scheduled
- `sent_at` (timestamptz, nullable): When first message sent
- `responded_at` (timestamptz, nullable): When patient responded
- `response` (text, nullable): Patient response type

---

## Environment Variables (Required)

### Backend (Vercel)

```bash
# Supabase (existing)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# n8n Integration (NEW)
N8N_WEBHOOK_SECRET=<strong-random-secret-32-chars>
N8N_WEBHOOK_BASE_URL=https://your-n8n.instance.com/webhook/whatsapp

# Internal Testing (existing)
INTERNAL_API_SECRET=<another-strong-secret>

# WhatsApp Webhook (existing)
WEBHOOK_SECRET=<hmac-secret-for-incoming-webhooks>
```

### n8n

```bash
# Backend Access
N8N_WEBHOOK_SECRET=<same-as-backend>

# (Other n8n-specific vars as needed)
```

---

## Event Types Reference

Events created by backend, sent to n8n via `/api/n8n/process-events`:

| Event Type | Trigger | Payload Schema |
|------------|---------|----------------|
| `appointment.pre_confirmation` | 24h before appointment | `{ appointment_id, patient_id, date, time }` |
| `appointment.cancelled` | Staff cancels appointment | `{ appointment_id, patient_id, cancellation_reason }` |
| `appointment.suggestion_sent` | Staff suggests alternative slots | `{ appointment_request_id, patient_id, suggested_slots: [{date, time, professional_id}] }` |
| `appointment.no_show_reschedule` | Appointment marked as no-show | `{ appointment_id, patient_id }` |
| `appointment.review_reminder` | Appointment finalized (2h later) | `{ appointment_id, patient_id, final_notes }` |
| `appointment.post_consultation` | Same as review_reminder | `{ appointment_id, patient_id, final_notes }` |

**Full payload structure**:
```json
{
  "event_type": "appointment.pre_confirmation",
  "timestamp": "2026-02-06T12:00:00Z",
  "entity_id": "uuid-here",
  "entity_type": "appointment",
  "appointment_id": "uuid-here",
  "patient_id": "uuid-here",
  "date": "2026-02-07",
  "time": "14:30"
}
```

---

## n8n Workflow Examples

### Full Automation Flow

```
[Cron: Daily 08:00] → Create 24h Confirmations
    ↓
[Cron: Every 5 min] → Process Events
    ↓
[Webhook from Backend] ← Receives event payloads
    ↓
[Decision Node] → Route by event_type
    ↓
[WhatsApp Send Node] → Send message to patient
    ↓
[Wait for Reply Node] → Patient responds
    ↓
[Webhook to Backend] → Call /api/webhook with patient response
```

### Minimal Setup (Start Here)

**Step 1**: Process events regularly
```
Cron Trigger (*/5 * * * *)
  → HTTP Request
      POST /api/n8n/process-events
      x-n8n-secret: ${N8N_WEBHOOK_SECRET}
```

**Step 2**: Create 24h confirmations daily
```
Cron Trigger (0 8 * * *)
  → HTTP Request
      POST /api/n8n/create-24h-confirmations
      x-n8n-secret: ${N8N_WEBHOOK_SECRET}
```

**Step 3**: Receive events and send WhatsApp
```
Webhook Trigger (listens to N8N_WEBHOOK_BASE_URL)
  → WhatsApp Business Node
      Send message based on event_type
```

---

## Testing

### Manual Testing (Local Development)

**1. Process Events**:
```bash
curl -X POST http://localhost:5173/api/n8n/process-events \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: test-secret" \
  -d '{}'
```

**2. Create 24h Confirmations (with test date)**:
```bash
curl -X POST http://localhost:5173/api/n8n/create-24h-confirmations \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: test-secret" \
  -d '{"targetDate":"2026-02-07"}'
```

### Production Testing

**1. Verify n8n can reach backend**:
```bash
# From n8n HTTP Request node, test connection
POST https://your-domain.vercel.app/api/n8n/process-events
Headers: x-n8n-secret: <your-secret>
Body: {}

# Expected: 200 OK with { "success": true, ... }
```

**2. Verify events are created**:
```sql
-- Check pending events
SELECT * FROM whatsapp_events WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;

-- Check workflows
SELECT * FROM whatsapp_workflows WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;
```

**3. Monitor processing**:
```sql
-- Check sent events
SELECT event_type, COUNT(*) 
FROM whatsapp_events 
WHERE status = 'sent' AND processed_at >= NOW() - INTERVAL '1 hour'
GROUP BY event_type;

-- Check dead letter (failures)
SELECT * FROM whatsapp_events WHERE status = 'dead_letter' ORDER BY processed_at DESC LIMIT 10;
```

---

## Error Handling & Monitoring

### Backend Errors

**401 Unauthorized**:
- Missing or incorrect `x-n8n-secret` header
- Fix: Verify `N8N_WEBHOOK_SECRET` matches in both n8n and Vercel

**500 Internal Server Error**:
- Check `N8N_WEBHOOK_BASE_URL` is configured
- Check Supabase connection (service role key valid)
- Check backend logs in Vercel dashboard

### n8n Webhook Failures

**Events stuck in `pending`**:
- Check n8n's process-events workflow is running
- Check n8n can reach `N8N_WEBHOOK_BASE_URL`
- Check n8n's WhatsApp Business integration is active

**Events in `dead_letter`**:
- Check `last_error` column in `whatsapp_events` table
- Common causes: n8n webhook down, invalid payload, WhatsApp API error

### Recommended Monitoring

**SQL Query (Daily Check)**:
```sql
-- Events older than 1 hour still pending (alert)
SELECT COUNT(*) FROM whatsapp_events 
WHERE status = 'pending' AND scheduled_for < NOW() - INTERVAL '1 hour';

-- Dead letter events (alert if > 0)
SELECT COUNT(*) FROM whatsapp_events WHERE status = 'dead_letter';
```

**n8n Monitoring**:
- Set up n8n workflow error notifications
- Monitor HTTP Request node failures
- Log all WhatsApp send failures

---

## Migration from Old Architecture

**If you previously used Vercel Cron**:

1. **Remove Vercel Cron** (already done in backend)
   - `vercel.json` no longer has `crons` array
   - `api/cron/*` endpoints deleted

2. **Update n8n workflows**:
   - Replace any calls to `/api/cron/*` with `/api/n8n/*`
   - Add `x-n8n-secret` header to all HTTP Request nodes
   - Update environment variable names (if different)

3. **No DB changes required**:
   - Tables remain the same
   - Event processing logic unchanged
   - Only timing ownership changed (Vercel → n8n)

---

## Support & Troubleshooting

**Contact**: Backend team via Slack/Email

**Common Issues**:

1. **No events being sent**:
   - Check n8n's process-events workflow is scheduled
   - Check `x-n8n-secret` is correct
   - Check events exist in DB: `SELECT * FROM whatsapp_events WHERE status='pending'`

2. **24h confirmations not created**:
   - Check n8n's create-24h-confirmations workflow runs daily
   - Check appointments exist in DB: `SELECT * FROM appointments WHERE date = CURRENT_DATE + 1 AND status IN ('scheduled', 'pre_confirmed')`
   - Check `x-n8n-secret` is correct

3. **401 Unauthorized**:
   - Verify `N8N_WEBHOOK_SECRET` env var in both n8n and Vercel
   - Verify header name is exactly `x-n8n-secret` (lowercase, with hyphen)

4. **Events processed but WhatsApp not sent**:
   - This is an n8n issue (backend side is working)
   - Check n8n's WhatsApp Business node configuration
   - Check n8n's webhook receiver is listening on `N8N_WEBHOOK_BASE_URL`

---

**End of Contract**
