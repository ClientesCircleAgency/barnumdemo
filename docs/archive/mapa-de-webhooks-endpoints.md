# Mapa de Webhooks / Endpoints para Automações WhatsApp (n8n)

**Projeto:** Barnum - Clínica de Medicina Dentária e Rejuvenescimento Facial  
**Data:** 28 de Janeiro de 2026  
**Contexto:** Integração n8n WhatsApp para 7 automações  
**Stack:** React 18 + Vite + TypeScript + Supabase (PostgreSQL + Auth + Realtime)

---

## 📋 Sumário Executivo

Este documento mapeia **todos os endpoints/webhooks existentes** no projeto Barnum e identifica **endpoints em falta** necessários para implementar 7 automações WhatsApp via n8n.

### Estado Atual
- ✅ **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- ✅ **Tabela `whatsapp_workflows`:** Já existe para tracking de automações
- ❌ **Edge Functions:** Não existem (pasta `supabase/functions/` não criada)
- ❌ **API Routes:** Projeto é SPA puro, sem backend Express/API routes
- ❌ **Webhooks públicos:** Nenhum endpoint público implementado

### Recomendação
**Criar Supabase Edge Functions** para expor endpoints seguros que o n8n pode chamar. Alternativamente, n8n pode interagir diretamente com Supabase via **Database Triggers + Realtime** ou **Scheduled Queries**.

---

## 🗄️ Inventário de Endpoints/Webhooks Existentes

| Endpoint | Tipo | Status | Autenticação | Propósito |
|----------|------|--------|--------------|-----------|
| *Nenhum* | - | ❌ **NÃO EXISTE** | - | Projeto não tem Edge Functions ou API routes |

**Nota:** O projeto Barnum é um **SPA React puro** conectado diretamente ao Supabase. Toda a lógica de backend está em:
- **Database** (PostgreSQL com RLS)
- **Auth** (Supabase Auth)
- **Realtime** (Supabase Realtime para subscriptions)

**Para n8n**, precisamos criar **Supabase Edge Functions** ou usar **Database Triggers/Scheduled Jobs**.

---

## 📊 Tabelas Relevantes para Automações

### 1. `appointments` (Consultas)
```typescript
{
  id: uuid (PK)
  patient_id: uuid (FK -> patients)
  professional_id: uuid (FK -> professionals)
  specialty_id: uuid (FK -> specialties)
  consultation_type_id: uuid (FK -> consultation_types)
  room_id: uuid | null (FK -> rooms)
  date: date (YYYY-MM-DD)
  time: time (HH:MM:SS)
 duration: number (minutos)
  status: appointment_status ENUM
    - 'scheduled'
    - 'confirmed'
    - 'pre_confirmed' ✨
    - 'waiting'
    - 'in_progress'
    - 'completed'
    - 'cancelled'
    - 'no_show'
  notes: text | null
  created_at: timestamptz
  updated_at: timestamptz
}
```

### 2. `patients` (Pacientes)
```typescript
{
  id: uuid (PK)
  name: text
  phone: text
  email: text | null
  nif: text (UNIQUE)
  birth_date: date | null
  tags: text[] | null
  notes: text | null
  created_at: timestamptz
  updated_at: timestamptz
}
```

### 3. `whatsapp_workflows` (Tracking de Automações)
```typescript
{
  id: uuid (PK)
  appointment_id: uuid | null (FK -> appointments)
  patient_id: uuid (REQUIRED)
  phone: text (REQUIRED)
  workflow_type: text CHECK IN (
    'confirmation_24h',
    'review_reminder',
    'availability_suggestion'
  )
  status: text CHECK IN (
    'pending',
    'sent',
    'delivered',
    'responded',
    'expired',
    'cancelled'
  )
  scheduled_at: timestamptz (REQUIRED)
  sent_at: timestamptz | null
  response: text | null
  responded_at: timestamptz | null
  message_payload: jsonb | null
  created_at: timestamptz
  updated_at: timestamptz
}
```

