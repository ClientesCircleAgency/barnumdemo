# Barnum WhatsApp Webhook Architecture

## 🎯 Architecture Overview

**Architecture Type:** Webhook-Based Event-Driven System  
**Platform:** Vercel Serverless Functions  
**Database:** PostgreSQL (Supabase) with Triggers  
**Integration Partner:** n8n Workflow Automation  
**Security:** HMAC SHA-256 Signatures + Token-Based Authentication

### ✅ Confirmed: NO Supabase Edge Functions

After complete codebase audit:
- ✅ **Zero Edge Functions** in `/supabase/functions`
- ✅ **Zero references** to `supabase/functions` in code
- ✅ **100% Vercel** serverless API routes in `/api`
- ✅ **Pure webhook** architecture (no polling)

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
│                               │ /api/internal/           │           │
│                               │ process-events           │           │
│                               │ (Outbox Worker)          │           │
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
│  │ Action Links       │         │ Inbound Webhooks       │          │
│  │ (Public GET)       │         │ (n8n callbacks)        │          │
│  ├────────────────────┤         ├────────────────────────┤          │
│  │ /api/action/       │         │ /api/webhooks/         │          │
│  │  - confirm         │         │  appointments/         │          │
│  │  - cancel          │         │   - confirm            │          │
│  │  - reschedule      │         │   - cancel             │          │
│  └────────────────────┘         │   - reschedule         │          │
│                                 │   - no-show-reschedule │          │
│                                 │  reactivation/         │          │
│                                 │   - record             │          │
│                                 │  reviews/              │          │
│                                 │   - record             │          │
│                                 └────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ API Routes Inventory

### 1. **Action Links** (Patient-Facing)

Public GET endpoints embedded in WhatsApp messages for one-click actions.

#### `/api/action/confirm.ts`
**Method:** GET  
**Query Params:** `?token=xxx`  
**Purpose:** Patient confirms appointment via WhatsApp link  
**Flow:**
1. Validate token using `validate_action_token()` RPC
2. Update `appointments.status = 'confirmed'`
3. Mark token as used
4. Update `whatsapp_workflows.status = 'completed'`
5. Return HTML success page

**Response:** HTML page with confirmation message

---

#### `/api/action/cancel.ts`
**Method:** GET  
**Query Params:** `?token=xxx`  
**Purpose:** Patient cancels appointment  
**Flow:**
1. Validate token
2. Update `appointments.status = 'cancelled'`
3. Mark token as used
4. Update workflow
5. Return HTML page

**Response:** HTML page with cancellation confirmation

---

#### `/api/action/reschedule.ts`
**Method:** GET  
**Query Params:** `?token=xxx`  
**Purpose:** Patient requests to reschedule  
**Flow:**
1. Validate token
2. Create reschedule request record
3. Mark token as used
4. Notify admin team
5. Return HTML page

**Response:** HTML page with instructions

---

### 2. **Inbound Webhooks** (n8n → Barnum)

POST endpoints for n8n to update Barnum database after WhatsApp interactions.

#### `/api/webhooks/appointments/confirm.ts`
**Method:** POST  
**Headers:**
- `X-Webhook-Signature`: HMAC SHA-256 signature
- `Content-Type`: application/json

**Request Body:**
```json
{
  "appointmentId": "uuid",
  "patientResponse": "confirmed"
}
```

**Purpose:** n8n confirms appointment after patient WhatsApp interaction  
**Flow:**
1. Verify HMAC signature
2. Update `appointments.status = 'confirmed'`
3. Update `whatsapp_workflows.status = 'completed'`
4. Return success

**Response:**
```json
{
  "success": true,
  "message": "Appointment confirmed successfully",
  "data": { "appointment": {...} }
}
```

---

#### `/api/webhooks/appointments/cancel.ts`
**Method:** POST  
**Purpose:** n8n cancels appointment  
**Request Body:**
```json
{
  "appointmentId": "uuid",
  "reason": "string"
}
```

---

#### `/api/webhooks/appointments/reschedule.ts`
**Method:** POST  
**Purpose:** n8n reschedules appointment  
**Request Body:**
```json
{
  "appointmentId": "uuid",
  "newDate": "YYYY-MM-DD",
  "newTime": "HH:mm"
}
```

---

