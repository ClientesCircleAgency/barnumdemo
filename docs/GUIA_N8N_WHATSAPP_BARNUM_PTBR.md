# Guia de Integração WhatsApp - Barnun + n8n

**Versão:** 1.0 Final  
**Data:** 28 de Janeiro de 2026  
**Público-Alvo:** Parceiro de Automação n8n

---

## 📋 Sumário Executivo

Este documento é o guia técnico oficial para implementar as automações WhatsApp do Barnun via n8n.

**Tipo de Integração:** Webhook bidirecional  
**Protocolo:** HTTPS POST com assinatura HMAC  
**Formato:** JSON  
**Total de Funções Serverless:** 3 (dentro do limite Vercel Hobby)

---

## 🎯 1. Visão Geral da Arquitetura

### Fluxo de Comunicação

```
┌─────────────────┐                           ┌─────────────────┐
│     BARNUM      │   ① Evento de consulta    │      n8n        │
│   (PostgreSQL   │ ────────────────────────> │   (Recebe)      │
│    + Triggers)  │   POST com HMAC           │                 │
└─────────────────┘                           └─────────────────┘
                                                      │
                                                      │ ② Processar
                                                      │    Workflow
                                                      ▼
                                              ┌─────────────────┐
                                              │    WhatsApp     │
                                              │     Patient     │
                                              │  (Mensagem +    │
                                              │   Links Ação)   │
                                              └─────────────────┘
                                                      │
                                                      │ ③ Paciente
                                                      │    clica link
                                                      │    OU responde
                                                      ▼
┌─────────────────┐                           ┌─────────────────┐
│     BARNUM      │   ④ Callback com ação     │      n8n        │
│   (Atualiza BD) │ <──────────────────────── │    (Envia)      │
│                 │   POST com HMAC           │                 │
└─────────────────┘                           └─────────────────┘
```

### Princípios da Arquitetura

✅ **Webhook-Based:** Comunicação push (sem polling)  
✅ **Event-Driven:** Triggers de base de dados iniciam o fluxo  
✅ **Serverless:** 3 funções Vercel (limite respeitado)  
✅ **Seguro:** HMAC SHA-256 em todas as comunicações  
✅ **Idempotente:** Chaves de idempotência previnem duplicação  

❌ **NÃO usa:** Edge Functions  
❌ **NÃO usa:** Polling ou cron jobs externos  
❌ **NÃO usa:** Múltiplos endpoints por ação

---

## 🌐 2. Endpoints Oficiais

### 2.1 Inbound Webhook (n8n → Barnun)

**Endpoint Principal:**
```
POST https://barnum.DOMAIN.com/api/webhook
```

**Propósito:** Receber callbacks do n8n com respostas de pacientes

**Headers Obrigatórios:**
```http
Content-Type: application/json
X-Webhook-Signature: {assinatura-hmac-sha256}
```

**Body:** Varia por ação (ver seção 4)

**Exemplo:**
```json
{
  "action": "confirm",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "patientResponse": "confirmed"
}
```

---

### 2.2 Action Links (Paciente → Barnun)

Links clicáveis enviados ao paciente via WhatsApp.

#### Confirmar Consulta
```
GET https://barnum.DOMAIN.com/api/action?type=confirm&token={TOKEN_SEGURO}
```

#### Cancelar Consulta
```
GET https://barnum.DOMAIN.com/api/action?type=cancel&token={TOKEN_SEGURO}
```

#### Reagendar Consulta
```
GET https://barnum.DOMAIN.com/api/action?type=reschedule&token={TOKEN_SEGURO}
```

**Observações:**
- Tokens são de uso único (válidos por 7 dias)
- Clique retorna página HTML estilizada de sucesso
- Barnun atualiza BD automaticamente

---

### 2.3 Outbox Processor (Interno Barnun)

**Endpoint:**
```
POST https://barnum.DOMAIN.com/api/internal
```

**Propósito:** Processar fila de eventos pendentes (chamado por CRON)

**Headers:**
```http
Authorization: Bearer {INTERNAL_API_SECRET}
Content-Type: application/json
```

**Observação:** Este endpoint é **INTERNO** ao Barnun. O n8n **não** chama este endpoint - apenas **recebe** eventos dele via webhook configurado.

---

## 🔐 3. Segurança

### 3.1 Assinatura HMAC SHA-256

Todas as comunicações entre Barnun ↔ n8n usam HMAC para garantir autenticidade.

#### Como Funciona

1. **Sender** gera hash HMAC do payload usando chave secreta partilhada
2. **Sender** envia hash no header `X-Webhook-Signature`
3. **Receiver** gera hash do payload recebido com a mesma chave
4. **Receiver** compara hashes (timing-safe)
5. **Receiver** rejeita se não corresponderem (401 Unauthorized)

---

### 3.2 Verificar HMAC (n8n recebe de Barnun)

**No n8n - Function Node após Webhook Trigger:**

