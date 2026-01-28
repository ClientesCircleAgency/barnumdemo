# Barnum WhatsApp Integration - n8n Implementation Guide

**Version:** 1.0  
**Last Updated:** 2026-01-28  
**Target Audience:** n8n Integration Partner

---

## 📋 Overview

This document provides complete technical specifications for integrating Barnum's appointment system with n8n workflows via WhatsApp automation.

**Integration Type:** Webhook-based (bidirectional)  
**Protocol:** HTTPS POST with HMAC signature verification  
**Format:** JSON  
**Endpoints:** 2 main endpoints (inbound from n8n, outbound to n8n)

---

## 🔄 Integration Flow

```
┌─────────────┐         Outbound Events         ┌─────────────┐
│   BARNUM    │ ──────────────────────────────> │     n8n     │
│  (Trigger)  │   POST with HMAC signature      │  (Receive)  │
└─────────────┘                                 └─────────────┘
                                                       │
                                                       │ Process
                                                       │ Send WhatsApp
                                                       │
                                                       ▼
                                                  ┌─────────────┐
                                                  │  WhatsApp   │
                                                  │   Patient   │
                                                  └─────────────┘
                                                       │
                                                       │ Click link
                                                       │ or reply
                                                       ▼
┌─────────────┐         Inbound Callback        ┌─────────────┐
│   BARNUM    │ <────────────────────────────── │     n8n     │
│  (Receive)  │   POST with HMAC signature      │   (Send)    │
└─────────────┘                                 └─────────────┘
```

---

## 🌐 Endpoints

### 1. **Outbound** (n8n receives events from Barnum)

**URL:** `https://YOUR-N8N-DOMAIN.com/webhook/whatsapp-barnum`  
**Method:** POST  
**Purpose:** Barnum sends appointment events to n8n for WhatsApp processing

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: {HMAC-SHA256-signature}
X-Idempotency-Key: {eventId}-{timestamp}
X-Event-Id: {uuid}
X-Event-Type: {event_type}
```

---

### 2. **Inbound** (Barnum receives callbacks from n8n)

**URL:** `https://barnum.DOMAIN.com/api/webhook`  
**Method:** POST  
**Purpose:** n8n sends patient responses/actions back to Barnum

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: {HMAC-SHA256-signature} (optional but recommended)
```

---

## 🔐 Security - HMAC Signature

### How to Generate HMAC Signature (Outbound)

**When n8n RECEIVES from Barnum:**

n8n must **verify** the signature sent by Barnum:

```javascript
// In n8n HTTP Request node (Function node for verification)
const crypto = require('crypto');

const secret = 'YOUR_WEBHOOK_SECRET'; // Same as configured in Barnum
const payload = JSON.stringify($input.item.json); // The received body
const receivedSignature = $input.item.headers['x-webhook-signature'];

// Generate expected signature
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const expectedSignature = hmac.digest('hex');

// Verify
if (receivedSignature !== expectedSignature) {
  throw new Error('Invalid HMAC signature');
}

// Continue processing...
```

### How to Generate HMAC Signature (Inbound)

**When n8n SENDS to Barnum:**

n8n must **generate** and send the signature:

```javascript
// In n8n Function node (before HTTP Request to Barnum)
const crypto = require('crypto');

const secret = 'YOUR_WEBHOOK_SECRET'; // Same as configured in Barnum
const payload = {
  action: 'confirm',
  appointmentId: '{{$json.appointmentId}}',
  patientResponse: 'confirmed'
};

const payloadString = JSON.stringify(payload);

// Generate signature
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payloadString);
const signature = hmac.digest('hex');

return {
  json: {
    body: payload,
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature
    }
  }
};
```

---

## 📨 Automation Payloads

### 1️⃣ PRE_CONFIRMATION

**Trigger:** New appointment created (status = 'scheduled')  
**Timing:** Immediately after appointment creation  
**Purpose:** Send initial confirmation request to patient

#### **Outbound Payload (Barnum → n8n)**

**Endpoint:** n8n webhook  
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
      "name": "Dr. Maria Santos"
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
    "confirm": "https://barnum.DOMAIN.com/api/action?type=confirm&token=abc123def456ghi789",
    "cancel": "https://barnum.DOMAIN.com/api/action?type=cancel&token=xyz789uvw456rst123"
  }
}
```

