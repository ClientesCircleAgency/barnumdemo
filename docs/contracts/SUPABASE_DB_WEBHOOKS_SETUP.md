# Supabase Database Webhooks — Setup Guide

> **Versão:** 2.1 — 2026-02-04

Este guia documenta como configurar os 3 Supabase Database Webhooks que enviam eventos ao n8n em tempo real.

## Arquitetura

```
appointments / appointment_requests / appointment_suggestions
        │  INSERT ou UPDATE
        ▼
Supabase DB Webhook
        │  HTTP POST (real-time)
        ▼
n8n Webhook Node  →  Switch (tipo de evento)  →  WhatsApp API
```

O n8n recebe os dados completos da linha (`record` + `old_record`) diretamente do Supabase. Sem tabelas intermediárias, sem polling, sem endpoints backend.

---

## Webhook 1: `appointments`

### Objetivo
Aciona automações WhatsApp quando consultas são criadas, canceladas, marcadas como no-show, ou finalizadas.

### Configuração (Supabase Dashboard)

1. Ir a **Database → Webhooks** no Supabase Dashboard
2. Clicar **Create a new webhook**
3. Preencher:
   - **Name**: `appointments_to_n8n`
   - **Table**: `appointments`
   - **Events**: `INSERT`, `UPDATE`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://<instancia-n8n>/webhook/<webhook-id>`
   - **Headers**:
     - `Content-Type`: `application/json`
     - `Authorization`: `Bearer <DB_WEBHOOK_SECRET>`

### Payload (enviado automaticamente pelo Supabase)

```json
{
  "type": "INSERT",
  "table": "appointments",
  "schema": "public",
  "record": {
    "id": "uuid",
    "patient_id": "uuid",
    "professional_id": "uuid",
    "professional_name": "Dr. Tiago Calado",
    "specialty_id": "uuid",
    "consultation_type_id": "uuid",
    "date": "2026-02-10",
    "time": "14:00",
    "duration": 30,
    "status": "confirmed",
    "reason": "Check-up dentário",
    "notes": "...",
    "final_notes": null,
    "finalized_at": null,
    "cancellation_reason": null,
    "review_opt_out": false,
    "created_at": "2026-02-04T10:00:00Z",
    "updated_at": "2026-02-04T10:00:00Z"
  },
  "old_record": null
}
```

Para eventos `UPDATE`, `old_record` contém os valores anteriores da linha.

### Lógica n8n (Switch Node)

| Condição | Automação |
|----------|-----------|
| `type == INSERT` | AUT-1: Notificação de nova consulta (one-way) |
| `type == UPDATE` AND `old_record.status != cancelled` AND `record.status == cancelled` | AUT-5: Cancelamento |
| `type == UPDATE` AND `old_record.status != no_show` AND `record.status == no_show` | AUT-3: No-show |
| `type == UPDATE` AND `old_record.finalized_at == null` AND `record.finalized_at != null` AND `record.review_opt_out == false` | AUT-6: Review (2h delay no n8n) |

### Lembrete 24h (AUT-2)

NÃO é acionado por webhook. O n8n usa um **CRON diário** (ex: 08:00) que consulta:

```sql
SELECT * FROM appointments
WHERE date = CURRENT_DATE + interval '1 day'
  AND status = 'confirmed'
```

O n8n envia um lembrete **one-way** para cada consulta encontrada.

---

## Webhook 2: `appointment_requests`

### Objetivo
Notificar o n8n quando pedidos de marcação são rejeitados.

### Configuração (Supabase Dashboard)

1. Ir a **Database → Webhooks**
2. Clicar **Create a new webhook**
3. Preencher:
   - **Name**: `appointment_requests_to_n8n`
   - **Table**: `appointment_requests`
   - **Events**: `UPDATE`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://<instancia-n8n>/webhook/<webhook-id>`
   - **Headers**: mesmos do Webhook 1

### Lógica n8n

| Condição | Automação |
|----------|-----------|
| `old_record.status == pending` AND `record.status == rejected` | AUT-4: Notificação de rejeição |

---

## Webhook 3: `appointment_suggestions`

### Objetivo
Notificar o n8n quando a secretária sugere horários alternativos a um paciente.

### Configuração (Supabase Dashboard)

1. Ir a **Database → Webhooks**
2. Clicar **Create a new webhook**
3. Preencher:
   - **Name**: `appointment_suggestions_to_n8n`
   - **Table**: `appointment_suggestions`
   - **Events**: `INSERT`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://<instancia-n8n>/webhook/<webhook-id>`
   - **Headers**: mesmos do Webhook 1

### Payload

```json
{
  "type": "INSERT",
  "table": "appointment_suggestions",
  "schema": "public",
  "record": {
    "id": "uuid",
    "appointment_request_id": "uuid",
    "patient_id": "uuid",
    "suggested_slots": [
      { "date": "2026-02-12", "time": "10:00", "professional_id": "uuid" },
      { "date": "2026-02-12", "time": "15:00", "professional_id": "uuid" },
      { "date": "2026-02-13", "time": "09:30", "professional_id": "uuid" }
    ],
    "status": "pending",
    "accepted_slot": null,
    "expires_at": "2026-02-11T23:59:59Z",
    "created_at": "2026-02-04T12:00:00Z",
    "updated_at": "2026-02-04T12:00:00Z"
  },
  "old_record": null
}
```

### Lógica n8n

1. Lookup do paciente via `patient_id`
2. Compor mensagem WhatsApp com links clicáveis (1 por slot)
3. Cada link aponta para um Webhook Node do n8n: `https://<n8n>/webhook/<id>?suggestion_id=xxx&slot_index=0`
4. Quando o paciente clica, o n8n:
   - Atualiza `appointment_suggestions` (status → accepted, accepted_slot → slot escolhido)
   - Cria a consulta em `appointments` via REST API

---

## Lookup de Dados

Os payloads contêm IDs. Para obter nomes/telefones:

```
GET {SUPABASE_URL}/rest/v1/patients?id=eq.<patient_id>&select=name,phone,email
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
```

```
GET {SUPABASE_URL}/rest/v1/professionals?id=eq.<professional_id>&select=name
GET {SUPABASE_URL}/rest/v1/specialties?id=eq.<specialty_id>&select=name
GET {SUPABASE_URL}/rest/v1/consultation_types?id=eq.<consultation_type_id>&select=name
```

O n8n tem integração nativa com Supabase — usar o Supabase Node é a forma mais simples.

---

## Segurança

- Usar um secret partilhado no header `Authorization` para autenticar os webhooks
- O n8n deve validar este header antes de processar
- Os DB Webhooks do Supabase correm com permissões `SECURITY DEFINER`

---

## Removido (Legacy)

Os seguintes componentes foram removidos e NÃO devem ser usados:

- Tabela `whatsapp_events` (outbox — removida)
- Tabela `whatsapp_workflows` (workflow tracking — removida)
- Tabela `whatsapp_action_tokens` (links de ação — removida)
- Endpoint `/api/webhook` (removido)
- Endpoint `/api/action` (removido)
- Endpoint `/api/n8n/process-events` (removido)
- Endpoint `/api/n8n/create-24h-confirmations` (removido)
- Endpoint `/api/internal` (removido)
- Triggers PostgreSQL (`trigger_pre_confirmation`, `trigger_no_show`, `trigger_review`)
- Função `create_whatsapp_event()`
- Funções `validate_action_token()`, `mark_token_used()`, `generate_action_token()`