```javascript
// Configuração
const secret = '{{$env.WEBHOOK_SECRET}}'; // Mesma chave que Barnun
const receivedSignature = $input.item.headers['x-webhook-signature'];
const payload = JSON.stringify($input.item.json);

// Gerar assinatura esperada
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const expectedSignature = hmac.digest('hex');

// Validar (timing-safe)
if (receivedSignature !== expectedSignature) {
  throw new Error('❌ Assinatura HMAC inválida! Possível ataque.');
}

// ✅ Assinatura válida - continuar processamento
return $input.item.json;
```

---

### 3.3 Gerar HMAC (n8n envia para Barnun)

**No n8n - Function Node antes de HTTP Request:**

```javascript
// Preparar payload
const payload = {
  action: 'confirm',
  appointmentId: '{{$json.appointmentId}}',
  patientResponse: 'confirmed'
};

const payloadString = JSON.stringify(payload);
const secret = '{{$env.WEBHOOK_SECRET}}';

// Gerar assinatura
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payloadString);
const signature = hmac.digest('hex');

// Retornar para usar no HTTP Request
return {
  json: {
    body: payload,
    signature: signature
  }
};
```

**No HTTP Request Node:**
```
Headers:
  Content-Type: application/json
  X-Webhook-Signature: {{$node.GenerateHMAC.json.signature}}

Body:
  {{$node.GenerateHMAC.json.body}}
```

---

### 3.4 Tokens de Ação (Action Links)

**Características:**
- ✅ Gerados no Barnun via função de BD `generate_action_token()`
- ✅ Base64 de 24 bytes aleatórios (criptograficamente seguros)
- ✅ Uso único (marcados como `used` após clique)
- ✅ Expiração de 7 dias
- ✅ Vinculados a `action_type` específico (confirm/cancel/reschedule)

**Validação:**
1. Token existe na BD
2. Não foi usado (`used_at IS NULL`)
3. Não expirou (`expires_at > NOW()`)
4. `action_type` corresponde ao tipo da URL

---

## 📨 4. As 7 Automações WhatsApp

### 4.1 Consulta Pré-confirmada

#### **Trigger no Barnun**
- Evento: Nova consulta criada (`INSERT` na tabela `appointments`)
- Condição: `status IN ('scheduled', 'confirmed')`
- Timing: Imediatamente após criação

#### **Payload (Barnun → n8n)**

**Event Type:** `appointment.pre_confirmed`

```json
{
  "event_type": "appointment.pre_confirmed",
  "entity_type": "appointment",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2026-01-28T10:00:00Z",
  "appointment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "date": "2026-02-01",
    "time": "10:00",
    "duration": 60,
    "status": "scheduled",
    "patient": {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "João Silva",
      "phone": "+351912345678",
      "email": "joao.silva@example.com"
    },
    "professional": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "Dra. Maria Santos"
    },
    "specialty": {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Medicina Dentária"
    },
    "consultation_type": {
      "id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "name": "Consulta de Avaliação"
    }
  },
  "action_links": {
    "confirm": "https://barnum.DOMAIN.com/api/action?type=confirm&token=abc123def456",
    "cancel": "https://barnum.DOMAIN.com/api/action?type=cancel&token=xyz789uvw123"
  }
}
```

#### **Mensagem WhatsApp (Template)**

```
Olá {{appointment.patient.name}}! 👋

A sua consulta de *{{appointment.specialty.name}}* está marcada:

📅 *Data:* {{appointment.date}}
🕐 *Hora:* {{appointment.time}}
👨‍⚕️ *Profissional:* {{appointment.professional.name}}

Por favor, confirme a sua presença:

✅ Confirmar: {{action_links.confirm}}
❌ Cancelar: {{action_links.cancel}}

Até breve! 😊
```

#### **Callback Inbound**
❌ **Não aplicável** - O paciente clica diretamente no link de ação

---

### 4.2 Sugestão de Horário

#### **Trigger no Barnun**
- Evento: Manual ou sem vagas disponíveis
- Timing: On-demand

#### **Payload (Barnun → n8n)**

**Event Type:** `appointment.time_suggestion`

```json
{
  "event_type": "appointment.time_suggestion",
  "entity_type": "appointment_request",
  "entity_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "workflow_id": "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e",
  "created_at": "2026-01-28T11:30:00Z",
  "patient": {
    "id": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f",
    "name": "Maria Costa",
    "phone": "+351913456789",
    "email": "maria.costa@example.com"
  },
  "specialty": {
    "id": "d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a",
    "name": "Ortodontia"
  },
  "suggested_slots": [
    {
      "date": "2026-02-05",
      "time": "09:00",
      "professional": "Dr. Pedro Alves",
      "token": "slot1abc123"
    },
    {
      "date": "2026-02-05",
      "time": "14:30",
      "professional": "Dr. Pedro Alves",
      "token": "slot2def456"
    },
    {
      "date": "2026-02-06",
      "time": "10:00",
      "professional": "Dra. Ana Silva",
      "token": "slot3ghi789"
    }
  ],
  "action_links": {
    "slot_1": "https://barnum.DOMAIN.com/api/action?type=confirm&token=slot1abc123",
    "slot_2": "https://barnum.DOMAIN.com/api/action?type=confirm&token=slot2def456",
    "slot_3": "https://barnum.DOMAIN.com/api/action?type=confirm&token=slot3ghi789"
  }
}
```