### 4. `appointment_requests` (Pedidos de Marcação Públicos)
```typescript
{
  id: uuid (PK)
  name: text
  email: text
  phone: text
  nif: text
  service_type: text CHECK IN ('dentaria', 'oftalmologia')
  preferred_date: date
  preferred_time: time
  status: text CHECK IN ('pending', 'approved', 'rejected', 'converted')
  notes: text | null
  processed_at: timestamptz | null
  processed_by: uuid | null
  created_at: timestamptz
  updated_at: timestamptz
}
```

### 5. `professionals`, `specialties`, `consultation_types`, `rooms`
Tabelas auxiliares para enriquecer payloads.

---

## 🔄 Automações WhatsApp - Mapeamento Completo

### **1. Consulta Pré-confirmada**

#### Trigger
- **Evento:** `appointments.status` muda para `'pre_confirmed'`
- **Quando:** Quando secretária/admin cria consulta e marca como pré-confirmada

#### Endpoint Necessário
**❌ NÃO IMPLEMENTADO**

**Proposta:**
```
POST https://<project-ref>.supabase.co/functions/v1/whatsapp-send
```

**Ou usar Database Trigger:**
```sql
CREATE OR REPLACE FUNCTION notify_n8n_pre_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir row em whatsapp_workflows
  INSERT INTO whatsapp_workflows (
    appointment_id,
    patient_id,
    phone,
    workflow_type,
    scheduled_at,
    message_payload
  )
  SELECT
    NEW.id,
    NEW.patient_id,
    p.phone,
    'pre_confirmation',
    now(), -- enviar imediatamente
    jsonb_build_object(
      'appointment_id', NEW.id,
      'appointment_date', NEW.date,
      'appointment_time', NEW.time
    )
  FROM patients p
  WHERE p.id = NEW.patient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_appointment_pre_confirmed
AFTER INSERT OR UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.status = 'pre_confirmed')
EXECUTE FUNCTION notify_n8n_pre_confirmed();
```

**n8n Polling:**
```sql
-- n8n periodicamente executa (cada 1 min):
SELECT * FROM whatsapp_workflows
WHERE status = 'pending'
  AND scheduled_at <= now()
ORDER BY scheduled_at ASC
LIMIT 100;
```

#### Payload (quando n8n envia WhatsApp)
```json
{
  "event_type": "pre_confirmation",
  "event_id": "uuid-v4",
  "occurred_at": "2026-01-28T10:30:00Z",
  "source": "barnun",
  "environment": "production",
  "correlation_id": "uuid-v4",
  
  "clinic": {
    "name": "Clínica Barnum",
    "phone": "+351 XXX XXX XXX"
  },
  
  "appointment": {
    "id": "uuid",
    "date": "2026-02-01",
    "time": "14:30:00",
    "duration": 30,
    "status": "pre_confirmed",
    "created_at": "2026-01-28T10:30:00Z",
    "notes": null
  },
  
  "patient": {
    "id": "uuid",
    "name": "João Silva",
    "phone": "+351 912345678",
    "email": "joao@example.com",
    "nif": "123456789"
  },
  
  "professional": {
    "id": "uuid",
    "name": "Dr. António Costa",
    "specialty": "Medicina Dentária"
  },
  
  "consultation_type": {
    "id": "uuid",
    "name": "Consulta Dentária",
    "duration": 30,
    "color": "#10b981"
  },
  
  "message_template": {
    "type": "pre_confirmation",
    "text": "Olá {{patient.name}}, a sua consulta de {{consultation_type.name}} com {{professional.name}} está pré-confirmada para {{appointment.date}} às {{appointment.time}}. Em breve receberá mais informações."
  },
  
  "workflow": {
    "id": "uuid",
    "workflow_type": "pre_confirmation",
    "scheduled_at": "2026-01-28T10:30:00Z"
  }
}
```

