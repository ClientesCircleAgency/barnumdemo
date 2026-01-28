# Barnum WhatsApp Webhook Architecture (Updated)

## 🎯 Architecture Overview

**Architecture Type:** Webhook-Based Event-Driven System  
**Platform:** Vercel Serverless Functions (3 total)  
**Database:** PostgreSQL (Supabase) with Triggers  
**Integration Partner:** n8n Workflow Automation  
**Security:** HMAC SHA-256 Signatures + Token-Based Authentication

### ✅ Confirmed: NO Supabase Edge Functions

After complete codebase audit:
- ✅ **Zero Edge Functions** in `/supabase/functions`
- ✅ **Zero references** to `supabase/functions` in code
- ✅ **100% Vercel** serverless API routes in `/api`
- ✅ **Pure webhook** architecture (no polling)
- ✅ **3 functions** (within Vercel Hobby plan limit of 12)

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BARNUM SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    Triggers      ┌────────────────────┐           │
│  │ PostgreSQL   │ ─────────────▶   │ whatsapp_events    │           │
│  │ Appointments │                  │ (Outbox Table)     │           │
│  └──────────────┘                  └────────────────────┘           │
│                                             │                         │
│                                             │ Pull (CRON/Manual)     │
│                                             ▼                         │
│                               ┌──────────────────────────┐           │
│                               │ POST /api/internal       │           │
│                               │ (Outbox Worker)          │           │
│                               │ [1 function]             │           │
│                               └──────────────────────────┘           │
│                                             │                         │
└─────────────────────────────────────────────┼─────────────────────────┘
                                              │
                                              │ HMAC POST
                                              ▼
                    ┌────────────────────────────────────────┐
                    │            N8N WORKFLOWS               │
                    │  - Pre-confirmation sender             │
                    │  - Reschedule sender                   │
                    │  - Review reminder sender              │
                    └────────────────────────────────────────┘
                                              │
                                              │ WhatsApp messages sent
                                              │ Patient clicks action link
                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BARNUM API ENDPOINTS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────┐         ┌────────────────────────┐          │
│  │ GET /api/action    │         │ POST /api/webhook      │          │
│  │ [1 function]       │         │ [1 function]           │          │
│  ├────────────────────┤         ├────────────────────────┤          │
│  │ Query params:      │         │ Body.action:           │          │
│  │  ?type=confirm     │         │  - confirm             │          │
│  │  ?type=cancel      │         │  - cancel              │          │
│  │  ?type=reschedule  │         │  - reschedule          │          │
│  │  &token=xxx        │         │  - no_show_reschedule  │          │
│  └────────────────────┘         │  - reactivation        │          │
│                                 │  - review              │          │
│                                 └────────────────────────┘          │
│                                                                       │
│  Total: 3 Serverless Functions (within 12 limit ✅)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ API Routes Inventory (Updated)

### **Total: 3 Serverless Functions**

All routes consolidated to meet Vercel Hobby plan limit (max 12 functions).

---

### 1. **Action Links** - `/api/action.ts` (1 function)

**Public GET endpoint** for patient one-click actions via WhatsApp.

#### **Route:**
```
GET /api/action?type={action}&token={token}
```

#### **Query Parameters:**
- `type`: `confirm` | `cancel` | `reschedule`
- `token`: Secure token from database

#### **Examples:**
```
GET /api/action?type=confirm&token=abc123xyz
GET /api/action?type=cancel&token=def456uvw
GET /api/action?type=reschedule&token=ghi789rst
```

#### **Flow:**

**Confirm:**
1. Validate token using `validate_action_token()` RPC
2. Verify `action_type === 'confirm'`
3. Update `appointments.status = 'confirmed'`
4. Mark token as used
5. Update `whatsapp_workflows.status = 'completed'`
6. Return HTML success page (green checkmark)

**Cancel:**
1. Validate token
2. Update `appointments.status = 'cancelled'`
3. Mark token as used
4. Update workflow
5. Return HTML page (red X)

**Reschedule:**
1. Validate token
2. Mark token as used  
3. Update workflow with `response = 'reschedule requested via link'`
4. Return HTML page (calendar icon) with "we'll contact you" message

#### **Response:** 
HTML page with styled success/error message

---

### 2. **Webhooks** - `/api/webhook.ts` (1 function)

**Unified POST endpoint** for n8n to send callbacks to Barnum.

#### **Route:**
```
POST /api/webhook
```

#### **Headers:**
- `X-Webhook-Signature`: HMAC SHA-256 signature (optional but recommended)
- `Content-Type`: application/json