#### **Mensagem WhatsApp (Template)**

```
Olá {{patient.name}}! 👋

Temos as seguintes opções disponíveis para *{{specialty.name}}*:

*1️⃣ {{suggested_slots[0].date}} às {{suggested_slots[0].time}}*
   Com: {{suggested_slots[0].professional}}
   👉 {{action_links.slot_1}}

*2️⃣ {{suggested_slots[1].date}} às {{suggested_slots[1].time}}*
   Com: {{suggested_slots[1].professional}}
   👉 {{action_links.slot_2}}

*3️⃣ {{suggested_slots[2].date}} às {{suggested_slots[2].time}}*
   Com: {{suggested_slots[2].professional}}
   👉 {{action_links.slot_3}}

Clique na sua opção preferida para confirmar! ✅
```

#### **Callback Inbound**
❌ **Não aplicável** - O paciente clica diretamente no link de ação

---

### 4.3 Confirmar consulta 24h antes

#### **Trigger no Barnun**
- Evento: 24 horas antes da consulta confirmada
- Condição: `status = 'confirmed'` AND `date - 24h`
- Timing: Agendado para -24h

#### **Payload (Barnun → n8n)**

**Event Type:** `appointment.confirmation_24h`

```json
{
  "event_type": "appointment.confirmation_24h",
  "entity_type": "appointment",
  "entity_id": "e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b",
  "workflow_id": "f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c",
  "created_at": "2026-01-31T10:00:00Z",
  "scheduled_for": "2026-01-31T10:00:00Z",
  "appointment": {
    "id": "e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b",
    "date": "2026-02-01",
    "time": "10:00",
    "duration": 60,
    "status": "confirmed",
    "patient": {
      "id": "a7b8c9d0-e1f2-0a1b-4c5d-6e7f8a9b0c1d",
      "name": "Carlos Rodrigues",
      "phone": "+351914567890",
      "email": "carlos.rodrigues@example.com"
    },
    "professional": {
      "id": "b8c9d0e1-f2a3-1b2c-5d6e-7f8a9b0c1d2e",
      "name": "Dra. Sofia Marques"
    },
    "specialty": {
      "id": "c9d0e1f2-a3b4-2c3d-6e7f-8a9b0c1d2e3f",
      "name": "Implantologia"
    },
    "consultation_type": {
      "id": "d0e1f2a3-b4c5-3d4e-7f8a-9b0c1d2e3f4a",
      "name": "Colocação de Implante"
    },
    "notes": "Trazer exames radiológicos"
  },
  "action_links": {
    "confirm_presence": "https://barnum.DOMAIN.com/api/action?type=confirm&token=conf24h123",
    "reschedule": "https://barnum.DOMAIN.com/api/action?type=reschedule&token=resc24h456",
    "cancel": "https://barnum.DOMAIN.com/api/action?type=cancel&token=canc24h789"
  }
}
```

#### **Mensagem WhatsApp (Template)**

```
🔔 *LEMBRETE: Consulta amanhã!*

Olá {{appointment.patient.name}},

A sua consulta está confirmada para:

📅 *{{appointment.date}} às {{appointment.time}}*
👨‍⚕️ {{appointment.professional.name}}
🏥 {{appointment.specialty.name}}

⚠️ *Importante:* {{appointment.notes}}

*Opções:*
✅ Confirmar presença: {{action_links.confirm_presence}}
📅 Reagendar: {{action_links.reschedule}}
❌ Cancelar: {{action_links.cancel}}

Aguardamos você! 😊
```

#### **Callback Inbound (Opcional)**

Se o paciente responder via mensagem texto (em vez de clicar no link):

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

```json
{
  "action": "confirm",
  "appointmentId": "e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b",
  "patientResponse": "confirmed",
  "responseMethod": "whatsapp_text",
  "timestamp": "2026-01-31T11:30:00Z"
}
```

---

### 4.4 Reagendar (não compareceu)

#### **Trigger no Barnun**
- Evento: Consulta marcada como 'no_show'
- Condição: `OLD.status != 'no_show' AND NEW.status = 'no_show'`
- Timing: +1 hora após marcar como no-show

#### **Payload (Barnun → n8n)**

**Event Type:** `appointment.no_show_reschedule`

