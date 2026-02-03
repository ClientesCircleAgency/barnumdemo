# VERCEL_API_CONTRACT.md

**Generated From:** Codebase Analysis  
**Purpose:** Document Vercel Serverless API routes and their database interactions  
**Source:** `/api/*.ts` files

---

## ROUTE: `/api/action`

**File:** `api/action.ts`  
**Purpose:** Handle public action links (confirm, cancel, reschedule) from WhatsApp messages  
**Method:** `GET`  
**Auth:** None (uses token validation)

### Query Parameters
```typescript
{
  action: 'confirm' | 'cancel' | 'reschedule';
  token: string; // Action token UUID
}
```

### Request Headers
None required

### Response Codes
- `200` - Action processed successfully (with HTML response)
- `400` - Invalid action or token missing
- `401` - Token expired or invalid
- `500` - Server error

### Response Format
**Content-Type:** `text/html`  
Returns HTML page with status message

### Database Tables Accessed

#### 1. RPC Call: `validate_action_token`
**File:** `api/action.ts:40-41`
```typescript
const { data: validation, error } = await supabaseAdmin.rpc('validate_action_token', {
  token_id: token,
});
```
**Expected Return:**
```typescript
{
  appointment_id: string; // UUID
  action_type: string; // 'confirm' | 'cancel' | 'reschedule'
  phone: string;
  patient_name: string;
}
```

#### 2. Table: `appointments`
**Operations:** SELECT, UPDATE

**SELECT - Get appointment details** (lines 80-81):
```typescript
.from('appointments')
.select('*, patients(*)')
.eq('id', validation.appointment_id)
.single()
```

**UPDATE - Confirm appointment** (lines 88-94):
```typescript
.from('appointments')
.update({
  status: 'confirmed',
  notes: notes ? `${existingNotes}\n[Auto-confirmado via WhatsApp]` : '[Auto-confirmado via WhatsApp]',
})
.eq('id', validation.appointment_id)
.select()
.single()
```

**UPDATE - Cancel appointment** (lines 121-123):
```typescript
.from('appointments')
.update({ status: 'cancelled' })
.eq('id', validation.appointment_id)
.select()
.single()
```

#### 3. Table: `whatsapp_workflows`
**Operations:** UPDATE

**UPDATE - Mark workflow complete (confirm/cancel)** (lines 95-101, 124-130):
```typescript
.from('whatsapp_workflows')
.update({
  status: 'completed', // 🔴 POTENTIAL MISMATCH with schema CHECK constraint
  response: action,
  responded_at: new Date().toISOString(),
})
.eq('appointment_id', validation.appointment_id)
```

#### 4. Table: `whatsapp_action_tokens`
**Operations:** UPDATE

**UPDATE - Mark token as used** (lines 235-236):
```typescript
.from('whatsapp_action_tokens')
.update({ used_at: new Date().toISOString() })
.eq('id', token)
```

### Status Values Used
- **appointments.status:** `'confirmed'`, `'cancelled'`
- **whatsapp_workflows.status:** `'completed'` 🔴

### Error Patterns
```typescript
// Line 56: Token missing
return new Response('Token inválido', { status: 400 });

// Line 60: Token expired/invalid
return new Response('Token expirado ou inválido', { status: 401 });

// Line 239: Generic error
return new Response('Erro ao processar ação', { status: 500 });
```

---

## ROUTE: `/api/webhook`

**File:** `api/webhook.ts`  
**Purpose:** Receive callbacks/events from WhatsApp provider via n8n  
**Method:** `POST`  
**Auth:** HMAC signature validation

### Request Headers
```typescript
{
  'x-signature': string; // HMAC-SHA256 signature
  'content-type': 'application/json';
}
```

### HMAC Validation
**File:** `api/webhook.ts:45-81`
```typescript
const signature = req.headers['x-signature'];
const rawBody = await req.text();
const expectedSignature = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET!)
  .update(rawBody)
  .digest('hex');
```

### Request Body Schema
```typescript
{
  action: 'confirm' | 'cancel' | 'reschedule' | 'review' | 'no_show_reschedule' | 'reactivation';
  payload: {
    phone: string;
    appointmentId?: string; // UUID
    patientId?: string; // UUID
    response?: string;
    workflowType?: string; // See workflow types below
    messagePayload?: any; // JSON
  };
}
```

### Response Codes
- `200` - Webhook processed successfully
- `401` - Invalid signature
- `400` - Invalid action or payload
- `500` - Server error

### Response Format
**Content-Type:** `application/json`
```typescript
{ success: true }
// or
{ error: string }
```