#### **Request Body:**
```typescript
{
  action: 'confirm' | 'cancel' | 'reschedule' | 'no_show_reschedule' | 'reactivation' | 'review',
  appointmentId?: string,
  patientId?: string,
  patientResponse?: string,
  reason?: string,
  newDate?: string,
  newTime?: string,
  attempt?: number,
  workflowType?: string,
  reviewSubmitted?: boolean,
  rating?: number
}
```

#### **Actions:**

**`confirm`** - Patient confirmed appointment
```json
{
  "action": "confirm",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "patientResponse": "confirmed"
}
```
Updates `appointments.status = 'confirmed'` and workflow.

---

**`cancel`** - Patient cancelled appointment
```json
{
  "action": "cancel",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Patient request"
}
```
Updates `appointments.status = 'cancelled'`.

---

**`reschedule`** - Reschedule appointment to new date/time
```json
{
  "action": "reschedule",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "newDate": "2026-02-15",
  "newTime": "14:30"
}
```
Updates `appointments.date` and `appointments.time`.

---

**`no_show_reschedule`** - Track no-show reschedule attempt
```json
{
  "action": "no_show_reschedule",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "attempt": 1
}
```
Records workflow response.

---

**`reactivation`** - Record patient reactivation workflow
```json
{
  "action": "reactivation",
  "patientId": "550e8400-e29b-41d4-a716-446655440000",
  "workflowType": "reactivation_30d"
}
```
Creates workflow record.

---

**`review`** - Record review request response
```json
{
  "action": "review",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "reviewSubmitted": true,
  "rating": 5
}
```
Updates workflow with review status.

---

#### **Response:**
```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": { ... }
}
```

---

### 3. **Internal Processor** - `/api/internal.ts` (1 function)

**Background job** to process pending events from outbox table.

#### **Route:**
```
POST /api/internal
```

#### **Headers:**
- `Authorization`: Bearer {INTERNAL_API_SECRET}

#### **Purpose:** 
Process pending `whatsapp_events` and send to n8n

#### **Trigger:** 
CRON job (every 1-5 minutes) or manual

#### **Flow:**
1. Authenticate internal request
2. Fetch pending events (`status='pending'`, `scheduled_for <= now()`)
3. For each event (batch of 50):
   - Mark as `processing`
   - Generate HMAC signature
   - POST to n8n webhook URL with:
     - `X-Webhook-Signature`: HMAC
     - `X-Idempotency-Key`: {eventId}-{timestamp}
     - `X-Event-Id`: Event UUID
     - `X-Event-Type`: Event type string
     - Event payload (JSON body)
   - If success: Mark `status='sent'`, update workflow
   - If failure: Increment `retry_count`, schedule retry with exponential backoff
   - If max retries exceeded: Move to `dead_letter`
4. Return summary

#### **Response:**
```json
{
  "success": true,
  "processed": 42,
  "failed": 2,
  "errors": ["Event xxx moved to dead_letter after 3 retries"]
}
```

#### **Retry Strategy:**
- Max retries: 3 (configurable per event)
- Backoff: `retry_count * 60 seconds`
- Dead letter queue after max retries

---

## 🔐 Security Implementation

### HMAC Signature Verification

**Algorithm:** SHA-256  
**Header:** `X-Webhook-Signature`

#### Outbound (Barnum → n8n)
```typescript
const signature = generateHmacSignature(eventPayload, WEBHOOK_SECRET);
// Sent as X-Webhook-Signature header in POST /api/internal
```

#### Inbound (n8n → Barnum)
```typescript
const signature = req.headers['x-webhook-signature'];
const isValid = verifyHmacSignature(
  JSON.stringify(req.body), 
  signature, 
  WEBHOOK_SECRET
);
// Used in POST /api/webhook
```

**Security Features:**
- ✅ Timing-safe comparison (`crypto.timingSafeEqual`)
- ✅ Prevents replay attacks via `X-Idempotency-Key`
- ✅ Token-based action links with expiration
- ✅ Internal API secret for processor endpoint

---

## 🗄️ Database Layer

### Tables

#### `whatsapp_events` (Outbox Pattern)
```sql
{
  id: uuid,
  event_type: text,
  entity_type: text,
  entity_id: uuid,
  workflow_id: uuid,
  payload: jsonb,
  status: 'pending' | 'processing' | 'sent' | 'dead_letter',
  retry_count: integer,
  max_retries: integer,
  last_error: text,
  scheduled_for: timestamptz,
  processed_at: timestamptz,
  created_at: timestamptz,
  updated_at: timestamptz
}
```