```json
{
  "event_type": "appointment.no_show_reschedule",
  "entity_type": "appointment",
  "entity_id": "f7a8b9c0-d1e2-0f1a-3b4c-5d6e7f8a9b0c",
  "workflow_id": "a8b9c0d1-e2f3-1a2b-4c5d-6e7f8a9b0c1d",
  "created_at": "2026-01-28T11:00:00Z",
  "scheduled_for": "2026-01-28T12:00:00Z",
  "appointment": {
    "id": "f7a8b9c0-d1e2-0f1a-3b4c-5d6e7f8a9b0c",
    "date": "2026-01-28",
    "time": "10:00",
    "duration": 60,
    "status": "no_show",
    "patient": {
      "id": "b9c0d1e2-f3a4-2b3c-5d6e-7f8a9b0c1d2e",
      "name": "Ana Ferreira",
      "phone": "+351915678901",
      "email": "ana.ferreira@example.com"
    },
    "professional": {
      "id": "c0d1e2f3-a4b5-3c4d-6e7f-8a9b0c1d2e3f",
      "name": "Dr. Rui Sousa"
    },
    "specialty": {
      "id": "d1e2f3a4-b5c6-4d5e-7f8a-9b0c1d2e3f4a",
      "name": "Endodontia"
    }
  },
  "reschedule_options": [
    {
      "date": "2026-02-03",
      "time": "15:00"
    },
    {
      "date": "2026-02-04",
      "time": "09:30"
    }
  ],
  "action_links": {
    "reschedule": "https://barnum.DOMAIN.com/api/action?type=reschedule&token=noshow123"
  }
}
```

#### **Mensagem WhatsApp (Template)**

```
Olá {{appointment.patient.name}},

Notámos que não compareceu à sua consulta de *{{appointment.specialty.name}}* hoje às {{appointment.time}}. 😔

*Gostaria de reagendar?* Temos disponibilidade:

📅 {{reschedule_options[0].date}} às {{reschedule_options[0].time}}
📅 {{reschedule_options[1].date}} às {{reschedule_options[1].time}}

👉 Clique aqui para reagendar: {{action_links.reschedule}}

Ou responda com a opção preferida. Estamos aqui para ajudar! 💙
```

#### **Callback Inbound**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

```json
{
  "action": "no_show_reschedule",
  "appointmentId": "f7a8b9c0-d1e2-0f1a-3b4c-5d6e7f8a9b0c",
  "patientId": "b9c0d1e2-f3a4-2b3c-5d6e-7f8a9b0c1d2e",
  "attempt": 1,
  "patientResponse": "interested",
  "preferredDate": "2026-02-03",
  "preferredTime": "15:00",
  "timestamp": "2026-01-28T13:45:00Z"
}
```

---

### 4.5 Reagendar (não vou)

#### **Trigger no Barnun**
- Evento: Paciente cancela consulta
- Condição: `status = 'cancelled'` por ação do paciente
- Timing: Imediatamente após cancelamento

#### **Payload (Barnun → n8n)**

**Event Type:** `appointment.patient_cancelled`

```json
{
  "event_type": "appointment.patient_cancelled",
  "entity_type": "appointment",
  "entity_id": "e2f3a4b5-c6d7-5e6f-8a9b-0c1d2e3f4a5b",
  "workflow_id": "f3a4b5c6-d7e8-6f7a-9b0c-1d2e3f4a5b6c",
  "created_at": "2026-01-28T14:00:00Z",
  "appointment": {
    "id": "e2f3a4b5-c6d7-5e6f-8a9b-0c1d2e3f4a5b",
    "original_date": "2026-02-10",
    "original_time": "11:00",
    "status": "cancelled",
    "cancellation_reason": "Pedido do paciente",
    "cancelled_at": "2026-01-28T14:00:00Z",
    "patient": {
      "id": "a4b5c6d7-e8f9-7a8b-0c1d-2e3f4a5b6c7d",
      "name": "Paulo Mendes",
      "phone": "+351916789012",
      "email": "paulo.mendes@example.com"
    },
    "professional": {
      "id": "b5c6d7e8-f9a0-8b9c-1d2e-3f4a5b6c7d8e",
      "name": "Dra. Inês Carvalho"
    },
    "specialty": {
      "id": "c6d7e8f9-a0b1-9c0d-2e3f-4a5b6c7d8e9f",
      "name": "Branqueamento Dentário"
    }
  },
  "alternative_slots": [
    {
      "date": "2026-02-12",
      "time": "14:00",
      "professional": "Dra. Inês Carvalho",
      "token": "canresc1abc"
    },
    {
      "date": "2026-02-13",
      "time": "10:30",
      "professional": "Dra. Inês Carvalho",
      "token": "canresc2def"
    },
    {
      "date": "2026-02-15",
      "time": "16:00",
      "professional": "Dr. Miguel Santos",
      "token": "canresc3ghi"
    }
  ],
  "action_links": {
    "slot_1": "https://barnum.DOMAIN.com/api/action?type=confirm&token=canresc1abc",
    "slot_2": "https://barnum.DOMAIN.com/api/action?type=confirm&token=canresc2def",
    "slot_3": "https://barnum.DOMAIN.com/api/action?type=confirm&token=canresc3ghi"
  }
}
```

#### **Mensagem WhatsApp (Template)**