### Database Tables Accessed

#### 1. Table: `appointments`
**Operations:** SELECT, UPDATE

**SELECT - Get appointment** (lines 104-105):
```typescript
.from('appointments')
.select('*')
.eq('id', payload.appointmentId)
.single()
```

**UPDATE - Confirm appointment** (lines 112-115):
```typescript
.from('appointments')
.update({
  status: 'pre_confirmed',
  notes: notes ? `${notes}\n[Confirmado via WhatsApp]` : '[Confirmado via WhatsApp]',
})
.eq('id', payload.appointmentId)
```

**UPDATE - Cancel appointment** (lines 149-150):
```typescript
.from('appointments')
.update({ status: 'cancelled' })
.eq('id', payload.appointmentId)
```

#### 2. Table: `whatsapp_workflows`
**Operations:** UPDATE, INSERT

**UPDATE - Mark workflow complete (confirm)** (lines 123-129):
```typescript
.from('whatsapp_workflows')
.update({
  status: 'completed', // 🔴 POTENTIAL MISMATCH
  response: payload.response || 'confirmed',
  responded_at: new Date().toISOString(),
})
.eq('appointment_id', payload.appointmentId)
```

**UPDATE - Mark workflow complete (cancel)** (lines 157-163):
```typescript
.from('whatsapp_workflows')
.update({
  status: 'completed', // 🔴 POTENTIAL MISMATCH
  response: payload.response || 'cancelled',
  responded_at: new Date().toISOString(),
})
.eq('appointment_id', payload.appointmentId)
```

**INSERT - Create new workflow (reactivation)** (lines 236-246):
```typescript
.from('whatsapp_workflows')
.insert({
  patient_id: payload.patientId,
  phone: payload.phone,
  workflow_type: payload.workflowType || 'reactivation', // 🟡 Undocumented type
  scheduled_at: new Date().toISOString(),
  message_payload: payload.messagePayload,
})
.select()
.single()
```

**UPDATE - Cancel pending workflows (reschedule)** (lines 187-190):
```typescript
.from('whatsapp_workflows')
.update({ status: 'cancelled' })
.eq('workflow_type', 'reschedule_prompt') // 🟡 Undocumented type
.eq('phone', payload.phone)
```

#### 3. Table: `whatsapp_events`
**Operations:** INSERT

**INSERT - Create workflow event (reschedule, no_show_reschedule)** (lines 201-211, 261-271):
```typescript
.from('whatsapp_events')
.insert({
  event_type: 'WORKFLOW_TRIGGER',
  entity_type: 'whatsapp_workflow',
  entity_id: workflow.id,
  payload: {
    workflow_id: workflow.id,
    phone: payload.phone,
    workflow_type: 'availability_suggestion',
    message_template: 'AVAILABILITY_REQUEST',
  },
})
```

### Workflow Types Referenced
**Documented:**
- `'confirmation_24h'`
- `'review_reminder'`
- `'availability_suggestion'`

**Undocumented (used in code):**
- `'reactivation'` (line 241) 🟡
- `'reschedule_prompt'` (line 187) 🟡

### Status Values Used
- **appointments.status:** `'pre_confirmed'`, `'cancelled'`
- **whatsapp_workflows.status:** `'completed'` 🔴, `'cancelled'`

### Error Patterns
```typescript
// Line 77: Invalid signature
return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });

// Line 91: Invalid action
return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

// Line 282: Generic error
return new Response(JSON.stringify({ error: error.message }), { status: 500 });
```

---

## ROUTE: `/api/internal`

**File:** `api/internal.ts`  
**Purpose:** Process pending `whatsapp_events` and send to n8n webhook  
**Method:** `POST`  
**Auth:** Basic auth via header

### Request Headers
```typescript
{
  'Authorization': string; // Must match process.env.INTERNAL_API_SECRET
  'Content-Type': 'application/json';
}
```

### Request Body Schema
```typescript
{
  idempotencyKey?: string; // Optional UUID for idempotency
}
```
**Note:** `X-Idempotency-Key` header also accepted (line 21)

### Response Codes
- `200` - Events processed successfully
- `401` - Unauthorized (invalid API secret)
- `500` - Server error

### Response Format
**Content-Type:** `application/json`
```typescript
{
  processed: number; // Count of events processed
  failed: number; // Count of failed events
  details: Array<{
    event_id: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}
```

### Database Tables Accessed

#### 1. Table: `whatsapp_events`
**Operations:** SELECT, UPDATE

