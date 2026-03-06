# Guia Completo para o Parceiro n8n — Barnum

> **Versão:** 2.1 — 2026-02-06
> **Destinatário:** Parceiro técnico responsável pelas automações WhatsApp via n8n
> **Idioma:** Português (Portugal) com termos técnicos em inglês quando necessário

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Autenticação](#3-autenticação)
4. [Variáveis de Ambiente](#4-variáveis-de-ambiente)
5. [Supabase DB Webhooks](#5-supabase-db-webhooks)
6. [Endpoints do Backend](#6-endpoints-do-backend)
7. [Automações WhatsApp (1-6)](#7-automações-whatsapp-1-6)
8. [Tabelas da Base de Dados Relevantes](#8-tabelas-da-base-de-dados-relevantes)
9. [Fluxo Completo de Eventos](#9-fluxo-completo-de-eventos)
10. [Exemplos de Workflows n8n](#10-exemplos-de-workflows-n8n)
11. [Checklist do Parceiro](#11-checklist-do-parceiro)
12. [FAQ e Troubleshooting](#12-faq-e-troubleshooting)

---

## 1. Visão Geral

O Barnum é uma plataforma de gestão de clínicas. Quando certas ações acontecem na plataforma (marcar consulta, cancelar, finalizar, etc.), o Supabase envia automaticamente os dados da alteração para o n8n via **Database Webhooks**. O n8n é responsável por:

1. **Receber** eventos em tempo real via webhooks
2. **Compor e enviar** mensagens WhatsApp aos pacientes (lembretes one-way)
3. **Processar** respostas de pacientes apenas para no-show (reagendamento) e review

**Regra fundamental:** O n8n é o ÚNICO responsável por decidir **quando** e **como** executar ações. O backend NÃO tem cron jobs, triggers de WhatsApp, nem tabelas intermediárias — é puramente reativo.

**Nota importante:** As mensagens de nova consulta (AUT-1) e lembrete 24h (AUT-2) são **informativas e one-way** — o paciente NÃO confirma nem cancela via WhatsApp. Isto evita confusão com slots preenchidos por outros pacientes quando a mensagem não é vista.

**Mudança v2.0:** A arquitetura anterior usava tabelas `whatsapp_events`/`whatsapp_workflows` como outbox e endpoints de polling. Estes foram **removidos**. O Supabase agora envia eventos diretamente ao n8n via DB Webhooks.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    BARNUM (Supabase)                   │
│                                                       │
│  ┌─────────────┐    ┌──────────────────┐             │
│  │  UI (React)  │───>│  PostgreSQL (DB)  │             │
│  └─────────────┘    │                    │             │
│                      │  appointments     │──────────┐ │
│                      │  appointment_     │          │ │
│                      │    requests       │          │ │
│                      └──────────────────┘          │ │
│                              │                      │ │
│                              │ DB Webhooks           │ │
│                              │ (INSERT/UPDATE)       │ │
│                              ▼                       │ │
│  ┌──────────────────────────────────┐              │ │
│  │  Vercel API Endpoints            │              │ │
│  │  /api/webhook               <───│──────────────│─│─── n8n envia respostas
│  │  /api/action                <───│──────────────│─│─── Paciente clica link
│  └──────────────────────────────────┘              │ │
└─────────────────────────────────────────────────────┘
                                                      │
                 ┌────────────────────────────────────┘
                 │  HTTP POST (real-time)
                 ▼
┌─────────────────────────────────────────────────────┐
│                    n8n (Externo)                      │
│                                                       │
│  Webhook Node: recebe dados de appointments          │
│  Webhook Node: recebe dados de appointment_requests  │
│  Switch Node: decide automação por tipo de evento    │
│  Supabase Node: lookup de paciente/profissional      │
│  WhatsApp Node: envia mensagens                      │
│  CRON Node: lembrete 24h (diário 08:00)              │
│  Webhook Node: receber respostas → /api/webhook      │
└─────────────────────────────────────────────────────┘
```

---

## 3. Autenticação

### Para DB Webhooks (Supabase → n8n)

O Supabase DB Webhook pode incluir um header customizado para autenticar:

```
Authorization: Bearer <DB_WEBHOOK_SECRET>
```

O n8n deve validar este header no Webhook Node antes de processar.

### Para o endpoint `/api/webhook` (n8n → Backend)

**Header obrigatório:**
```
x-webhook-signature: <HMAC-SHA256 do body com WEBHOOK_SECRET>
```

Como calcular o HMAC no n8n:
1. Usar um nó "Crypto" ou "Function"
2. Input: o body JSON do request (como string)
3. Chave: o valor de `WEBHOOK_SECRET`
4. Algoritmo: HMAC-SHA256
5. Output: hex string

---

## 4. Variáveis de Ambiente

Variáveis que devem estar configuradas **no n8n**:

| Variável | Onde obter | Para quê |
|----------|-----------|----------|
| `DB_WEBHOOK_SECRET` | Combinar com o admin do Barnum | Validar que os webhooks vêm do Supabase |
| `WEBHOOK_SECRET` | Combinar com o admin do Barnum | Assinar callbacks para /api/webhook |
| `BARNUM_API_URL` | URL do Vercel (ex: `https://barnumdemo.vercel.app`) | Base URL para chamadas ao backend |
| `SUPABASE_URL` | Dashboard do Supabase | Para lookups de dados (paciente, profissional) |
| `SUPABASE_ANON_KEY` | Dashboard do Supabase | Para autenticar lookups REST |

Variáveis que devem estar configuradas **no Vercel** (pelo admin do Barnum):

| Variável | Valor |
|----------|-------|
| `WEBHOOK_SECRET` | Mesmo valor configurado no n8n |

---

## 5. Supabase DB Webhooks

O n8n recebe dados em tempo real via 2 DB Webhooks configurados no Supabase Dashboard.

### Webhook 1: `appointments` (INSERT + UPDATE)

**Eventos:** Cada vez que uma consulta é criada ou atualizada, o Supabase envia um POST para o n8n.

**Payload automático (exemplo para UPDATE):**
```json
{
  "type": "UPDATE",
  "table": "appointments",
  "schema": "public",
  "record": {
    "id": "uuid-da-consulta",
    "patient_id": "uuid-do-paciente",
    "professional_id": "uuid-do-profissional",
    "specialty_id": "uuid-da-especialidade",
    "consultation_type_id": "uuid-do-tipo",
    "date": "2026-02-10",
    "time": "14:00",
    "duration": 30,
    "status": "confirmed",
    "notes": "...",
    "final_notes": null,
    "finalized_at": null,
    "cancellation_reason": null,
    "created_at": "2026-02-04T10:00:00Z",
    "updated_at": "2026-02-04T12:00:00Z"
  },
  "old_record": {
    "id": "uuid-da-consulta",
    "status": "scheduled",
    "finalized_at": null
  }
}
```

**Como o n8n decide o que fazer (Switch Node):**

| Condição | Automação |
|----------|-----------|
| `type == INSERT` | AUT-1: Notificação de nova consulta (lembrete one-way) |
| `type == UPDATE` AND `old_record.status != cancelled` AND `record.status == cancelled` | AUT-5: Cancelamento |
| `type == UPDATE` AND `old_record.status != no_show` AND `record.status == no_show` | AUT-3: Reagendamento no-show |
| `type == UPDATE` AND `old_record.finalized_at == null` AND `record.finalized_at != null` | AUT-6: Review (enviar 2h depois via Wait node) |

### Webhook 2: `appointment_requests` (UPDATE)

**Eventos:** Quando o status de um pedido de marcação muda.

**Payload automático (exemplo):**
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
    "status": "rejected",
    "notes": "..."
  },
  "old_record": {
    "status": "pending"
  }
}
```

**Lógica:**

| Condição | Automação |
|----------|-----------|
| `old_record.status == pending` AND `record.status == rejected` | AUT-4: Notificação de rejeição |

### Lookup de dados adicionais

O payload do webhook contém apenas IDs (ex: `patient_id`). Para obter nome e telefone do paciente:

```
GET {SUPABASE_URL}/rest/v1/patients?id=eq.{patient_id}&select=name,phone,email
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
```

Similarmente para profissionais, especialidades e tipos de consulta.

---

## 6. Endpoints do Backend

### 6.1 POST `/api/webhook`

**O que faz:** Recebe respostas/ações dos pacientes (vindas do n8n após processar respostas WhatsApp).

**Quando chamar:** Quando o paciente responde a uma mensagem WhatsApp (apenas para no-show reschedule ou review).

**Nota:** As mensagens de nova consulta (AUT-1) e lembrete 24h (AUT-2) são one-way — o paciente NÃO responde. Este endpoint é usado apenas para ações de reagendamento e avaliação.

**Request:**
```http
POST /api/webhook
x-webhook-signature: <hmac-sha256-hex>
Content-Type: application/json

{
  "action": "reschedule",
  "appointmentId": "uuid-da-consulta",
  "patientPhone": "+351912345678",
  "metadata": {}
}
```

**Ações suportadas:**

| Action | O que faz |
|--------|----------|
| `cancel` | Marca consulta como `cancelled` |
| `reschedule` | Inicia fluxo de reagendamento |
| `no_show_reschedule` | Reagenda após no-show |
| `reactivation` | Reativa uma consulta cancelada |
| `review` | Regista avaliação do paciente |

**Response:**
```json
{
  "success": true,
  "action": "reschedule",
  "appointmentId": "uuid",
  "newStatus": "scheduled"
}
```

---

### 6.2 GET `/api/action`

**O que faz:** Links públicos que os pacientes clicam diretamente (ex: no WhatsApp). Valida o token e executa a ação.

**NÃO é chamado pelo n8n.** Pode ser incluído em mensagens WhatsApp como link clicável para ações específicas (cancelamento, review).

**Exemplo:**
```
https://barnumdemo.vercel.app/api/action?type=cancel&token=abc123
```

**Nota:** Não existe link de confirmação — as consultas são confirmadas pela secretária no dashboard.

---

## 7. Automações WhatsApp (1-6)

### Automação 1: Notificação de Nova Consulta (one-way)

**Trigger:** DB Webhook — `appointments` INSERT
**Condição:** `record.status` é `confirmed`

**O que o n8n deve fazer:**
1. Receber webhook
2. Fazer lookup do paciente: `GET /rest/v1/patients?id=eq.{record.patient_id}`
3. Fazer lookup do profissional: `GET /rest/v1/professionals?id=eq.{record.professional_id}`
4. Enviar mensagem WhatsApp informativa ao paciente (sem botões de confirmação):
   > "Olá [nome], a sua consulta com [Dr. X] está marcada para [data] às [hora]. Se precisar de cancelar ou reagendar, contacte-nos pelo [telefone da clínica]."

**Importante:** Esta mensagem é **one-way** — o paciente NÃO precisa de confirmar. A consulta já está confirmada no sistema.

---

### Automação 2: Lembrete 24h (one-way)

**Trigger:** CRON do n8n — diário às 08:00
**NÃO usa DB Webhook.** O n8n consulta diretamente a base de dados.

**Workflow:**
1. CRON: todos os dias às 08:00
2. Supabase Node: query
   ```
   GET /rest/v1/appointments?date=eq.{tomorrow}&status=eq.confirmed&select=*
   ```
3. Para cada consulta: lookup do paciente e enviar WhatsApp informativo (sem botões):
   > "Olá [nome], lembrete: tem consulta amanhã [data] às [hora] com [Dr. X]. Se precisar de cancelar ou reagendar, contacte-nos pelo [telefone da clínica]."

**Importante:** Esta mensagem é **one-way** — o paciente NÃO precisa de responder. É apenas um lembrete informativo.

---

### Automação 3: Reagendamento por No-Show

**Trigger:** DB Webhook — `appointments` UPDATE
**Condição:** `old_record.status != no_show` AND `record.status == no_show`

**O que o n8n deve fazer:**
1. Receber webhook
2. Lookup do paciente
3. Enviar mensagem WhatsApp:
   > "Olá [nome], reparámos que não compareceu à consulta de [data]. Gostaria de reagendar? Responda SIM ou contacte-nos."
4. Se o paciente responder, enviar para `/api/webhook` com `action: "reschedule"` ou `action: "cancel"`

---

### Automação 4: Notificação de Rejeição de Pedido

**Trigger:** DB Webhook — `appointment_requests` UPDATE
**Condição:** `old_record.status == pending` AND `record.status == rejected`

**O que o n8n deve fazer:**
1. Receber webhook (já tem `patient_name`, `patient_phone` no record)
2. Enviar mensagem WhatsApp:
   > "Olá [nome], infelizmente não nos foi possível agendar a consulta solicitada. Contacte-nos para mais informações."

---

### Automação 5: Notificação de Cancelamento

**Trigger:** DB Webhook — `appointments` UPDATE
**Condição:** `old_record.status != cancelled` AND `record.status == cancelled`

**O que o n8n deve fazer:**
1. Receber webhook
2. Lookup do paciente
3. Enviar mensagem WhatsApp:
   > "Olá [nome], a sua consulta de [data] às [hora] foi cancelada. Se desejar reagendar, contacte-nos."

---

### Automação 6: Lembrete de Avaliação

**Trigger:** DB Webhook — `appointments` UPDATE
**Condição:** `old_record.finalized_at == null` AND `record.finalized_at != null`

**O que o n8n deve fazer:**
1. Receber webhook
2. **Wait 2 horas** (usar Wait node no n8n)
3. Lookup do paciente
4. Enviar mensagem WhatsApp:
   > "Olá [nome], obrigado por visitar a nossa clínica! Gostaríamos de saber como correu a sua consulta. Avalie aqui: [link]"

---

## 8. Tabelas da Base de Dados Relevantes

### `appointments` (tabela central — fonte de eventos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único da consulta |
| `patient_id` | UUID | FK → patients |
| `professional_id` | UUID | FK → professionals |
| `specialty_id` | UUID | FK → specialties |
| `consultation_type_id` | UUID | FK → consultation_types |
| `date` | DATE | Data da consulta |
| `time` | TIME | Hora da consulta |
| `duration` | INTEGER | Duração em minutos |
| `status` | ENUM | `scheduled`, `pre_confirmed`, `confirmed`, `waiting`, `in_progress`, `completed`, `cancelled`, `no_show` |
| `notes` | TEXT | Notas da consulta |
| `final_notes` | TEXT | Notas de finalização |
| `finalized_at` | TIMESTAMPTZ | Quando foi finalizada |
| `cancellation_reason` | TEXT | Motivo do cancelamento |

### `appointment_requests` (pedidos de marcação)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `patient_name` | TEXT | Nome do paciente |
| `patient_phone` | TEXT | Telefone |
| `patient_email` | TEXT | Email |
| `specialty_id` | UUID | Especialidade pretendida |
| `preferred_date` | DATE | Data preferida |
| `preferred_time` | TEXT | `morning`, `afternoon`, `any` |
| `status` | TEXT | `pending`, `approved`, `rejected` |

### `patients` (para lookup)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `name` | TEXT | Nome |
| `phone` | TEXT | Telefone (para WhatsApp) |
| `email` | TEXT | Email |
| `nif` | TEXT | NIF |

### `professionals` (para lookup)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `name` | TEXT | Nome |
| `specialty_id` | UUID | FK → specialties |

### `whatsapp_action_tokens` (links de ação)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `token` | TEXT | Token único (na URL) |
| `action_type` | TEXT | `confirm`, `cancel`, `reschedule` |
| `appointment_id` | UUID | Consulta associada |
| `patient_id` | UUID | Paciente |
| `expires_at` | TIMESTAMPTZ | Expiração |
| `used_at` | TIMESTAMPTZ | Quando foi usado |

---

## 9. Fluxo Completo de Eventos

```
1. AÇÃO NA UI (ex: criar/cancelar/finalizar consulta)
        │
        v
2. Supabase DB atualiza appointments/appointment_requests
        │
        v
3. Supabase DB Webhook envia POST ao n8n (em tempo real)
        │
        v
4. n8n recebe dados (record + old_record)
        │
        v
5. n8n faz lookup de paciente/profissional via Supabase REST
        │
        v
6. n8n compõe e envia mensagem WhatsApp ao paciente
        │
        v
7. Paciente clica link OU responde mensagem
        │
        v
8a. Se clicou link → /api/action processa diretamente
8b. Se respondeu → n8n envia para /api/webhook
        │
        v
9. Backend atualiza estado da consulta
```

---

## 10. Exemplos de Workflows n8n

### Workflow 1: Eventos de Appointments (real-time)

```
[Webhook Node: recebe POST do Supabase]
    → [IF: Authorization header == Bearer {secret}]
    → [Switch: por tipo de evento]
        ├─ type==INSERT → [Lookup paciente] → [Enviar notificação nova consulta]
        ├─ status changed to "cancelled" → [Lookup paciente] → [Enviar cancelamento]
        ├─ status changed to "no_show" → [Lookup paciente] → [Enviar reagendamento]
        └─ finalized_at changed → [Wait 2h] → [Lookup paciente] → [Enviar review]
```

### Workflow 2: Lembrete 24h (diário às 08:00)

```
[CRON: 0 8 * * *]
    → [Supabase Node: SELECT appointments WHERE date = tomorrow AND status = confirmed]
    → [Loop: para cada consulta]
        → [Lookup paciente]
        → [Enviar WhatsApp de lembrete 24h (one-way)]
```

### Workflow 3: Eventos de Appointment Requests

```
[Webhook Node: recebe POST do Supabase]
    → [IF: Authorization header == Bearer {secret}]
    → [IF: old_record.status == pending AND record.status == rejected]
        → [Enviar WhatsApp de rejeição ao paciente]
```

### Workflow 4: Receber Respostas de Pacientes (apenas no-show e review)

```
[Webhook WhatsApp: mensagem recebida]
    → [Interpretar resposta (SIM/NÃO para reagendamento)]
    → [Mapear para action: reschedule/cancel]
    → [HTTP Request: POST /api/webhook com HMAC]
    → [Log resultado]
```

**Nota:** Este workflow só é ativado quando o paciente responde a mensagens de no-show (AUT-3). As mensagens de nova consulta (AUT-1) e lembrete 24h (AUT-2) são one-way e não esperam resposta.

---

## 11. Checklist do Parceiro

### Antes de começar
- [ ] Receber `DB_WEBHOOK_SECRET` do admin Barnum
- [ ] Receber `WEBHOOK_SECRET` do admin Barnum
- [ ] Receber URL do Vercel (ex: `https://barnumdemo.vercel.app`)
- [ ] Receber `SUPABASE_URL` e `SUPABASE_ANON_KEY` para lookups
- [ ] Configurar variáveis no n8n
- [ ] Acesso ao WhatsApp Business API (Twilio, 360dialog, ou outro)

### Implementar
- [ ] Workflow 1: Webhook para `appointments` (INSERT + UPDATE)
- [ ] Workflow 2: CRON diário para lembrete 24h (one-way)
- [ ] Workflow 3: Webhook para `appointment_requests` (UPDATE)
- [ ] Workflow 4: Receber respostas → /api/webhook
- [ ] Templates WhatsApp aprovados (6 automações — AUT-1 e AUT-2 são one-way sem botões)

### Testar
- [ ] Criar consulta na UI → verificar que webhook chega ao n8n → mensagem one-way enviada
- [ ] Cancelar consulta → verificar que webhook de update chega
- [ ] Marcar no-show → verificar que webhook de update chega → resposta do paciente funciona
- [ ] Finalizar consulta → verificar que webhook de update chega com `finalized_at`
- [ ] Testar CRON de lembrete 24h com consultas de amanhã
- [ ] Rejeitar pedido → verificar que webhook de `appointment_requests` chega

### Produção
- [ ] Confirmar que DB Webhooks estão configurados no Supabase Dashboard
- [ ] Confirmar que `WEBHOOK_SECRET` está definido no Vercel
- [ ] Monitorizar logs durante primeiros dias
- [ ] Configurar alertas para falhas de envio

---

## 12. FAQ e Troubleshooting

**P: O webhook não chega ao n8n.**
R: Verificar no Supabase Dashboard → Database → Webhooks que os webhooks estão ativos e a URL do n8n está correta. Verificar logs do webhook no Supabase.

**P: Recebo 401 no /api/webhook.**
R: Verificar que o header `x-webhook-signature` está correto e corresponde ao HMAC calculado com `WEBHOOK_SECRET`.

**P: O HMAC não valida no /api/webhook.**
R: Verificar que está a calcular o HMAC sobre o body **exato** (como string JSON), usando SHA-256, e que o `WEBHOOK_SECRET` é o mesmo nos dois lados.

**P: Como obter dados do paciente a partir do patient_id?**
R: Usar o Supabase Node ou HTTP Request:
```
GET {SUPABASE_URL}/rest/v1/patients?id=eq.{patient_id}&select=name,phone,email
```

**P: Como testar sem WhatsApp?**
R: Inserir/atualizar registos diretamente na tabela `appointments` via Supabase SQL Editor. O webhook será disparado e poderá verificar que o n8n o recebe.

**P: Os webhooks são idempotentes?**
R: Não automaticamente. O n8n deve implementar lógica de deduplicação se necessário (ex: guardar `record.id + record.updated_at` para evitar processar o mesmo evento duas vezes).

---

## Removido na v2.0

Os seguintes componentes foram **removidos** e NÃO devem ser usados:

- Tabela `whatsapp_events` (outbox)
- Tabela `whatsapp_workflows` (workflow tracking)
- Endpoint `/api/n8n/process-events`
- Endpoint `/api/n8n/create-24h-confirmations`
- Endpoint `/api/internal`
- Triggers PostgreSQL (`trigger_pre_confirmation`, `trigger_no_show`, `trigger_review`)
- Função `create_whatsapp_event()`

---

## Contacto

Para questões sobre endpoints, payloads, ou comportamento do backend:
- Consultar `docs/contracts/SUPABASE_DB_WEBHOOKS_SETUP.md` para setup dos webhooks
- Contactar o admin do Barnum para credenciais e acesso