#### **WhatsApp Message Template**

```
Olá {{appointment.patient.name}}! 👋

A sua consulta de {{appointment.specialty.name}} está marcada:

📅 Data: {{appointment.date}}
🕐 Hora: {{appointment.time}}
👨‍⚕️ Profissional: {{appointment.professional.name}}

Por favor, confirme a sua presença:
✅ Confirmar: {{action_links.confirm}}
❌ Cancelar: {{action_links.cancel}}
```

#### **Inbound Callback (n8n → Barnum)**

**Not required** - Patient clicks action link directly (handled by `/api/action`)

---

### 2️⃣ TIME_SUGGESTION

**Trigger:** Manual trigger or no available slots  
**Timing:** On-demand  
**Purpose:** Suggest alternative times to patient

#### **Outbound Payload (Barnum → n8n)**

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
      "professional": "Dr. Pedro Alves"
    },
    {
      "date": "2026-02-05",
      "time": "14:30",
      "professional": "Dr. Pedro Alves"
    },
    {
      "date": "2026-02-06",
      "time": "10:00",
      "professional": "Dra. Ana Silva"
    }
  ],
  "action_links": {
    "slot_1": "https://barnum.DOMAIN.com/api/action?type=confirm&token=slot1token123",
    "slot_2": "https://barnum.DOMAIN.com/api/action?type=confirm&token=slot2token456",
    "slot_3": "https://barnum.DOMAIN.com/api/action?type=confirm&token=slot3token789"
  }
}
```

#### **WhatsApp Message Template**

```
Olá {{patient.name}}! 👋

Temos as seguintes opções disponíveis para {{specialty.name}}:

1️⃣ {{suggested_slots[0].date}} às {{suggested_slots[0].time}}
   Com: {{suggested_slots[0].professional}}
   👉 {{action_links.slot_1}}

2️⃣ {{suggested_slots[1].date}} às {{suggested_slots[1].time}}
   Com: {{suggested_slots[1].professional}}
   👉 {{action_links.slot_2}}

3️⃣ {{suggested_slots[2].date}} às {{suggested_slots[2].time}}
   Com: {{suggested_slots[2].professional}}
   👉 {{action_links.slot_3}}

Clique na sua opção preferida para confirmar!
```

#### **Inbound Callback (n8n → Barnum)**

**Not required** - Patient clicks action link directly

---

### 3️⃣ CONFIRMATION_24H

**Trigger:** Appointment confirmed, 24h before appointment  
**Timing:** -24 hours before appointment date/time  
**Purpose:** Reminder for confirmed appointments

#### **Outbound Payload (Barnum → n8n)**

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
    "confirm_presence": "https://barnum.DOMAIN.com/api/action?type=confirm&token=conf24h123abc",
    "reschedule": "https://barnum.DOMAIN.com/api/action?type=reschedule&token=resc24h456def",
    "cancel": "https://barnum.DOMAIN.com/api/action?type=cancel&token=canc24h789ghi"
  }
}
```

#### **WhatsApp Message Template**

```
🔔 LEMBRETE: Consulta amanhã!

Olá {{appointment.patient.name}},

A sua consulta está confirmada para:

📅 {{appointment.date}} às {{appointment.time}}
👨‍⚕️ {{appointment.professional.name}}
🏥 {{appointment.specialty.name}}

⚠️ Importante: {{appointment.notes}}

Opções:
✅ Confirmar presença: {{action_links.confirm_presence}}
📅 Reagendar: {{action_links.reschedule}}
❌ Cancelar: {{action_links.cancel}}
```

#### **Inbound Callback (n8n → Barnum)**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

**If patient confirms via WhatsApp text (not link):**

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

### 4️⃣ NO_SHOW_RESCHEDULE