#### Após Envio
n8n atualiza BD:
```sql
UPDATE whatsapp_workflows
SET 
  status = 'sent',
  sent_at = now()
WHERE id = :workflow_id;
```

---

### **2. Sugestão de Horário**

#### Trigger
- **Evento:** Admin cria sugestão de horário para paciente em lista de espera
- **Origem:** `appointment_requests` ou manual via UI

#### Endpoint Necessário
**❌ NÃO IMPLEMENTADO** (mesma lógica que #1)

#### Tabela Auxiliar Proposta
**❌ Tabela `appointment_suggestions` NÃO EXISTE**

**Criar tabela:**
```sql
CREATE TABLE appointment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  professional_id uuid REFERENCES professionals(id),
  specialty_id uuid REFERENCES specialties(id),
  suggested_slots jsonb NOT NULL, -- array de {date, time}
  claim_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_slot jsonb,
  appointment_id uuid REFERENCES appointments(id),
  status text CHECK IN ('pending', 'claimed', 'expired', 'cancelled'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Trigger BD
Quando row inserida em `appointment_suggestions`:
```sql
CREATE OR REPLACE FUNCTION notify_n8n_suggestion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO whatsapp_workflows (
    appointment_id,
    patient_id,
    phone,
    workflow_type,
    scheduled_at,
    message_payload
  )
  SELECT
    NULL, -- sem appointment ainda
    NEW.patient_id,
    p.phone,
    'availability_suggestion',
    now(),
    jsonb_build_object(
      'suggestion_id', NEW.id,
      'claim_token', NEW.claim_token,
      'expires_at', NEW.expires_at,
      'suggested_slots', NEW.suggested_slots
    )
  FROM patients p
  WHERE p.id = NEW.patient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Payload
```json
{
  "event_type": "availability_suggestion",
  "event_id": "uuid-v4",
  "occurred_at": "2026-01-28T11:00:00Z",
  
  "patient": {
    "id": "uuid",
    "name": "Maria Santos",
    "phone": "+351 923456789"
  },
  
  "suggestion": {
    "id": "uuid",
    "claim_token": "ABC123DEF456",
    "expires_at": "2026-01-30T23:59:59Z",
    "suggested_slots": [
      { "date": "2026-01-30", "time": "10:00:00" },
      { "date": "2026-01-30", "time": "15:30:00" },
      { "date": "2026-01-31", "time": "09:00:00" }
    ]
  },
  
  "professional": {
    "name": "Dra. Ana Costa",
    "specialty": "Rejuvenescimento Facial"
  },
  
  "action_url": "https://barnum.pt/escolher-horario?token=ABC123DEF456",
  
  "message_template": {
    "type": "availability_suggestion",
    "text": "Olá {{patient.name}}, temos horários disponíveis com {{professional.name}}:\n\n1️⃣ {{slots[0].date}} às {{slots[0].time}}\n2️⃣ {{slots[1].date}} às {{slots[1].time}}\n3️⃣ {{slots[2].date}} às {{slots[2].time}}\n\nEscolha o seu horário: {{action_url}}\n\nVálido até {{expires_at}}."
  }
}
```

#### Action URL Proposta
**❌ NÃO IMPLEMENTADO**

**Endpoint público:**
```
GET /escolher-horario?token=ABC123DEF456
```

Página pública React que:
1. Valida `claim_token` (RLS policy permite read sem auth)
2. Mostra slots disponíveis
3. Permite escolher (cria appointment e marca suggestion como claimed)

---

### **3. Confirmar Consulta 24h Antes**

#### Trigger
- **Evento:** Scheduled job (n8n cron ou Supabase pg_cron)
- **Quando:** 24h antes de qualquer appointment com status `scheduled`

#### Database View Proposta
```sql
CREATE VIEW appointments_24h_before AS
SELECT
  a.id,
  a.patient_id,
  a.date,
  a.time,
  a.status,
  p.phone,
  p.name,
  prof.name as professional_name,
  ct.name as consultation_type_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN professionals prof ON a.professional_id = prof.id
JOIN consultation_types ct ON a.consultation_type_id = ct.id
WHERE 
  a.status = 'scheduled'
  AND a.date = CURRENT_DATE + INTERVAL '1 day'
  AND NOT EXISTS (
    SELECT 1 FROM whatsapp_workflows ww
    WHERE ww.appointment_id = a.id
      AND ww.workflow_type = 'confirmation_24h'
  );
```

#### n8n Scheduled Workflow
Diariamente às 09:00 AM:

```sql
SELECT * FROM appointments_24h_before;
```

Para cada row, criar workflow:
```sql
INSERT INTO whatsapp_workflows (
  appointment_id,
  patient_id,
  phone,
  workflow_type,
  scheduled_at,
  message_payload
) VALUES (
  :appointment_id,
  :patient_id,
  :phone,
  'confirmation_24h',
  now(),
  jsonb_build_object(
    'appointment_id', :appointment_id,
    'confirm_token', gen_random_uuid()::text
  )
);
```

#### Payload
```json
{
  "event_type": "confirmation_24h",
  "event_id": "uuid-v4",
  "occurred_at": "2026-01-28T09:00:00Z",
  
  "appointment": {
    "id": "uuid",
    "date": "2026-01-29",
    "time": "14:30:00",
    "duration": 30,
    "status": "scheduled"
  },
  
  "patient": {
    "name": "Pedro Oliveira",
    "phone": "+351 934567890"
  },
  
  "professional": {
    "name": "Dr. João Ferreira"
  },
  
  "consultation_type": {
    "name": "Implantologia"
  },
  
  "actions": {
    "confirm_url": "https://barnum.pt/confirmar?token=XYZ789",
    "cancel_url": "https://barnum.pt/cancelar?token=XYZ789"
  },
  
  "message_template": {
    "type": "confirmation_24h",
    "text": "Olá {{patient.name}}, lembrete da sua consulta de {{consultation_type}} amanhã ({{appointment.date}}) às {{appointment.time}} com {{professional.name}}.\n\n👍 Vou - {{confirm_url}}\n❌ Não vou - {{cancel_url}}"
  }
}
```

#### Endpoints Públicos Necessários
**❌ NÃO IMPLEMENTADOS**

**Edge Functions a criar:**

1. **Confirmar consulta:**
```typescript
// supabase/functions/confirm-appointment/index.ts
Deno.serve(async (req) => {
  const { token } = await req.json();
  
  // Validar token em whatsapp_workflows
  const { data: workflow } = await supabase
    .from('whatsapp_workflows')
    .select('appointment_id, patient_id')
    .eq('message_payload->>confirm_token', token)
    .eq('workflow_type', 'confirmation_24h')
    .single();
  
  if (!workflow) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 400 });
  }
  
  // Atualizar appointment para 'confirmed'
  await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', workflow.appointment_id);
  
  // Atualizar workflow
  await supabase
    .from('whatsapp_workflows')
    .update({ 
      status: 'responded',
      response: 'confirmed',
      responded_at: new Date().toISOString()
    })
    .eq('message_payload->>confirm_token', token);
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

2. **Cancelar consulta:**
```typescript
// supabase/functions/cancel-appointment/index.ts
// Lógica similar, mas status -> 'cancelled' e envia automação #5 (reagendar)
```

---

### **4. Reagendar (Não Compareceu)**

#### Trigger
- **Evento:** `appointments.status` muda para `'no_show'`
- **Quando:** Admin marca que paciente não compareceu

#### Database Trigger
```sql
CREATE OR REPLACE FUNCTION notify_n8n_no_show()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO whatsapp_workflows (
    appointment_id,
    patient_id,
    phone,
    workflow_type,
    scheduled_at,
    message_payload
  )
  SELECT
    NEW.id,
    NEW.patient_id,
    p.phone,
    'reschedule_no_show',
    now() + INTERVAL '2 hours', -- aguardar 2h antes de enviar
    jsonb_build_object(
      'original_appointment_id', NEW.id,
      'original_date', NEW.date,
      'original_time', NEW.time
    )
  FROM patients p
  WHERE p.id = NEW.patient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_appointment_no_show
AFTER UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.status = 'no_show' AND OLD.status != 'no_show')
EXECUTE FUNCTION notify_n8n_no_show();
```

#### Payload
```json
{
  "event_type": "reschedule_no_show",
  "event_id": "uuid-v4",
  "occurred_at": "2026-01-28T16:00:00Z",
  
  "patient": {
    "name": "Carlos Pereira",
    "phone": "+351 945678901"
  },
  
  "original_appointment": {
    "id": "uuid",
    "date": "2026-01-28",
    "time": "14:00:00",
    "professional": "Dr. António Silva",
    "consultation_type": "Consulta Dentária"
  },
  
  "action_url": "https://barnum.pt/reagendar?reason=no_show&patient_id=uuid",
  
  "message_template": {
    "type": "reschedule_no_show",
    "text": "Olá {{patient.name}}, notámos que não pôde comparecer à sua consulta de {{consultation_type}} hoje às {{time}}. Gostaríamos de remarcar. Por favor contacte-nos ou escolha um novo horário: {{action_url}}"
  }
}
```

---

### **5. Reagendar (Não Vou)**

#### Trigger
- **Evento:** Paciente cancela consulta via link de confirmação (automação #3)
- **Quando:** `appointments.status` muda para `'cancelled'` E patient_initiated = true

#### Considerar adicionar campo
```sql
ALTER TABLE appointments 
ADD COLUMN cancellation_reason text,
ADD COLUMN cancelled_by uuid REFERENCES auth.users(id);
```

#### Database Trigger
```sql
CREATE OR REPLACE FUNCTION notify_n8n_patient_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas se foi cancelado pelo próprio paciente (não admin)
  IF NEW.cancelled_by IS NOT NULL AND NEW.cancelled_by = NEW.patient_id THEN
    INSERT INTO whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at,
      message_payload
    )
    SELECT
      NEW.id,
      NEW.patient_id,
      p.phone,
      'reschedule_cancelled',
      now() + INTERVAL '1 hour',
      jsonb_build_object(
        'original_appointment_id', NEW.id,
        'cancellation_reason', NEW.cancellation_reason
      )
    FROM patients p
    WHERE p.id = NEW.patient_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Payload