```
Olá {{appointment.patient.name}},

A sua consulta de *{{appointment.specialty.name}}* foi cancelada.

*Gostaria de reagendar?* Temos as seguintes opções:

*1️⃣ {{alternative_slots[0].date}} às {{alternative_slots[0].time}}*
   Com: {{alternative_slots[0].professional}}
   👉 {{action_links.slot_1}}

*2️⃣ {{alternative_slots[1].date}} às {{alternative_slots[1].time}}*
   Com: {{alternative_slots[1].professional}}
   👉 {{action_links.slot_2}}

*3️⃣ {{alternative_slots[2].date}} às {{alternative_slots[2].time}}*
   Com: {{alternative_slots[2].professional}}
   👉 {{action_links.slot_3}}

Ou responda com outra data de preferência. 📅
```

#### **Callback Inbound (Opcional)**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

```json
{
  "action": "reschedule",
  "appointmentId": "e2f3a4b5-c6d7-5e6f-8a9b-0c1d2e3f4a5b",
  "patientId": "a4b5c6d7-e8f9-7a8b-0c1d-2e3f4a5b6c7d",
  "newDate": "2026-02-12",
  "newTime": "14:00",
  "professionalId": "b5c6d7e8-f9a0-8b9c-1d2e-3f4a5b6c7d8e",
  "timestamp": "2026-01-28T14:30:00Z"
}
```

---

### 4.6 Lembrete review 2h após concluída

#### **Trigger no Barnun**
- Evento: Consulta concluída
- Condição: `OLD.status != 'completed' AND NEW.status = 'completed'`
- Timing: +2 horas após conclusão

#### **Payload (Barnun → n8n)**

**Event Type:** `appointment.review_reminder`

```json
{
  "event_type": "appointment.review_reminder",
  "entity_type": "appointment",
  "entity_id": "d7e8f9a0-b1c2-0d1e-3f4a-5b6c7d8e9f0a",
  "workflow_id": "e8f9a0b1-c2d3-1e2f-4a5b-6c7d8e9f0a1b",
  "created_at": "2026-01-28T14:00:00Z",
  "scheduled_for": "2026-01-28T14:00:00Z",
  "appointment": {
    "id": "d7e8f9a0-b1c2-0d1e-3f4a-5b6c7d8e9f0a",
    "date": "2026-01-28",
    "time": "10:00",
    "duration": 60,
    "status": "completed",
    "completed_at": "2026-01-28T11:00:00Z",
    "patient": {
      "id": "f9a0b1c2-d3e4-2f3a-5b6c-7d8e9f0a1b2c",
      "name": "Teresa Oliveira",
      "phone": "+351917890123",
      "email": "teresa.oliveira@example.com"
    },
    "professional": {
      "id": "a0b1c2d3-e4f5-3a4b-6c7d-8e9f0a1b2c3d",
      "name": "Dr. André Costa"
    },
    "specialty": {
      "id": "b1c2d3e4-f5a6-4b5c-7d8e-9f0a1b2c3d4e",
      "name": "Higiene Oral"
    },
    "consultation_type": {
      "id": "c2d3e4f5-a6b7-5c6d-8e9f-0a1b2c3d4e5f",
      "name": "Limpeza Dentária"
    }
  },
  "review_link": "https://barnum.DOMAIN.com/review?token=review123token",
  "google_review_link": "https://g.page/r/CLINIC_REVIEW_ID/review"
}
```

#### **Mensagem WhatsApp (Template)**

```
Olá {{appointment.patient.name}}! 😊

Esperamos que tenha gostado da sua consulta de *{{appointment.specialty.name}}* com *{{appointment.professional.name}}*.

⭐ *A sua opinião é muito importante para nós!*

Por favor, deixe uma avaliação:
👉 Review: {{review_link}}

Ou deixe uma avaliação no Google:
👉 Google: {{google_review_link}}

Muito obrigado! 🙏
```

#### **Callback Inbound**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

**Se o paciente submeter review:**

```json
{
  "action": "review",
  "appointmentId": "d7e8f9a0-b1c2-0d1e-3f4a-5b6c7d8e9f0a",
  "patientId": "f9a0b1c2-d3e4-2f3a-5b6c-7d8e9f0a1b2c",
  "reviewSubmitted": true,
  "rating": 5,
  "comment": "Excelente atendimento!",
  "platform": "whatsapp_link",
  "timestamp": "2026-01-28T15:30:00Z"
}
```

**Se o paciente recusar:**

```json
{
  "action": "review",
  "appointmentId": "d7e8f9a0-b1c2-0d1e-3f4a-5b6c7d8e9f0a",
  "reviewSubmitted": false,
  "timestamp": "2026-01-28T15:30:00Z"
}
```

---

### 4.7 Reativação de clientes (6 meses sem atividade)

#### **Trigger no Barnun**
- Evento: Campanha agendada de reativação
- Condição: Paciente sem consultas há 180+ dias
- Timing: Campanhas mensais/trimestrais

#### **Payload (Barnun → n8n)**

**Event Type:** `patient.reactivation`