**Trigger:** Appointment marked as 'no_show'  
**Timing:** +1 hour after no-show  
**Purpose:** Offer reschedule to patients who missed appointment

#### **Outbound Payload (Barnum → n8n)**

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
    "reschedule": "https://barnum.DOMAIN.com/api/action?type=reschedule&token=noshow123resc"
  }
}
```

#### **WhatsApp Message Template**

```
Olá {{appointment.patient.name}},

Notámos que não compareceu à sua consulta de {{appointment.specialty.name}} hoje às {{appointment.time}}.

Gostaríamos de reagendar? Temos disponibilidade:

📅 {{reschedule_options[0].date}} às {{reschedule_options[0].time}}
📅 {{reschedule_options[1].date}} às {{reschedule_options[1].time}}

👉 Clique aqui para reagendar: {{action_links.reschedule}}

Ou responda com a opção preferida.
```

#### **Inbound Callback (n8n → Barnum)**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

**When patient responds:**

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

### 5️⃣ PATIENT_CANCEL_RESCHEDULE

**Trigger:** Patient cancels appointment  
**Timing:** Immediately after cancellation  
**Purpose:** Offer immediate reschedule

#### **Outbound Payload (Barnum → n8n)**

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
    "cancellation_reason": "Patient request",
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
      "professional": "Dra. Inês Carvalho"
    },
    {
      "date": "2026-02-13",
      "time": "10:30",
      "professional": "Dra. Inês Carvalho"
    },
    {
      "date": "2026-02-15",
      "time": "16:00",
      "professional": "Dr. Miguel Santos"
    }
  ],
  "action_links": {
    "slot_1": "https://barnum.DOMAIN.com/api/action?type=confirm&token=canresc1abc",
    "slot_2": "https://barnum.DOMAIN.com/api/action?type=confirm&token=canresc2def",
    "slot_3": "https://barnum.DOMAIN.com/api/action?type=confirm&token=canresc3ghi"
  }
}
```

#### **WhatsApp Message Template**

```
Olá {{appointment.patient.name}},

A sua consulta de {{appointment.specialty.name}} foi cancelada.

Gostaria de reagendar? Temos as seguintes opções:

1️⃣ {{alternative_slots[0].date}} às {{alternative_slots[0].time}}
   Com: {{alternative_slots[0].professional}}
   👉 {{action_links.slot_1}}

2️⃣ {{alternative_slots[1].date}} às {{alternative_slots[1].time}}
   Com: {{alternative_slots[1].professional}}
   👉 {{action_links.slot_2}}

3️⃣ {{alternative_slots[2].date}} às {{alternative_slots[2].time}}
   Com: {{alternative_slots[2].professional}}
   👉 {{action_links.slot_3}}

Ou responda com outra data de preferência.
```

#### **Inbound Callback (n8n → Barnum)**

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

### 6️⃣ REVIEW_REMINDER

**Trigger:** Appointment completed (status = 'completed')  
**Timing:** +2 hours after appointment completion  
**Purpose:** Request patient review/feedback

#### **Outbound Payload (Barnum → n8n)**

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

#### **WhatsApp Message Template**

```
Olá {{appointment.patient.name}}! 😊

Esperamos que tenha gostado da sua consulta de {{appointment.specialty.name}} com {{appointment.professional.name}}.

⭐ A sua opinião é muito importante para nós!

Por favor, deixe uma avaliação:
👉 Review: {{review_link}}

Ou deixe uma avaliação no Google:
👉 Google: {{google_review_link}}

Muito obrigado! 🙏
```

#### **Inbound Callback (n8n → Barnum)**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

**When patient submits review:**

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

**If patient declines:**

```json
{
  "action": "review",
  "appointmentId": "d7e8f9a0-b1c2-0d1e-3f4a-5b6c7d8e9f0a",
  "reviewSubmitted": false,
  "timestamp": "2026-01-28T15:30:00Z"
}
```

---

### 7️⃣ REACTIVATION

**Trigger:** Patient inactive for 30/60/90 days  
**Timing:** Scheduled campaign  
**Purpose:** Re-engage inactive patients