```json
{
  "event_type": "reschedule_cancelled",
  "event_id": "uuid-v4",
  
  "patient": {
    "name": "Ana Rodrigues",
    "phone": "+351 956789012"
  },
  
  "cancelled_appointment": {
    "id": "uuid",
    "date": "2026-02-05",
    "time": "10:00:00",
    "professional": "Dra. Maria Santos"
  },
  
  "action_url": "https://barnum.pt/reagendar?reason=cancelled&patient_id=uuid",
  
  "message_template": {
    "type": "reschedule_cancelled",
    "text": "Olá {{patient.name}}, recebemos o seu cancelamento da consulta de {{date}} às {{time}}. Gostaríamos de ajudá-lo a remarcar. Escolha um novo horário: {{action_url}}"
  }
}
```

---

### **6. Lembrete Google Review (2h Após Concluída)**

#### Trigger
- **Evento:** `appointments.status` muda para `'completed'`
- **Quando:** Admin marca consulta como concluída

#### Database Trigger
```sql
CREATE OR REPLACE FUNCTION notify_n8n_review_reminder()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO whatsapp_workflows (
    appointment_id,
    patient_id,
    phone,
    workflow_type,
    scheduled_at,
    message_payload
  )
  SELECT
    NEW.id,
    NEW.patient_id,
    p.phone,
    'review_reminder',
    now() + INTERVAL '2 hours', -- enviar 2h depois
    jsonb_build_object(
      'appointment_id', NEW.id,
      'professional_name', prof.name,
      'google_review_url', 'https://g.page/r/CLINIC_CID/review'
    )
  FROM patients p
  JOIN professionals prof ON NEW.professional_id = prof.id
  WHERE p.id = NEW.patient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_appointment_completed
AFTER UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION notify_n8n_review_reminder();
```