```json
{
  "event_type": "patient.reactivation",
  "entity_type": "patient",
  "entity_id": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f",
  "workflow_id": "d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a",
  "created_at": "2026-01-28T09:00:00Z",
  "patient": {
    "id": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f",
    "name": "Ricardo Santos",
    "phone": "+351918901234",
    "email": "ricardo.santos@example.com",
    "last_appointment_date": "2025-07-15",
    "days_inactive": 197,
    "total_appointments": 3,
    "last_specialty": "Medicina Dentária",
    "preferred_professional": "Dra. Carla Reis"
  },
  "campaign": {
    "type": "reactivation_6m",
    "segment": "inactive_patients",
    "offer": "10% de desconto na próxima consulta"
  },
  "suggested_specialties": [
    "Medicina Dentária",
    "Higiene Oral",
    "Branqueamento"
  ],
  "action_links": {
    "book_now": "https://barnum.DOMAIN.com/booking?patient={{patient.id}}&token=react123",
    "view_offers": "https://barnum.DOMAIN.com/offers?token=react456"
  }
}
```

#### **Mensagem WhatsApp (Template)**

```
Olá {{patient.name}}! 👋

*Sentimos a sua falta!* 🦷

Não nos visita há {{patient.days_inactive}} dias. Está na hora de cuidar do seu sorriso!

🎁 *OFERTA ESPECIAL:* {{campaign.offer}}

*Serviços disponíveis:*
• {{suggested_specialties[0]}}
• {{suggested_specialties[1]}}
• {{suggested_specialties[2]}}

📅 *Marque já:* {{action_links.book_now}}
🎯 *Ver ofertas:* {{action_links.view_offers}}

Aguardamos o seu contacto! 💙
```

#### **Callback Inbound**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

```json
{
  "action": "reactivation",
  "patientId": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f",
  "campaignType": "reactivation_6m",
  "interested": true,
  "preferredSpecialty": "Higiene Oral",
  "responseText": "Gostaria de marcar consulta",
  "timestamp": "2026-01-28T10:30:00Z"
}
```

---

## ⚙️ 5. Configuração no n8n

### 5.1 Variáveis de Ambiente

Configure as seguintes variáveis no n8n:

```bash
# URLs
BARNUM_WEBHOOK_URL=https://barnum.DOMAIN.com/api/webhook
BARNUM_DOMAIN=barnum.DOMAIN.com

# Segurança
WEBHOOK_SECRET=sua-chave-secreta-partilhada-min-32-chars
INTERNAL_API_SECRET=chave-interna-barnum

# WhatsApp API (do seu fornecedor)
WHATSAPP_API_URL=https://seu-fornecedor-whatsapp.com/api
WHATSAPP_API_TOKEN=seu-token-whatsapp
```

---

### 5.2 Webhook Trigger (Receber de Barnun)

**Criar:** Webhook Trigger Node

**Configurações:**
- **Path:** `/webhook/whatsapp-barnum`
- **HTTP Method:** POST
- **Authentication:** None (usar HMAC)
- **Response Code:** 200

**Adicionar Function Node logo após (Verificar HMAC):**

```javascript
// === VERIFICAÇÃO HMAC ===
const crypto = require('crypto');

// Configuração
const secret = '{{$env.WEBHOOK_SECRET}}';
const receivedSig = $input.item.headers['x-webhook-signature'];
const payload = JSON.stringify($input.item.json);

// Gerar assinatura esperada
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const expectedSig = hmac.digest('hex');

// Validar (timing-safe)
if (!receivedSig || receivedSig !== expectedSig) {
  throw new Error('❌ HMAC inválido! Rejeitando webhook.');
}

// ✅ HMAC válido - passar dados para frente
return $input.item.json;
```

---

### 5.3 Estrutura de Workflow Recomendada

#### Workflow Principal: Router

```
[Webhook Trigger]
    ↓
[Function: Verificar HMAC]
    ↓
[Switch: Routing por event_type]
    ├── "appointment.pre_confirmed" → [Execute Workflow: Pré-confirmação]
    ├── "appointment.time_suggestion" → [Execute Workflow: Sugestão Horário]
    ├── "appointment.confirmation_24h" → [Execute Workflow: Lembrete 24h]
    ├── "appointment.no_show_reschedule" → [Execute Workflow: No-Show]
    ├── "appointment.patient_cancelled" → [Execute Workflow: Cancelamento]
    ├── "appointment.review_reminder" → [Execute Workflow: Review]
    └── "patient.reactivation" → [Execute Workflow: Reativação]
```

**Switch Node - Configuração:**
- Mode: Rules
- Rules baseadas em `{{$json.event_type}}`

---

#### Sub-workflow Exemplo: Pré-confirmação

```
[Start]
    ↓
[Function: Extrair Dados]
    ↓
[Function: Formatar Mensagem WhatsApp]
    ↓
[HTTP Request: Enviar WhatsApp]
    ↓
[IF: Enviado com sucesso?]
    ├── SIM → [Function: Log Sucesso]
    └── NÃO → [Function: Retry ou Alert]
```

---

### 5.4 HTTP Request para Barnun (Callback)

**Criar:** HTTP Request Node