#### **Outbound Payload (Barnum → n8n)**

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
    "last_appointment_date": "2025-10-15",
    "days_inactive": 105,
    "total_appointments": 3,
    "last_specialty": "Medicina Dentária",
    "preferred_professional": "Dra. Carla Reis"
  },
  "campaign": {
    "type": "reactivation_90d",
    "segment": "inactive_patients",
    "offer": "10% discount on next appointment"
  },
  "suggested_specialties": [
    "Medicina Dentária",
    "Higiene Oral",
    "Branqueamento"
  ],
  "action_links": {
    "book_now": "https://barnum.DOMAIN.com/booking?patient={{patient.id}}&token=react123book",
    "view_offers": "https://barnum.DOMAIN.com/offers?token=react456view"
  }
}
```

#### **WhatsApp Message Template**

```
Olá {{patient.name}}! 👋

Sentimos a sua falta! 🦷

Não nos visita há {{patient.days_inactive}} dias. Está na hora de cuidar do seu sorriso!

🎁 OFERTA ESPECIAL: {{campaign.offer}}

Serviços disponíveis:
{% for specialty in suggested_specialties %}
• {{specialty}}
{% endfor %}

📅 Marque já: {{action_links.book_now}}
🎯 Ver ofertas: {{action_links.view_offers}}

Aguardamos o seu contacto!
```

#### **Inbound Callback (n8n → Barnum)**

**Endpoint:** `POST https://barnum.DOMAIN.com/api/webhook`

**When patient responds:**

```json
{
  "action": "reactivation",
  "patientId": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f",
  "campaignType": "reactivation_90d",
  "interested": true,
  "preferredSpecialty": "Higiene Oral",
  "responseText": "Gostaria de marcar consulta",
  "timestamp": "2026-01-28T10:30:00Z"
}
```

---

## 🔗 Action Links Reference

### How Action Links Work

1. **Barnum generates** secure token via `generate_action_token()` database function
2. **Token embedded** in WhatsApp message URL
3. **Patient clicks** link → opens in browser
4. **Barnum validates** token and performs action
5. **Patient sees** HTML success/error page
6. **Token marked** as used (cannot be reused)

---

### Action Link: CONFIRM

**URL:**
```
https://barnum.DOMAIN.com/api/action?type=confirm&token={{token}}
```

**What Happens:**
1. ✅ Validates token (`validate_action_token()`)
2. ✅ Checks token.action_type === 'confirm'
3. ✅ Updates `appointments.status = 'confirmed'`
4. ✅ Marks token as used (`mark_token_used()`)
5. ✅ Updates `whatsapp_workflows.status = 'completed'`
6. ✅ Returns HTML page: "Consulta Confirmada! ✅"

**Expected Result:**
- Patient sees green success page
- Appointment status: `confirmed`
- Workflow status: `completed`

---

### Action Link: CANCEL

**URL:**
```
https://barnum.DOMAIN.com/api/action?type=cancel&token={{token}}
```

**What Happens:**
1. ✅ Validates token
2. ✅ Checks token.action_type === 'cancel'
3. ✅ Updates `appointments.status = 'cancelled'`
4. ✅ Marks token as used
5. ✅ Updates `whatsapp_workflows.status = 'cancelled'`
6. ✅ Returns HTML page: "Consulta Cancelada ❌"

**Expected Result:**
- Patient sees red cancellation page
- Appointment status: `cancelled`
- Workflow status: `cancelled`

---

### Action Link: RESCHEDULE

**URL:**
```
https://barnum.DOMAIN.com/api/action?type=reschedule&token={{token}}
```

**What Happens:**
1. ✅ Validates token
2. ✅ Checks token.action_type === 'reschedule'
3. ✅ Marks token as used
4. ✅ Updates workflow: `response = 'reschedule requested via link'`
5. ✅ Returns HTML page: "Pedido de Reagendamento 📅"
6. 📧 **Barnum team notified** to contact patient

**Expected Result:**
- Patient sees blue info page
- Admin receives notification
- Patient expects contact for rescheduling

---