**SELECT - Get pending events** (lines 59-63):
```typescript
.from('whatsapp_events')
.select('*')
.eq('status', 'pending')
.order('created_at', { ascending: true })
.limit(50)
```

**UPDATE - Mark as processing** (lines 73-76):
```typescript
.from('whatsapp_events')
.update({
  status: 'processing',
  processed_at: new Date().toISOString(),
})
.eq('id', event.id)
```

**UPDATE - Mark as sent** (lines 115-120):
```typescript
.from('whatsapp_events')
.update({
  status: 'sent',
  sent_at: new Date().toISOString(),
  attempts: event.attempts + 1,
})
.eq('id', event.id)
```

**UPDATE - Mark as dead letter** (lines 142-147):
```typescript
.from('whatsapp_events')
.update({
  status: 'dead_letter',
  error_message: errorMessage,
  attempts: event.attempts + 1,
})
.eq('id', event.id)
```

#### 2. Table: `whatsapp_workflows`
**Operations:** UPDATE

**UPDATE - Mark workflow as sent** (lines 124-127):
```typescript
.from('whatsapp_workflows')
.update({
  status: 'sent',
  sent_at: new Date().toISOString(),
})
.eq('id', eventPayload.workflow_id)
```

### External API Call: n8n Webhook
**Endpoint:** `${process.env.N8N_WEBHOOK_BASE_URL}/webhook/whatsapp`  
**Method:** `POST`  
**Payload:**
```typescript
{
  event_id: string; // UUID
  event_type: string; // e.g., 'WORKFLOW_TRIGGER'
  entity_type: string; // e.g., 'whatsapp_workflow'
  entity_id: string; // UUID
  payload: any; // JSON from whatsapp_events.payload
}
```

### Event Status Lifecycle
```
pending → processing → sent
                    ↓
                dead_letter (after 3+ attempts)
```

### Error Patterns
```typescript
// Line 37: Unauthorized
return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

// Line 194: Generic error
return new Response(JSON.stringify({ error: error.message }), { status: 500 });
```

---

## ENVIRONMENT VARIABLES REQUIRED

### `/api/action.ts`
```typescript
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### `/api/webhook.ts`
```typescript
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WEBHOOK_SECRET // For HMAC validation
```

### `/api/internal.ts`
```typescript
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
INTERNAL_API_SECRET // For authorization
N8N_WEBHOOK_BASE_URL // e.g., 'https://n8n.example.com'
```

---

## SUPABASE CLIENT INITIALIZATION

All routes use **service role key** (admin access):

```typescript
// Example from action.ts:12-15
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

---

## CRITICAL MISMATCHES DETECTED

### 🔴 Status Value Conflict
**Files:** `api/action.ts`, `api/webhook.ts`  
**Issue:** Code updates `whatsapp_workflows.status` to `'completed'`  
**Frontend types expect:**  `'pending' | 'sent' | 'delivered' | 'responded' | 'expired' | 'cancelled'`  
**Impact:** If database has CHECK constraint, these updates will fail

**Code references:**
- `api/action.ts:95` - Confirm action
- `api/action.ts:124` - Cancel action
- `api/webhook.ts:123` - Webhook confirm
- `api/webhook.ts:157` - Webhook cancel

### 🟡 Undocumented Workflow Types
**Files:** `api/webhook.ts`  
**Issue:** Code uses workflow types not in frontend interface or n8n guide  
**Undocumented types:**
- `'reactivation'` (line 241)
- `'reschedule_prompt'` (line 187)

**Documented types (from frontend):**
- `'confirmation_24h'`
- `'review_reminder'`
- `'availability_suggestion'`

---

## RPC FUNCTIONS CALLED

### `validate_action_token`
**File:** `api/action.ts:40-41`  
**Args:**
```typescript
{ token_id: string } // UUID
```
**Returns:**
```typescript
{
  appointment_id: string;
  action_type: string;
  phone: string;
  patient_name: string;
} | null
```

---

## SUMMARY TABLE

| Route | Method | Auth | Tables Modified | External APIs | Purpose |
|-------|--------|------|----------------|---------------|---------|
| `/api/action` | GET | Token | `appointments`, `whatsapp_workflows`, `whatsapp_action_tokens` | None | Public action links |
| `/api/webhook` | POST | HMAC | `appointments`, `whatsapp_workflows`, `whatsapp_events` | None | n8n callbacks |
| `/api/internal` | POST | Bearer | `whatsapp_events`, `whatsapp_workflows` | n8n webhook | Event processor |

---

**END OF DOCUMENT**