**Configurações:**
- **Method:** POST
- **URL:** `{{$env.BARNUM_WEBHOOK_URL}}`
- **Authentication:** None (usar HMAC no header)

**Headers:**
```json
{
  "Content-Type": "application/json",
  "X-Webhook-Signature": "{{$node.GenerateHMAC.json.signature}}"
}
```

**Body (JSON):**
```json
{
  "action": "{{$json.action}}",
  "appointmentId": "{{$json.appointmentId}}",
  "patientResponse": "{{$json.patientResponse}}"
}
```

**Function Node antes (Gerar HMAC):**

```javascript
// === GERAR HMAC PARA BARNUM ===
const crypto = require('crypto');

// Preparar payload
const payload = {
  action: $json.action,
  appointmentId: $json.appointmentId,
  patientResponse: $json.patientResponse
};

const payloadString = JSON.stringify(payload);
const secret = '{{$env.WEBHOOK_SECRET}}';

// Gerar assinatura
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payloadString);
const signature = hmac.digest('hex');

// Retornar para HTTP Request
return {
  json: {
    ...payload,
    signature: signature
  }
};
```

---

### 5.5 Tratamento de Erros

**Para cada workflow, adicionar:**

1. **Retry Logic:** Máximo 3 tentativas com backoff exponencial
2. **Error Catcher:** Capturar erros e logar
3. **Alert:** Notificar equipa em falhas críticas
4. **Fallback:** Se WhatsApp falhar, enviar email/SMS

**Error Handler Node:**

```javascript
// Logar erro
const error = {
  workflow: 'pre_confirmation',
  patient_id: $json.patient?.id,
  appointment_id: $json.appointment?.id,
  error_message: $error.message,
  timestamp: new Date().toISOString()
};

console.error('❌ Erro no workflow:', error);

// Enviar alerta (email/Slack)
return { json: error };
```

---

## ✅ 6. Checklist Técnico

### 6.1 Configuração Inicial

- [ ] **Variáveis de ambiente configuradas** no n8n
  - WEBHOOK_SECRET (partilhada com Barnun)
  - BARNUM_WEBHOOK_URL
  - WHATSAPP_API_URL
  - WHATSAPP_API_TOKEN

- [ ] **Webhook Trigger criado** em `/webhook/whatsapp-barnum`

- [ ] **Função HMAC verify** após webhook trigger

- [ ] **Switch node** para routing por `event_type`

- [ ] **7 sub-workflows** criados (um por automação)

---

### 6.2 URLs a Configurar

**No Barnun (enviado por e-mail):**
```
N8N_WEBHOOK_BASE_URL=https://SEU-N8N-DOMAIN.com/webhook/whatsapp-barnum
```

**No n8n (variáveis de ambiente):**
```
BARNUM_WEBHOOK_URL=https://barnum.DOMAIN.com/api/webhook
```

---

### 6.3 Testes Obrigatórios

#### Teste 1: Verificar HMAC válido

```bash
curl -X POST https://n8n.DOMAIN.com/webhook/whatsapp-barnum \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: SUA_ASSINATURA_HMAC" \
  -d '{
    "event_type": "appointment.pre_confirmed",
    "appointment": {"patient": {"name": "Teste"}}
  }'
```

**Resultado esperado:** 200 OK

---

#### Teste 2: Rejeitar HMAC inválido

```bash
curl -X POST https://n8n.DOMAIN.com/webhook/whatsapp-barnum \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: assinatura_errada" \
  -d '{}'
```

**Resultado esperado:** 401 Unauthorized ou erro interno

---

#### Teste 3: Enviar WhatsApp

Disparar workflow manualmente com dados de teste.

**Resultado esperado:** Mensagem recebida no WhatsApp de teste

---

#### Teste 4: Callback para Barnun

Testar envio de callback com ação `confirm`.

```bash
curl -X POST https://barnum.DOMAIN.com/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: SUA_ASSINATURA_HMAC" \
  -d '{
    "action": "confirm",
    "appointmentId": "uuid-teste",
    "patientResponse": "confirmed"
  }'
```

**Resultado esperado:** 200 OK + consulta marcada como confirmada

---

#### Teste 5: Action Link

Clicar numa action link de teste.

**Exemplo:**
```
https://barnum.DOMAIN.com/api/action?type=confirm&token=TOKEN_TESTE
```

**Resultado esperado:** Página HTML de sucesso + BD atualizada

---

#### Teste 6: Token expirado

Tentar usar token com mais de 7 dias.

**Resultado esperado:** Página HTML de erro "Token expirado"

---

#### Teste 7: Token já usado

Clicar no mesmo link 2 vezes.

**Resultado esperado:** 
- 1º clique: Sucesso
- 2º clique: Erro "Token já usado"

---

### 6.4 Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| **401 Unauthorized** | HMAC inválido | Verificar que WEBHOOK_SECRET é igual em Barnun e n8n |
| **Mensagem não entregue** | Formato telefone errado | Usar formato E.164: +351XXXXXXXXX |
| **Token expirado** | Link com +7 dias | Gerar novo token no Barnun |
| **Token já usado** | Clique duplicado | Normal - cada token só pode ser usado 1 vez |
| **Callback timeout** | Barnun lento | Aumentar timeout HTTP Request para 30s |
| **Variáveis não substituídas** | Sintaxe errada | Usar `{{$json.campo}}` e não `${campo}` |