## ✅ n8n Configuration Checklist

### 1. **Environment Setup**

#### Required Environment Variables in n8n

```bash
# Webhook URLs
BARNUM_WEBHOOK_URL=https://barnum.DOMAIN.com/api/webhook
BARNUM_DOMAIN=barnum.DOMAIN.com

# Security
WEBHOOK_SECRET=your-shared-secret-key-min-32-chars
INTERNAL_API_SECRET=your-internal-api-secret

# WhatsApp API (your provider)
WHATSAPP_API_URL=https://your-whatsapp-provider.com/api
WHATSAPP_API_TOKEN=your-whatsapp-token
```

---

### 2. **Webhook Configuration**

#### Inbound Webhook (Receive from Barnum)

**Create:** HTTP Webhook Trigger node

**Settings:**
- **Path:** `/webhook/whatsapp-barnum`
- **Method:** POST
- **Authentication:** None (use HMAC verification)
- **Response Code:** 200

**HMAC Verification (Function node after webhook):**
```javascript
const crypto = require('crypto');
const secret = '{{$env.WEBHOOK_SECRET}}';
const payload = JSON.stringify($input.item.json);
const receivedSig = $input.item.headers['x-webhook-signature'];

const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const expectedSig = hmac.digest('hex');

if (receivedSig !== expectedSig) {
  throw new Error('Invalid HMAC signature');
}

return $input.item.json; // Pass through if valid
```

---

#### Outbound HTTP Request (Send to Barnum)

**Create:** HTTP Request node

**Settings:**
- **Method:** POST
- **URL:** `{{$env.BARNUM_WEBHOOK_URL}}`
- **Headers:**
  ```json
  {
    "Content-Type": "application/json",
    "X-Webhook-Signature": "{{$node.GenerateHMAC.json.signature}}"
  }
  ```
- **Body:**
  ```json
  {
    "action": "{{$json.action}}",
    "appointmentId": "{{$json.appointmentId}}",
    ...
  }
  ```

**HMAC Generation (Function node before HTTP Request):**
```javascript
const crypto = require('crypto');
const secret = '{{$env.WEBHOOK_SECRET}}';
const payload = {
  action: '{{$json.action}}',
  appointmentId: '{{$json.appointmentId}}',
  // ... other fields
};

const payloadString = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payloadString);
const signature = hmac.digest('hex');

return {
  json: {
    signature: signature,
    payload: payload
  }
};
```

---

### 3. **WhatsApp Message Templates**

#### Required Fields for Each Template

**All messages must include:**
- ✅ Patient phone number (with country code)
- ✅ Patient name
- ✅ Message body with variables replaced
- ✅ Action link URLs (where applicable)

**Template Variables:**
- Use `{{variable}}` syntax
- URL-encode action links
- Test with real phone numbers first

---

### 4. **Workflow Structure (Recommended)**

#### Main Workflow: Event Router

```
[Webhook Trigger] 
    → [HMAC Verify]
    → [Switch: event_type]
        ├→ pre_confirmed → [Sub-workflow: Pre-Confirmation]
        ├→ confirmation_24h → [Sub-workflow: 24h Reminder]
        ├→ no_show_reschedule → [Sub-workflow: No-Show]
        ├→ patient_cancelled → [Sub-workflow: Cancel Reschedule]
        ├→ review_reminder → [Sub-workflow: Review]
        └→ reactivation → [Sub-workflow: Reactivation]
```

#### Sub-workflow Example: Pre-Confirmation

```
[Trigger]
    → [Extract Patient Data]
    → [Format Message]
    → [Send WhatsApp]
    → [Log Success]
    → [Error Handler]
```

---

### 5. **Error Handling**

#### Required Error Nodes

**For each workflow:**
- ✅ **Retry Logic:** Max 3 retries with exponential backoff
- ✅ **Error Logging:** Log to database or monitoring service
- ✅ **Fallback:** Send email/SMS if WhatsApp fails
- ✅ **Alert:** Notify team on critical failures