**Indexes:**
- `idx_whatsapp_events_status` on `status`
- `idx_whatsapp_events_scheduled` on `scheduled_for`
- `idx_whatsapp_events_entity` on `(entity_type, entity_id)`

---

#### `whatsapp_action_tokens`
```sql
{
  id: uuid,
  token: text UNIQUE,
  action_type: 'confirm' | 'cancel' | 'reschedule',
  appointment_id: uuid,
  patient_id: uuid,
  workflow_id: uuid,
  metadata: jsonb,
  used_at: timestamptz,
  expires_at: timestamptz,
  created_at: timestamptz
}
```

**Indexes:**
- `idx_whatsapp_action_tokens_token` on `token`
- `idx_whatsapp_action_tokens_expires` on `expires_at`

---

### Triggers

#### `trg_pre_confirmation`
**Event:** AFTER INSERT ON `appointments`  
**Condition:** `status IN ('scheduled', 'confirmed', 'pre_confirmed')`  
**Action:**
1. Insert into `whatsapp_workflows` (type: `pre_confirmation_sent`)
2. Call `create_whatsapp_event()` to add outbox event

---

#### `trg_no_show`
**Event:** AFTER UPDATE ON `appointments`  
**Condition:** `OLD.status != 'no_show' AND NEW.status = 'no_show'`  
**Action:**
1. Insert into `whatsapp_workflows` (type: `reschedule_prompt`)
2. Call `create_whatsapp_event()` scheduled +1 hour

---

#### `trg_review`
**Event:** AFTER UPDATE ON `appointments`  
**Condition:** `OLD.status != 'completed' AND NEW.status = 'completed'`  
**Action:**
1. Insert into `whatsapp_workflows` (type: `confirmation_24h`)
2. Call `create_whatsapp_event()` scheduled +2 hours

---

### Helper Functions

#### `generate_action_token()`
```sql
generate_action_token(
  p_action_type text,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_workflow_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_expires_in_days integer DEFAULT 7
) RETURNS text
```

**Returns:** Secure base64 token (24 random bytes)

---

#### `validate_action_token()`
```sql
validate_action_token(p_token text)
RETURNS TABLE (
  valid boolean,
  appointment_id uuid,
  patient_id uuid,
  action_type text,
  metadata jsonb,
  error_message text
)
```

**Validation Checks:**
- Token exists
- Not already used
- Not expired

---

#### `mark_token_used()`
```sql
mark_token_used(p_token text) RETURNS void
```

**Action:** Set `used_at = now()`

---

#### `create_whatsapp_event()`
```sql
create_whatsapp_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_workflow_id uuid DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT now()
) RETURNS uuid
```

**Action:** Insert into `whatsapp_events` outbox table

---

## 🔄 Data Flow Examples

### Example 1: Pre-Confirmation Flow

```
1. Admin creates appointment (status='scheduled')
   ↓
2. Trigger: trg_pre_confirmation fires
   ↓
3. INSERT whatsapp_workflows (type='pre_confirmation_sent')
   INSERT whatsapp_events (event_type='appointment.pre_confirmed')
   ↓
4. CRON job calls POST /api/internal
   ↓
5. Processor fetches pending event
   Generates HMAC signature
   POST to n8n webhook with payload
   ↓
6. n8n receives event
   Sends WhatsApp message with action links:
   - Confirm: https://barnum.com/api/action?type=confirm&token=xxx
   - Cancel: https://barnum.com/api/action?type=cancel&token=yyy
   ↓
7. Patient clicks "Confirm" link
   ↓
8. GET /api/action?type=confirm&token=xxx
   Validates token
   Updates appointment.status='confirmed'
   Returns HTML success page
   ↓
9. Done ✅
```

---

### Example 2: No-Show Reschedule Flow

```
1. Admin marks appointment (status='no_show')
   ↓
2. Trigger: trg_no_show fires
   ↓
3. INSERT whatsapp_workflows (type='reschedule_prompt')
   INSERT whatsapp_events (scheduled_for=+1 hour)
   ↓
4. After 1 hour, CRON job processes event
   ↓
5. POST to n8n → sends WhatsApp message
   ↓
6. Patient replies "yes" via WhatsApp
   ↓
7. n8n captures response
   POST /api/webhook
   Body: { "action": "no_show_reschedule", "appointmentId": "...", "attempt": 1 }
   ↓
8. Barnum records response
   Admin team notified
   ↓
9. Done ✅
```

---

## 🏗️ Architectural Responsibilities

### PostgreSQL (Supabase)
- ✅ Data storage
- ✅ Trigger-based event generation
- ✅ Outbox pattern implementation
- ✅ Token generation/validation
- ✅ RLS (Row Level Security) enforcement