#### Payload
```json
{
  "event_type": "review_reminder",
  "event_id": "uuid-v4",
  "occurred_at": "2026-01-28T18:00:00Z",
  
  "patient": {
    "name": "Sofia Costa",
    "phone": "+351 967890123"
  },
  
  "completed_appointment": {
    "id": "uuid",
    "date": "2026-01-28",
    "time": "16:00:00",
    "professional": "Dr. Pedro Oliveira",
    "consultation_type": "Botox"
  },
  
  "review_url": "https://g.page/r/CmF2cVkgQ2xpbmlj/review",
  
  "message_template": {
    "type": "review_reminder",
    "text": "Olá {{patient.name}}, esperamos que a sua consulta de {{consultation_type}} com {{professional.name}} tenha corrido bem! 🌟\n\nSe ficou satisfeito, ajude-nos deixando uma avaliação no Google: {{review_url}}\n\nObrigado! 💙"
  }
}
```

**Configuração Google Review URL:**
Adicionar em `clinic_settings`:
```sql
INSERT INTO clinic_settings (key, value) VALUES
('google_review_url', '"https://g.page/r/CmF2cVkgQ2xpbmlj/review"');
```

---

### **7. Reativação de Clientes (6 Meses Sem Atividade)**

#### Trigger
- **Evento:** Scheduled job (n8n cron mensal ou pg_cron)
- **Quando:** 1x por mês, identificar pacientes sem consultas há 6+ meses