**Error Response to Barnum:**
```json
{
  "success": false,
  "error": "WhatsApp delivery failed",
  "errorCode": "WHATSAPP_500",
  "timestamp": "2026-01-28T15:00:00Z"
}
```

---

### 6. **Testing Checklist**

#### Manual Tests

- [ ] **Test 1:** Receive event from Barnum → Verify HMAC passes
- [ ] **Test 2:** Send WhatsApp message → Verify patient receives
- [ ] **Test 3:** Click action link → Verify Barnum updates correctly
- [ ] **Test 4:** Send callback to Barnum → Verify HMAC generated correctly
- [ ] **Test 5:** Error scenario → Verify retry logic works
- [ ] **Test 6:** Invalid HMAC → Verify rejection (401)
- [ ] **Test 7:** Expired token → Verify error page shown

#### Automated Tests (Recommended)

```bash
# Test webhook endpoint
curl -X POST https://YOUR-N8N-DOMAIN.com/webhook/whatsapp-barnum \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: YOUR_HMAC_HERE" \
  -d '{
    "event_type": "appointment.pre_confirmed",
    "appointment": {...}
  }'

# Test Barnum callback
curl -X POST https://barnum.DOMAIN.com/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: YOUR_HMAC_HERE" \
  -d '{
    "action": "confirm",
    "appointmentId": "test-uuid"
  }'
```

---

### 7. **Monitoring & Logs**

#### Required Metrics

- **Message Delivery Rate:** % of successful WhatsApp sends
- **Action Link Clicks:** Track clicks per message type
- **Callback Success Rate:** % of successful Barnum callbacks
- **HMAC Failures:** Security monitoring
- **Average Response Time:** Patient engagement metrics

#### Logging Format

```json
{
  "timestamp": "2026-01-28T15:00:00Z",
  "workflow": "pre_confirmation",
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "event": "whatsapp_sent",
  "success": true,
  "message_id": "whatsapp_msg_id",
  "delivery_status": "delivered",
  "response_time_ms": 1250
}
```

---

### 8. **Go-Live Checklist**

- [ ] All 7 workflows created and tested
- [ ] HMAC signature verification working both ways
- [ ] Environment variables configured
- [ ] WhatsApp API credentials valid
- [ ] Action link domain configured correctly
- [ ] Error handling and retries in place
- [ ] Monitoring and logging configured
- [ ] Test with 5 real appointments
- [ ] Barnum team notified of go-live date
- [ ] Rollback plan documented

---

## 📞 Support & Contact

**Technical Support:**  
Email: dev@barnum.DOMAIN.com  
Slack: #whatsapp-integration (if applicable)

**Barnum API Documentation:**  
https://docs.barnum.DOMAIN.com/webhooks

**Webhook Status Page:**  
https://status.barnum.DOMAIN.com

---

## 📄 Appendix

### A. Sample HMAC Implementation (Node.js)

```javascript
// Generate HMAC signature
function generateHMAC(payload, secret) {
  const crypto = require('crypto');
  const payloadString = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload);
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  return hmac.digest('hex');
}

// Verify HMAC signature
function verifyHMAC(payload, signature, secret) {
  const expectedSignature = generateHMAC(payload, secret);
  
  // Timing-safe comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

// Usage in n8n
const payload = $input.item.json;
const secret = '{{$env.WEBHOOK_SECRET}}';
const receivedSig = $input.item.headers['x-webhook-signature'];

if (!verifyHMAC(payload, receivedSig, secret)) {
  throw new Error('Invalid HMAC signature');
}
```

---

### B. Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| HMAC verification fails | Signature mismatch | Ensure same secret, same payload format (stringify) |
| 401 Unauthorized | Missing/invalid HMAC | Check X-Webhook-Signature header |
| Action link expired | Token expired | Tokens valid for 7 days by default |
| Token already used | Duplicate click | Each token can only be used once |
| WhatsApp not delivered | Invalid phone format | Use E.164 format: +351XXXXXXXXX |
| Callback timeout | Slow Barnum response | Implement timeout (30s recommended) |

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Next Review:** Upon API changes

---

**END OF DOCUMENT**
