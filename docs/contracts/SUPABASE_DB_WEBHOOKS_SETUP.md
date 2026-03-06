# Supabase Database Webhooks — Setup Guide

This guide documents how to configure the 2 Supabase Database Webhooks that replace the old outbox pattern (whatsapp_events/workflows tables + triggers).

## Architecture

```
appointments / appointment_requests table
        │  INSERT or UPDATE
        ▼
Supabase DB Webhook
        │  HTTP POST (real-time)
        ▼
n8n Webhook Node  →  Switch (event type)  →  WhatsApp API
```

The n8n workflow receives the full row data (`record` + `old_record`) directly from Supabase whenever a relevant change occurs. No intermediate tables or polling required.

---

## Webhook 1: `appointments`

### Purpose
Triggers WhatsApp automations when appointments are created, confirmed, cancelled, completed, or marked as no-show.

### Configuration (Supabase Dashboard)

1. Go to **Database → Webhooks** in the Supabase Dashboard
2. Click **Create a new webhook**
3. Fill in:
   - **Name**: `appointments_to_n8n`
   - **Table**: `appointments`
   - **Events**: `INSERT`, `UPDATE`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://<your-n8n-instance>/webhook/<webhook-id>`
   - **Headers**:
     - `Content-Type`: `application/json`
     - `Authorization`: `Bearer <shared-secret>` (optional, for security)

### Payload Structure (sent automatically by Supabase)

```json
{
  "type": "INSERT",
  "table": "appointments",
  "schema": "public",
  "record": {
    "id": "uuid",
    "patient_id": "uuid",
    "professional_id": "uuid",
    "specialty_id": "uuid",
    "consultation_type_id": "uuid",
    "date": "2026-02-10",
    "time": "14:00",
    "duration": 30,
    "status": "confirmed",
    "notes": "...",
    "final_notes": null,
    "finalized_at": null,
    "cancellation_reason": null,
    "created_at": "2026-02-04T10:00:00Z",
    "updated_at": "2026-02-04T10:00:00Z"
  },
  "old_record": null
}
```

For `UPDATE` events, `old_record` contains the previous row values.

### n8n Logic (Switch Node)

| Condition | Automation |
|-----------|------------|
| `type == INSERT` and `record.status == confirmed` | AUT-1: New appointment notification (one-way, no action links) |
| `type == UPDATE` and `old_record.status != cancelled` and `record.status == cancelled` | AUT-5: Cancellation WhatsApp |
| `type == UPDATE` and `old_record.status != no_show` and `record.status == no_show` | AUT-3: Reschedule prompt |
| `type == UPDATE` and `old_record.finalized_at == null` and `record.finalized_at != null` | AUT-6: Review request (2h delay in n8n) |

### 24h Reminder (AUT-2)

This is NOT triggered by a webhook. Instead, n8n runs a **daily CRON** (e.g., at 08:00) that queries:

```sql
SELECT * FROM appointments
WHERE date = CURRENT_DATE + interval '1 day'
  AND status = 'confirmed'
```

n8n sends a **one-way reminder** WhatsApp for each matching appointment. No action links or confirmation buttons — the message is purely informational.

---

## Webhook 2: `appointment_requests`

### Purpose
Optionally notify n8n when appointment requests change status (e.g., approved, rejected).

### Configuration (Supabase Dashboard)

1. Go to **Database → Webhooks**
2. Click **Create a new webhook**
3. Fill in:
   - **Name**: `appointment_requests_to_n8n`
   - **Table**: `appointment_requests`
   - **Events**: `UPDATE`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://<your-n8n-instance>/webhook/<webhook-id>`
   - **Headers**: same as Webhook 1

### Payload Structure

```json
{
  "type": "UPDATE",
  "table": "appointment_requests",
  "schema": "public",
  "record": {
    "id": "uuid",
    "patient_name": "João Silva",
    "patient_phone": "+351912345678",
    "patient_email": "joao@example.com",
    "specialty_id": "uuid",
    "preferred_date": "2026-02-15",
    "preferred_time": "morning",
    "status": "approved",
    "notes": "..."
  },
  "old_record": {
    "status": "pending"
  }
}
```

### n8n Logic

| Condition | Action |
|-----------|--------|
| `old_record.status == pending` and `record.status == rejected` | AUT-4: Rejection notification WhatsApp |

---

## Patient Data Lookup

Webhook payloads contain IDs (`patient_id`, `professional_id`, etc.), not full names/phones. To compose WhatsApp messages, n8n should:

1. Use a **Supabase Node** or **HTTP Request** to fetch patient details:
   ```
   GET /rest/v1/patients?id=eq.<patient_id>&select=name,phone,email
   ```

2. Similarly for professional name:
   ```
   GET /rest/v1/professionals?id=eq.<professional_id>&select=name
   ```

3. And specialty/consultation type names if needed.

This is a simple lookup that n8n handles natively with the Supabase integration node.

---

## Security

- Use a shared secret in the `Authorization` header to authenticate webhook calls
- n8n should validate this header before processing
- Supabase DB Webhooks run with the database's permissions (SECURITY DEFINER)

---

## Removed (Legacy)

The following have been removed and should NOT be recreated:

- `whatsapp_events` table (outbox)
- `whatsapp_workflows` table (workflow tracking)
- `trigger_pre_confirmation()` function
- `trigger_no_show()` function
- `trigger_review()` function
- `create_whatsapp_event()` function
- `/api/n8n/process-events` endpoint
- `/api/n8n/create-24h-confirmations` endpoint
- `/api/internal` endpoint