#### Database View
```sql
CREATE VIEW inactive_patients AS
SELECT
  p.id,
  p.name,
  p.phone,
  p.email,
  MAX(a.date) as last_appointment_date,
  COUNT(a.id) as total_appointments_historical
FROM patients p
LEFT JOIN appointments a ON p.id = a.patient_id
GROUP BY p.id, p.name, p.phone, p.email
HAVING 
  MAX(a.date) < CURRENT_DATE - INTERVAL '6 months'
  OR MAX(a.date) IS NULL;
```

#### n8n Scheduled Workflow
Mensalmente (1º dia de cada mês às 10:00):

```sql
SELECT * FROM inactive_patients
WHERE phone IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM whatsapp_workflows ww
    WHERE ww.patient_id = inactive_patients.id
      AND ww.workflow_type = 'reactivation'
      AND ww.created_at > CURRENT_DATE - INTERVAL '1 month'
  );
```

Para cada row criar workflow:
```sql
INSERT INTO whatsapp_workflows (
  patient_id,
  phone,
  workflow_type,
  scheduled_at,
  message_payload
) VALUES (
  :patient_id,
  :phone,
  'reactivation',
  now(),
  jsonb_build_object(
    'last_appointment_date', :last_appointment_date,
    'months_inactive', EXTRACT(MONTH FROM AGE(CURRENT_DATE, :last_appointment_date))
  )
);
```

#### Payload
```json
{
  "event_type": "reactivation",
  "event_id": "uuid-v4",
  "occurred_at": "2026-02-01T10:00:00Z",
  
  "patient": {
    "id": "uuid",
    "name": "Manuel Sousa",
    "phone": "+351 978901234",
    "last_appointment_date": "2025-08-01",
    "months_inactive": 6
  },
  
  "clinic": {
    "name": "Clínica Barnum",
    "specialties": ["Medicina Dentária", "Rejuvenescimento Facial"],
    "booking_url": "https://barnum.pt/marcar"
  },
  
  "message_template": {
    "type": "reactivation",
    "text": "Olá {{patient.name}}, há {{months_inactive}} meses que não o vemos na Clínica Barnum! 😊\n\nGostaríamos de cuidar novamente da sua saúde oral e bem-estar. Temos novidades em Medicina Dentária e Rejuvenescimento Facial.\n\nMarque já a sua consulta: {{booking_url}}\n\nEstamos à sua espera! 💙"
  }
}
```