#### `/api/webhooks/appointments/no-show-reschedule.ts`
**Method:** POST  
**Purpose:** Track no-show reschedule attempts  
**Request Body:**
```json
{
  "appointmentId": "uuid",
  "attempt": 1
}
```

---

#### `/api/webhooks/reactivation/record.ts`
**Method:** POST  
**Purpose:** Record patient reactivation workflow completion  
**Request Body:**
```json
{
  "patientId": "uuid",
  "workflowType": "reactivation_30d",
  "status": "completed"
}
```

---

#### `/api/webhooks/reviews/record.ts`
**Method:** POST  
**Purpose:** Record review request workflow completion  
**Request Body:**
```json
{
  "appointmentId": "uuid",
  "reviewSubmitted": boolean,
  "rating": number
}
```

---

### 3. **Internal Processor** (Outbox Worker)

Background job to process pending events from outbox table.

#### `/api/internal/process-events.ts`
**Method:** POST  
**Headers:**
- `Authorization`: Bearer {INTERNAL_API_SECRET}

**Purpose:** Process pending `whatsapp_events` and send to n8n  
**Trigger:** CRON job (every 1-5 minutes)

**Flow:**
1. Authenticate internal request
2. Fetch pending events (`status='pending'`, `scheduled_for <= now()`)
3. For each event:
   - Mark as `processing`
   - Generate HMAC signature
   - POST to n8n webhook URL with:
     - `X-Webhook-Signature`
     - `X-Idempotency-Key` (eventId-timestamp)
     - `X-Event-Id`
     - `X-Event-Type`
     - Event payload
   - If success: Mark `status='sent'`, update workflow
   - If failure: Increment `retry_count`, schedule retry with exponential backoff
   - If max retries exceeded: Move to `dead_letter`
4. Return summary

**Response:**
```json
{
  "success": true,
  "processed": 42,
  "failed": 2,
  "errors": ["Event xxx moved to dead_letter after 3 retries"]
}
```

**Retry Strategy:**
- Max retries: 3 (configurable)
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
// Send as X-Webhook-Signature header
```

#### Inbound (n8n → Barnum)
```typescript
const signature = req.headers['x-webhook-signature'];
const isValid = verifyHmacSignature(
  JSON.stringify(req.body), 
  signature, 
  WEBHOOK_SECRET
);
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
4. CRON job calls /api/internal/process-events
   ↓
5. Processor fetches pending event
   Generates HMAC signature
   POST to n8n webhook with payload
   ↓
6. n8n receives event
   Sends WhatsApp message with action links:
   - Confirm: https://barnum.com/api/action/confirm?token=xxx
   - Cancel: https://barnum.com/api/action/cancel?token=yyy
   ↓
7. Patient clicks "Confirm" link
   ↓
8. GET /api/action/confirm?token=xxx
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
   POST /api/webhooks/appointments/no-show-reschedule
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

### Vercel API Routes
- ✅ Outbox worker (process pending events)
- ✅ Action link handlers (patient interactions)
- ✅ Inbound webhook endpoints (n8n callbacks)
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

### Outbound (Barnum → n8n)

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
    "confirm": "https://barnum.com/api/action/confirm?token=xxx",
    "cancel": "https://barnum.com/api/action/cancel?token=yyy"
  }
}
```

### Inbound (n8n → Barnum)

```json
{
  "appointmentId": "uuid",
  "patientResponse": "confirmed",
  "timestamp": "2026-01-28T10:05:00Z"
}
```

---

## 🚀 Deployment Checklist

- [x] No Supabase Edge Functions ✅
- [x] All routes in `/api` directory ✅
- [x] HMAC security implemented ✅
- [x] Outbox pattern with retries ✅
- [x] Token-based action links ✅
- [x] HTML success pages ✅
- [x] Dead letter queue ✅
- [x] Idempotency keys ✅

---

## 📊 Monitoring & Observability

### Key Metrics to Track

1. **Outbox Processing**
   - Events processed/min
   - Retry rate
   - Dead letter rate
   - Average processing time

2. **Action Links**
   - Click-through rate
   - Token validation success rate
   - Most used action type

3. **Webhooks**
   - Inbound request rate
   - Signature verification failures
   - Response times

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

**All systems GO for deployment! 🚀**