---

### 6.5 Monitorização Recomendada

**Métricas-chave:**

- ✅ **Taxa de entrega WhatsApp** (target: >95%)
- ✅ **Taxa de clique em action links** (target: >40%)
- ✅ **Taxa de sucesso de callbacks** (target: >99%)
- ✅ **Falhas HMAC** (alerta se >0)
- ✅ **Tempo médio de resposta** (target: <3s)

**Logs:**

```json
{
  "timestamp": "2026-01-28T15:00:00Z",
  "workflow": "pre_confirmation",
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "event": "whatsapp_sent",
  "success": true,
  "message_id": "whatsapp_msg_abc123",
  "delivery_status": "delivered",
  "response_time_ms": 1250
}
```

---

### 6.6 Go-Live Checklist

- [ ] Todos os 7 workflows testados em staging
- [ ] HMAC funcionando em ambas direções
- [ ] WhatsApp API credentials válidas
- [ ] Action links com domínio correto
- [ ] Error handling e retries configurados
- [ ] Monitorização e alertas ativos
- [ ] Teste com 5 consultas reais
- [ ] Documentação interna criada
- [ ] Equipa Barnun notificada da data de go-live
- [ ] Plano de rollback documentado

---

## 📞 Suporte Técnico

### Contactos

**Email:** dev@barnum.DOMAIN.com  
**Telefone:** +351 XXX XXX XXX  
**Horário:** Segunda a Sexta, 9h-18h

### Documentação Adicional

**API Docs:** https://docs.barnum.DOMAIN.com  
**Status Page:** https://status.barnum.DOMAIN.com

---

## 📄 Apêndice A: Código Completo HMAC

### Implementação Node.js (para n8n)

```javascript
/**
 * Gerar assinatura HMAC SHA-256
 * @param {Object|string} payload - Dados a assinar
 * @param {string} secret - Chave secreta partilhada
 * @returns {string} Assinatura em hexadecimal
 */
function generateHMAC(payload, secret) {
  const crypto = require('crypto');
  
  // Converter para string se for objeto
  const payloadString = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload);
  
  // Gerar HMAC
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  
  return hmac.digest('hex');
}

/**
 * Verificar assinatura HMAC SHA-256
 * @param {Object|string} payload - Dados recebidos
 * @param {string} signature - Assinatura recebida
 * @param {string} secret - Chave secreta partilhada
 * @returns {boolean} True se válido
 */
function verifyHMAC(payload, signature, secret) {
  const crypto = require('crypto');
  
  // Gerar assinatura esperada
  const expectedSignature = generateHMAC(payload, secret);
  
  // Comparação timing-safe
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  // Verificar tamanhos primeiro
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  // Comparação segura contra timing attacks
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

// === USO NO N8N ===

// Verificar webhook recebido
const payload = $input.item.json;
const receivedSig = $input.item.headers['x-webhook-signature'];
const secret = '{{$env.WEBHOOK_SECRET}}';

if (!verifyHMAC(payload, receivedSig, secret)) {
  throw new Error('HMAC inválido');
}

// Gerar HMAC para enviar
const payload = { action: 'confirm', appointmentId: 'uuid' };
const secret = '{{$env.WEBHOOK_SECRET}}';
const signature = generateHMAC(payload, secret);

return {
  json: {
    body: payload,
    signature: signature
  }
};
```

---

## 📄 Apêndice B: Formato Telefone E.164

**Formato correto:**
```
+351912345678
```

**Componentes:**
- `+` obrigatório
- `351` código do país (Portugal)
- `912345678` número (9 dígitos em PT)

**Formatos INCORRETOS:**
```
❌ 912345678        (falta +351)
❌ 351912345678     (falta +)
❌ +351 912 345 678 (tem espaços)
❌ +351-912-345-678 (tem hífens)
```

**Validação Regex:**
```javascript
/^\+351[0-9]{9}$/
```

---

## 📄 Apêndice C: Glossário

| Termo | Significado |
|-------|-------------|
| **HMAC** | Hash-based Message Authentication Code - método de autenticação |
| **SHA-256** | Algoritmo de hash criptográfico de 256 bits |
| **Webhook** | Callback HTTP automático |
| **Action Link** | URL clicável que executa ação no sistema |
| **Token** | String aleatória de autenticação de uso único |
| **Payload** | Dados JSON enviados no body do request |
| **Idempotência** | Propriedade que garante mesmo resultado em requests duplicados |
| **E.164** | Formato internacional de números de telefone |
| **Timing-safe** | Comparação segura contra ataques de timing |

---

**FIM DO DOCUMENTO**

---

**Versão:** 1.0  
**Última Atualização:** 28 de Janeiro de 2026  
**Próxima Revisão:** Após mudanças na API