---

## 🔒 Segurança e Autenticação

### Níveis de Autenticação

#### 1. **Database Triggers (Recomendado)**
- ✅ **Mais seguro:** Triggers executam no backend do Supabase
- ✅ **Sem exposição:** Nenhum endpoint público
- ✅ **n8n polling:** n8n consulta `whatsapp_workflows` com **service_role key**
- ⚠️ **Service role key:** Guardar em n8n environment variables (nunca no código)

**Configuração n8n:**
```javascript
// Postgres Node em n8n
Host: db.<project-ref>.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: <db-password>
SSL: Required

// Query:
SELECT * FROM whatsapp_workflows
WHERE status = 'pending'
  AND scheduled_at <= now()
ORDER BY scheduled_at ASC
LIMIT 100;
```

#### 2. **Supabase Edge Functions (Alternativa)**
- ✅ **Endpoints HTTPS:** Podem receber webhooks externos
- ✅ **CORS configurível:** Pode ser chamado por frontend público
- ⚠️ **Autenticação:** Usar Bearer token ou HMAC signature

**Exemplo Edge Function com HMAC:**
```typescript
// supabase/functions/_shared/verify-hmac.ts
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");
  return signature === expectedSignature;
}

// Uso em endpoint:
const signature = req.headers.get("x-webhook-signature");
const isValid = verifyHmacSignature(
  JSON.stringify(payload),
  signature,
  Deno.env.get("WEBHOOK_SECRET")!
);

if (!isValid) {
  return new Response("Unauthorized", { status: 401 });
}
```

#### 3. **RLS Policies para Action URLs Públicas**
Para endpoints públicos de confirm/cancel/reschedule:

```sql
-- Permitir UPDATE se claim_token válido
CREATE POLICY "Public can confirm with valid token"
ON appointments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_workflows ww
    WHERE ww.appointment_id = appointments.id
      AND ww.message_payload->>'confirm_token' = current_setting('request.jwt.claim.token', true)
      AND ww.workflow_type = 'confirmation_24h'
      AND ww.message_payload->>'expires_at'::timestamptz > now()
  )
);
```

**Edge Function recebe token, valida, e executa:**
```typescript
await supabase.rpc('set_claim', { 
  claim: 'token', 
  value: token 
});

await supabase
  .from('appointments')
  .update({ status: 'confirmed' })
  .eq('id', appointment_id);
```

---

## 📝 Idempotência e Deduplicação

### Estratégias Anti-Duplicação

#### 1. **Unique Constraint em whatsapp_workflows**
```sql
ALTER TABLE whatsapp_workflows
ADD CONSTRAINT unique_pending_workflow_per_appointment
UNIQUE (appointment_id, workflow_type, status) 
WHERE status = 'pending';
```

Impede criar 2 workflows "pending" do mesmo tipo para a mesma consulta.

#### 2. **Idempotency Key no Payload**
```json
{
  "event_id": "uuid-v4", // único por evento
  "correlation_id": "uuid-v4" // agrupa eventos relacionados
}
```

n8n pode guardar `event_id` já processados numa tabela auxiliar ou cache.

#### 3. **Check Before Insert**
n8n, antes de enviar WhatsApp, verifica:
```sql
SELECT COUNT(*) FROM whatsapp_workflows
WHERE appointment_id = :id
  AND workflow_type = :type
  AND sent_at IS NOT NULL
  AND sent_at > now() - INTERVAL '24 hours';
```

Se já foi enviado nas últimas 24h, skip.

---

## 🛠️ Implementação Recomendada (Passo a Paso)

### **Fase 1: Database Triggers (Semana 1)**
1. ✅ Criar triggers para automações #1, #4, #5, #6
2. ✅ Testar inserção automática em `whatsapp_workflows`
3. ✅ Configurar n8n com polling a cada 1 minuto