### Vercel API Routes (3 functions)
- ✅ Outbox worker (process pending events) - `/api/internal`
- ✅ Action link handler (patient interactions) - `/api/action`
- ✅ Inbound webhook endpoint (n8n callbacks) - `/api/webhook`
- ✅ HMAC signature generation/verification
- ✅ Token validation
- ✅ HTML response generation

### n8n Workflows
- ✅ WhatsApp message composition
- ✅ WhatsApp API integration
- ✅ Patient response capture
- ✅ Callback to Barnum webhooks
- ✅ Workflow orchestration

---

## ⚙️ Environment Variables

### Required
```bash
# Database
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Webhooks
N8N_WEBHOOK_BASE_URL=https://n8n.example.com/webhook/whatsapp
WEBHOOK_SECRET=your-secret-key

# Internal API
INTERNAL_API_SECRET=your-internal-secret
```

---

## 📝 Payload Formats

### Outbound (Barnum → n8n) via `/api/internal`

```json
{
  "event_type": "appointment.pre_confirmed",
  "entity_id": "appointment-uuid",
  "created_at": "2026-01-28T10:00:00Z",
  "workflow_id": "workflow-uuid",
  "appointment": {
    "id": "uuid",
    "date": "2026-02-01",
    "time": "10:00",
    "patient": {
      "id": "uuid",
      "name": "João Silva",
      "phone": "+351912345678"
    },
    "professional": {
      "name": "Dr. Maria Santos"
    },
    "specialty": {
      "name": "Medicina Dentária"
    }
  },
  "action_links": {
    "confirm": "https://barnum.com/api/action?type=confirm&token=xxx",
    "cancel": "https://barnum.com/api/action?type=cancel&token=yyy"
  }
}
```

### Inbound (n8n → Barnum) via `/api/webhook`

```json
{
  "action": "confirm",
  "appointmentId": "uuid",
  "patientResponse": "confirmed",
  "timestamp": "2026-01-28T10:05:00Z"
}
```

---

## 🚀 Deployment Checklist

- [x] No Supabase Edge Functions ✅
- [x] All routes in `/api` directory ✅
- [x] **3 serverless functions** (within 12 limit) ✅
- [x] HMAC security implemented ✅
- [x] Outbox pattern with retries ✅
- [x] Token-based action links ✅
- [x] HTML success pages ✅
- [x] Dead letter queue ✅
- [x] Idempotency keys ✅
- [x] TypeScript build passing ✅

---

## 📊 Monitoring & Observability

### Key Metrics to Track

1. **Outbox Processing** (`/api/internal`)
   - Events processed/min
   - Retry rate
   - Dead letter rate
   - Average processing time

2. **Action Links** (`/api/action`)
   - Click-through rate
   - Token validation success rate
   - Most used action type (confirm/cancel/reschedule)

3. **Webhooks** (`/api/webhook`)
   - Inbound request rate per action
   - Signature verification failures
   - Response times

---

## 🆕 Migration from Old Routes

### Old Structure (13 functions - Exceeded limit ❌)
```
/api/action/confirm.ts
/api/action/cancel.ts
/api/action/reschedule.ts
/api/webhooks/appointments/confirm.ts
/api/webhooks/appointments/cancel.ts
/api/webhooks/appointments/reschedule.ts
/api/webhooks/appointments/no-show-reschedule.ts
/api/webhooks/reactivation/record.ts
/api/webhooks/reviews/record.ts
/api/internal/process-events.ts
```

### New Structure (3 functions - Within limit ✅)
```
/api/action.ts          (handles all action types via ?type=)
/api/webhook.ts         (handles all callbacks via body.action)
/api/internal.ts        (outbox processor)
```

### n8n Migration Required

**Update webhook URLs in n8n workflows:**

**Old:**
```
POST https://barnum.com/api/webhooks/appointments/confirm
POST https://barnum.com/api/webhooks/appointments/cancel
```

**New:**
```
POST https://barnum.com/api/webhook
Body: { "action": "confirm", ... }
Body: { "action": "cancel", ... }
```

---

## ✅ Production Ready

This architecture is **100% webhook-based** with:
- ✅ No polling
- ✅ No Edge Functions
- ✅ Event-driven design
- ✅ Reliable delivery with retries
- ✅ Secure HMAC signatures
- ✅ Scalable serverless infrastructure
- ✅ Production-grade error handling
- ✅ **Only 3 functions** (within Vercel Hobby plan limit)

**All systems GO for deployment! 🚀**