### **Fase 2: Views e Scheduled Jobs (Semana 2)**
1. ✅ Criar view `appointments_24h_before`
2. ✅ Criar view `inactive_patients`
3. ✅ Configurar n8n scheduled workflows (#3, #7)

### **Fase 3: Tabelas Auxiliares (Semana 3)**
1. ✅ Criar `appointment_suggestions` para automação #2
2. ✅ Adicionar campos `cancellation_reason`, `cancelled_by` em appointments

### **Fase 4: Edge Functions para Action URLs (Semana 4)**
1. ✅ `confirm-appointment`
2. ✅ `cancel-appointment`
3. ✅ `choose-timeslot` (sugestões)
4. ✅ Frontend público para estas páginas

### **Fase 5: Testes End-to-End (Semana 5)**
1. ✅ Testar cada automação individualmente
2. ✅ Validar payloads recebidos pelo n8n
3. ✅ Testar action URLs (confirm/cancel/choose)
4. ✅ Monitorizar logs no Supabase

---

## 📊 Monitorização e Logs

### Dashboard View
```sql
CREATE VIEW whatsapp_workflows_summary AS
SELECT
  workflow_type,
  status,
  COUNT(*) as count,
  MIN(scheduled_at) as oldest_pending,
  MAX(sent_at) as last_sent
FROM whatsapp_workflows
GROUP BY workflow_type, status
ORDER BY workflow_type, status;
```

### Logs de Erros
Adicionar tabela:
```sql
CREATE TABLE whatsapp_workflow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES whatsapp_workflows(id),
  event_type text NOT NULL,
  error_message text,
  error_details jsonb,
  created_at timestamptz DEFAULT now()
);
```

n8n grava erros aqui quando envio falha.

---

## 🎯 Resumo - Endpoints a Criar

| Endpoint | Tipo | Prioridade | Status |
|----------|------|------------|--------|
| Database Triggers (7x) | Postgres Function | 🔴 Alta | ❌ Não implementado |
| View `appointments_24h_before` | Postgres View | 🔴 Alta | ❌ Não implementado |
| View `inactive_patients` | Postgres View | 🟡 Média | ❌ Não implementado |
| Tabela `appointment_suggestions` | Postgres Table | 🟡 Média | ❌ Não implementado |
| Edge Function `confirm-appointment` | Deno/TypeScript | 🔴 Alta | ❌ Não implementado |
| Edge Function `cancel-appointment` | Deno/TypeScript | 🔴 Alta | ❌ Não implementado |
| Edge Function `choose-timeslot` | Deno/TypeScript | 🟡 Média | ❌ Não implementado |
| Frontend `/confirmar` | React Page | 🔴 Alta | ❌ Não implementado |
| Frontend `/cancelar` | React Page | 🔴 Alta | ❌ Não implementado |
| Frontend `/escolher-horario` | React Page | 🟡 Média | ❌ Não implementado |
| Frontend `/reagendar` | React Page | 🟢 Baixa | ❌ Não implementado |

---

## ✅ Conclusão

O projeto Barnum **não tem endpoints/webhooks implementados** porque é um **SPA puro**. Para as automações WhatsApp funcionarem, é necessário:

1. **Criar Database Triggers** para popular `whatsapp_workflows` automaticamente
2. **Configurar n8n** para polling periódico da tabela `whatsapp_workflows`
3. **Criar Supabase Edge Functions** para action URLs públicas (confirm/cancel/choose)
4. **Adicionar páginas React públicas** para os links de ação enviados via WhatsApp

**Alternativa Simplificada:**
Se n8n tiver acesso direto ao Supabase DB (service_role key), pode **fazer tudo via SQL** sem precisar de Edge Functions. Isto é mais simples mas menos seguro para action URLs públicas (confirm/cancel).

**Recomendação Final:**
Use **Database Triggers** para tracking + **n8n Polling** + **Edge Functions** para action URLs = arquitetura segura e escalável.
