# Guia Completo para o Parceiro n8n — Barnum

> **Versão:** 3.1 — 2026-02-04
> **Destinatário:** Parceiro técnico responsável pelas automações WhatsApp via n8n
> **Idioma:** Português (Portugal) com termos técnicos em inglês quando necessário

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Variáveis de Ambiente](#3-variáveis-de-ambiente)
4. [Supabase DB Webhooks](#4-supabase-db-webhooks)
5. [Automações WhatsApp (1-6)](#5-automações-whatsapp-1-6)
6. [Sugestão de Horários Alternativos](#6-sugestão-de-horários-alternativos)
7. [Tabelas da Base de Dados](#7-tabelas-da-base-de-dados)
8. [Fluxo Completo de Eventos](#8-fluxo-completo-de-eventos)
9. [Exemplos de Workflows n8n](#9-exemplos-de-workflows-n8n)
10. [Checklist do Parceiro](#10-checklist-do-parceiro)
11. [FAQ e Troubleshooting](#11-faq-e-troubleshooting)

---

## 1. Visão Geral

O Barnum é uma plataforma de gestão de clínicas. O n8n é responsável por enviar mensagens WhatsApp aos pacientes quando certos eventos acontecem na base de dados.

**Como funciona:**

1. Quando algo muda na base de dados (nova consulta, cancelamento, etc.), o Supabase envia automaticamente os dados ao n8n via **Database Webhooks**
2. O n8n compõe e envia a mensagem WhatsApp ao paciente
3. **Todas as mensagens são one-way** — o paciente NÃO responde via WhatsApp
4. A única interação do paciente é clicar num **link de slot sugerido** (quando a secretária sugere horários alternativos)

**Princípios:**

- **Zero backend:** Não existem endpoints intermediários. O n8n comunica diretamente com o Supabase via REST API
- **Zero respostas:** Não existe chatbot nem processamento de respostas do paciente
- **Tudo reativo:** O n8n reage a mudanças na base de dados (exceto o lembrete 24h que usa CRON)

---

## 2. Arquitetura

```
┌─────────────────────────────────────────┐
│           BARNUM (Supabase)             │
│                                         │
│  ┌───────────┐    ┌────────────────┐    │
│  │ UI (React) │──>│ PostgreSQL (DB) │    │
│  └───────────┘    │                │    │
│                    │ appointments   │    │
│                    │ appointment_   │    │
│                    │   requests     │    │
│                    │ appointment_   │    │
│                    │   suggestions  │    │
│                    │ patients       │    │
│                    └────────────────┘    │
│                           │              │
│                    DB Webhooks            │
│                    (INSERT/UPDATE)        │
└───────────────────────────┼──────────────┘
                            │ HTTP POST (real-time)
                            ▼
┌─────────────────────────────────────────┐
│              n8n (Externo)              │
│                                         │
│  Webhook Nodes: recebem dados do        │
│    Supabase (3 webhooks)                │
│  Switch Node: decide automação          │
│  Supabase REST: lookup de dados         │
│  WhatsApp API: envia mensagens          │
│  CRON Node: lembrete 24h (08:00)        │
└─────────────────────────────────────────┘
```

---

## 3. Variáveis de Ambiente

Variáveis que devem estar configuradas **no n8n**:

| Variável | Onde obter | Para quê |
|----------|-----------|----------|
| `DB_WEBHOOK_SECRET` | Combinar com o admin do Barnum | Validar que os webhooks vêm do Supabase |
| `SUPABASE_URL` | Dashboard do Supabase | Para lookups e updates via REST API |
| `SUPABASE_ANON_KEY` | Dashboard do Supabase | Para autenticar chamadas REST |

Apenas 3 variáveis. Nada mais.

---

## 4. Supabase DB Webhooks

O n8n recebe dados em tempo real via **3 DB Webhooks** configurados no Supabase Dashboard.

### Webhook 1: `appointments` (INSERT + UPDATE)

**Eventos:** Cada vez que uma consulta é criada ou atualizada.

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
    "reason": "Check-up dentário",
    "notes": "...",
    "final_notes": null,
    "finalized_at": null,
    "cancellation_reason": null,
    "review_opt_out": false,
    "created_at": "2026-02-04T10:00:00Z",
    "updated_at": "2026-02-04T12:00:00Z"
  },
  "old_record": {
    "id": "uuid-da-consulta",
    "status": "confirmed",
    "finalized_at": null,
    "review_opt_out": false
  }
}
```

**Como o n8n decide o que fazer (Switch Node):**

| Condição | Automação |
|----------|-----------|
| `type == INSERT` | AUT-1: Notificação de nova consulta |
| `type == UPDATE` AND `old_record.status != cancelled` AND `record.status == cancelled` | AUT-5: Cancelamento |
| `type == UPDATE` AND `old_record.status != no_show` AND `record.status == no_show` | AUT-3: No-show |
| `type == UPDATE` AND `old_record.finalized_at == null` AND `record.finalized_at != null` AND `record.review_opt_out == false` | AUT-6: Review (enviar 2h depois) |

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
    "name": "João Silva",
    "phone": "+351912345678",
    "email": "joao@example.com",
    "nif": "123456789",
    "specialty_id": "uuid",
    "preferred_date": "2026-02-15",
    "preferred_time": "14:00",
    "reason": "Check-up",
    "status": "rejected",
    "assigned_professional_id": null,
    "estimated_duration": null,
    "rejection_reason": "Agenda indisponível",
    "cancel_reason": null,
    "created_at": "2026-02-04T09:00:00Z",
    "updated_at": "2026-02-04T12:00:00Z"
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

### Webhook 3: `appointment_suggestions` (INSERT)

**Eventos:** Quando a secretária sugere horários alternativos a um paciente.

**Payload automático (exemplo):**
```json
{
  "type": "INSERT",
  "table": "appointment_suggestions",
  "schema": "public",
  "record": {
    "id": "uuid",
    "appointment_request_id": "uuid-do-pedido",
    "patient_id": "uuid-do-paciente",
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

**Lógica:** Ver secção 6 (Sugestão de Horários Alternativos).

### Lookup de dados adicionais

O payload do webhook contém apenas IDs (ex: `patient_id`). Para obter nome e telefone do paciente, o n8n faz um lookup via Supabase REST API:

```
GET {SUPABASE_URL}/rest/v1/patients?id=eq.{patient_id}&select=name,phone,email
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
```

Da mesma forma para profissionais e especialidades:

```
GET {SUPABASE_URL}/rest/v1/professionals?id=eq.{professional_id}&select=name
GET {SUPABASE_URL}/rest/v1/specialties?id=eq.{specialty_id}&select=name
GET {SUPABASE_URL}/rest/v1/consultation_types?id=eq.{consultation_type_id}&select=name
```

---

## 5. Automações WhatsApp (1-6)

Todas as automações enviam mensagens **one-way** — o paciente NÃO responde.

### Automação 1: Notificação de Nova Consulta

**Trigger:** DB Webhook — `appointments` INSERT

**O que o n8n deve fazer:**
1. Receber webhook
2. Lookup do paciente: `GET /rest/v1/patients?id=eq.{record.patient_id}`
3. Lookup do profissional: `GET /rest/v1/professionals?id=eq.{record.professional_id}`
4. Enviar WhatsApp:
   > "Olá [nome], a sua consulta está marcada para [data] às [hora] com [Dr. X]. Se precisar de cancelar ou reagendar, contacte-nos pelo [telefone da clínica]."

---

### Automação 2: Lembrete 24h

**Trigger:** CRON do n8n — diário às 08:00
**NÃO usa DB Webhook.** O n8n consulta diretamente a base de dados.

**O que o n8n deve fazer:**
1. CRON: todos os dias às 08:00
2. Query Supabase:
   ```
   GET /rest/v1/appointments?date=eq.{amanhã}&status=eq.confirmed&select=*
   ```
3. Para cada consulta: lookup do paciente e enviar WhatsApp:
   > "Olá [nome], lembrete: tem consulta amanhã [data] às [hora] com [Dr. X]. Se precisar de cancelar ou reagendar, contacte-nos pelo [telefone da clínica]."

---

### Automação 3: No-Show

**Trigger:** DB Webhook — `appointments` UPDATE
**Condição:** `old_record.status != no_show` AND `record.status == no_show`

**O que o n8n deve fazer:**
1. Receber webhook
2. Lookup do paciente
3. Enviar WhatsApp:
   > "Olá [nome], reparámos que não compareceu à consulta de [data]. Se desejar reagendar, contacte-nos pelo [telefone da clínica]."

---

### Automação 4: Rejeição de Pedido

**Trigger:** DB Webhook — `appointment_requests` UPDATE
**Condição:** `old_record.status == pending` AND `record.status == rejected`

**O que o n8n deve fazer:**
1. Receber webhook (já tem `name`, `phone` no record)
2. Enviar WhatsApp:
   > "Olá [nome], infelizmente não nos foi possível agendar a consulta solicitada. Contacte-nos para mais informações."

---

### Automação 5: Cancelamento

**Trigger:** DB Webhook — `appointments` UPDATE
**Condição:** `old_record.status != cancelled` AND `record.status == cancelled`

**O que o n8n deve fazer:**
1. Receber webhook
2. Lookup do paciente
3. Enviar WhatsApp:
   > "Olá [nome], a sua consulta de [data] às [hora] foi cancelada. Se desejar reagendar, contacte-nos pelo [telefone da clínica]."

---

### Automação 6: Pedido de Avaliação (Review)

**Trigger:** DB Webhook — `appointments` UPDATE
**Condição:** `old_record.finalized_at == null` AND `record.finalized_at != null` AND `record.review_opt_out == false`

**O que o n8n deve fazer:**
1. Receber webhook
2. Verificar que `record.review_opt_out == false` (se `true`, NÃO enviar — a secretária optou por não enviar review)
3. **Wait 2 horas** (usar Wait node no n8n)
4. Lookup do paciente
5. Enviar WhatsApp:
   > "Olá [nome], obrigado por visitar a nossa clínica! Gostaríamos de saber como correu a sua consulta. Avalie aqui: [link Google Reviews]"

---

## 6. Sugestão de Horários Alternativos

Este é o **único fluxo com interação do paciente**. Quando a secretária rejeita um pedido e sugere horários alternativos:

**Fluxo:**

```
1. Secretária seleciona slots disponíveis na UI
        │
        ▼
2. INSERT em appointment_suggestions (com suggested_slots JSONB)
        │
        ▼
3. DB Webhook envia para n8n
        │
        ▼
4. n8n compõe WhatsApp com links clicáveis (1 link por slot)
   Cada link aponta para um Webhook Node do n8n:
   https://<n8n>/webhook/<id>?suggestion_id=xxx&slot_index=0
        │
        ▼
5. Paciente clica no slot que prefere
        │
        ▼
6. n8n recebe o clique (Webhook Node)
        │
        ▼
7. n8n atualiza appointment_suggestions via REST API:
   PATCH /rest/v1/appointment_suggestions?id=eq.{suggestion_id}
   Body: { "status": "accepted", "accepted_slot": { ... } }
        │
        ▼
8. n8n cria a consulta via REST API:
   POST /rest/v1/appointments
   Body: { patient_id, professional_id, date, time, status: "confirmed", ... }
```

**Mensagem WhatsApp exemplo:**
> "Olá [nome], temos os seguintes horários disponíveis para si:
> 1. 12/02 às 10:00 — [link]
> 2. 12/02 às 15:00 — [link]
> 3. 13/02 às 09:30 — [link]
>
> Clique no horário que prefere para confirmar."

**Nota:** Os links apontam diretamente para Webhook Nodes do n8n. Quando o paciente clica, o n8n recebe o request e processa tudo internamente.

---

## 7. Tabelas da Base de Dados

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
| `status` | ENUM | `confirmed`, `waiting`, `in_progress`, `completed`, `cancelled`, `no_show` |
| `reason` | TEXT | Motivo da consulta |
| `notes` | TEXT | Notas da consulta |
| `final_notes` | TEXT | Prescrição médica / notas de finalização |
| `finalized_at` | TIMESTAMPTZ | Quando foi finalizada (NULL = não finalizada) |
| `cancellation_reason` | TEXT | Motivo do cancelamento |
| `review_opt_out` | BOOLEAN | Se `true`, NÃO enviar pedido de review (default: `false`) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

> **Nota:** Não existe status `finalized`. A finalização é indicada por `finalized_at` ter um valor (não NULL). O status permanece `completed` quando a consulta é finalizada.

### `appointment_requests` (pedidos de marcação)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `name` | TEXT | Nome do paciente |
| `phone` | TEXT | Telefone (formato E.164: +351...) |
| `email` | TEXT | Email |
| `nif` | TEXT | NIF |
| `specialty_id` | UUID | FK → specialties |
| `reason` | TEXT | Motivo da consulta |
| `preferred_date` | DATE | Data preferida |
| `preferred_time` | TIME | Hora preferida |
| `status` | ENUM | `pending`, `pre_confirmed`, `suggested`, `converted`, `cancelled`, `expired`, `rejected` |
| `assigned_professional_id` | UUID | FK → professionals (profissional atribuído) |
| `estimated_duration` | INTEGER | Duração estimada em minutos |
| `rejection_reason` | TEXT | Motivo da rejeição |
| `cancel_reason` | TEXT | Motivo do cancelamento |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

### `appointment_suggestions` (sugestões de horários)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `appointment_request_id` | UUID | FK → appointment_requests |
| `patient_id` | UUID | FK → patients |
| `suggested_slots` | JSONB | Array de slots sugeridos |
| `status` | TEXT | `pending`, `accepted`, `expired` |
| `accepted_slot` | JSONB | Slot que o paciente aceitou |
| `expires_at` | TIMESTAMPTZ | Expiração da sugestão |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

### `patients` (para lookup)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `nif` | TEXT | NIF (identificação fiscal) |
| `name` | TEXT | Nome completo |
| `phone` | TEXT | Telefone (formato E.164: +351...) |
| `email` | TEXT | Email |
| `birth_date` | DATE | Data de nascimento |
| `notes` | TEXT | Notas sobre o paciente |
| `tags` | TEXT[] | Tags/etiquetas |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

### `professionals` (para lookup)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `name` | TEXT | Nome completo |
| `specialty_id` | UUID | FK → specialties |
| `color` | TEXT | Cor na agenda (hex, default: #3b82f6) |
| `avatar_url` | TEXT | URL do avatar |
| `user_id` | UUID | FK → auth.users (conta de login) |
| `created_at` | TIMESTAMPTZ | Data de criação |

### `specialties` (para lookup)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `name` | TEXT | Nome da especialidade (ex: "Medicina Dentária", "Rejuvenescimento Facial") |
| `created_at` | TIMESTAMPTZ | Data de criação |

### `consultation_types` (para lookup)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `name` | TEXT | Nome do tipo (ex: "Limpeza", "Extração", "Botox") |
| `default_duration` | INTEGER | Duração padrão em minutos (default: 30) |
| `color` | TEXT | Cor para UI |
| `specialty_id` | UUID | FK → specialties (cada tipo pertence a uma especialidade) |
| `created_at` | TIMESTAMPTZ | Data de criação |

---

## 8. Fluxo Completo de Eventos

```
1. AÇÃO NA UI (criar/cancelar/finalizar consulta, sugerir slots)
        │
        ▼
2. Supabase DB atualiza a tabela correspondente
        │
        ▼
3. Supabase DB Webhook envia POST ao n8n (em tempo real)
        │
        ▼
4. n8n recebe dados (record + old_record)
        │
        ▼
5. n8n faz lookup de paciente/profissional via Supabase REST API
        │
        ▼
6. n8n compõe e envia mensagem WhatsApp ao paciente (one-way)
```

Para sugestão de slots, há um passo adicional:
```
7. Paciente clica num link de slot → n8n Webhook Node recebe
        │
        ▼
8. n8n cria appointment via Supabase REST API (POST /rest/v1/appointments)
```

---

## 9. Exemplos de Workflows n8n

### Workflow 1: Eventos de Appointments (real-time)

```
[Webhook Node: recebe POST do Supabase]
    → [IF: Authorization header == Bearer {DB_WEBHOOK_SECRET}]
    → [Switch: por tipo de evento]
        ├─ type==INSERT → [Lookup paciente] → [Enviar notificação nova consulta]
        ├─ status changed to "cancelled" → [Lookup paciente] → [Enviar cancelamento]
        ├─ status changed to "no_show" → [Lookup paciente] → [Enviar no-show]
        └─ finalized_at changed AND review_opt_out==false → [Wait 2h] → [Lookup paciente] → [Enviar review]
```

### Workflow 2: Lembrete 24h (diário às 08:00)

```
[CRON: 0 8 * * *]
    → [Supabase Node: SELECT appointments WHERE date = tomorrow AND status = confirmed]
    → [Loop: para cada consulta]
        → [Lookup paciente]
        → [Enviar WhatsApp de lembrete 24h]
```

### Workflow 3: Eventos de Appointment Requests

```
[Webhook Node: recebe POST do Supabase]
    → [IF: Authorization header == Bearer {DB_WEBHOOK_SECRET}]
    → [IF: old_record.status == pending AND record.status == rejected]
        → [Enviar WhatsApp de rejeição ao paciente]
```

### Workflow 4: Sugestão de Horários Alternativos

```
[Webhook Node: recebe POST do Supabase (appointment_suggestions INSERT)]
    → [IF: Authorization header == Bearer {DB_WEBHOOK_SECRET}]
    → [Lookup paciente via patient_id]
    → [Compor mensagem com links clicáveis para cada slot]
    → [Enviar WhatsApp com slots]
```

### Workflow 5: Paciente Aceita Slot Sugerido

```
[Webhook Node: recebe clique do paciente (GET com query params)]
    → [Ler suggestion_id e slot_index dos query params]
    → [Lookup appointment_suggestion via Supabase REST]
    → [Extrair slot aceite do array suggested_slots]
    → [PATCH appointment_suggestions: status=accepted, accepted_slot={...}]
    → [POST appointments: criar consulta com dados do slot]
    → [Responder com página HTML de confirmação]
```

---

## 10. Checklist do Parceiro

### Antes de começar
- [ ] Receber `DB_WEBHOOK_SECRET` do admin Barnum
- [ ] Receber `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- [ ] Configurar as 3 variáveis no n8n
- [ ] Acesso ao WhatsApp Business API (Twilio, 360dialog, ou outro)

### Configurar DB Webhooks (no Supabase Dashboard)
- [ ] Webhook 1: `appointments` → INSERT + UPDATE → URL do Webhook Node n8n
- [ ] Webhook 2: `appointment_requests` → UPDATE → URL do Webhook Node n8n
- [ ] Webhook 3: `appointment_suggestions` → INSERT → URL do Webhook Node n8n

### Implementar Workflows
- [ ] Workflow 1: Eventos de appointments (AUT-1, AUT-3, AUT-5, AUT-6)
- [ ] Workflow 2: CRON lembrete 24h (AUT-2)
- [ ] Workflow 3: Eventos de appointment_requests (AUT-4)
- [ ] Workflow 4: Sugestão de horários (enviar WhatsApp com links)
- [ ] Workflow 5: Paciente aceita slot (criar appointment)
- [ ] Templates WhatsApp aprovados (todas as mensagens são one-way)

### Testar
- [ ] Criar consulta na UI → verificar que webhook chega ao n8n → mensagem enviada
- [ ] Cancelar consulta → mensagem de cancelamento enviada
- [ ] Marcar no-show → mensagem enviada
- [ ] Finalizar consulta → mensagem de review enviada (2h depois)
- [ ] CRON lembrete 24h → consultas de amanhã recebem lembrete
- [ ] Rejeitar pedido → mensagem de rejeição enviada
- [ ] Sugerir slots → paciente recebe WhatsApp com links → clicar cria consulta

### Produção
- [ ] Confirmar que os 3 DB Webhooks estão ativos no Supabase Dashboard
- [ ] Monitorizar logs durante primeiros dias
- [ ] Configurar alertas para falhas de envio

---

## 11. FAQ e Troubleshooting

**P: O webhook não chega ao n8n.**
R: Verificar no Supabase Dashboard → Database → Webhooks que os webhooks estão ativos e a URL do n8n está correta. Verificar logs do webhook no Supabase.

**P: Como obter dados do paciente a partir do patient_id?**
R: Usar o Supabase Node ou HTTP Request:
```
GET {SUPABASE_URL}/rest/v1/patients?id=eq.{patient_id}&select=name,phone,email
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
```

**P: Como o n8n atualiza dados no Supabase?**
R: Usar HTTP Request ou Supabase Node:
```
PATCH {SUPABASE_URL}/rest/v1/appointments?id=eq.{appointment_id}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json

{ "status": "confirmed" }
```

**P: Como testar sem WhatsApp?**
R: Inserir/atualizar registos diretamente na tabela `appointments` via Supabase SQL Editor. O webhook será disparado e poderá verificar que o n8n o recebe.

**P: Os webhooks são idempotentes?**
R: Não automaticamente. O n8n deve implementar lógica de deduplicação se necessário (ex: guardar `record.id + record.updated_at` para evitar processar o mesmo evento duas vezes).

**P: O que acontece se o link de slot sugerido expirar?**
R: O n8n deve verificar o campo `expires_at` da sugestão antes de criar a consulta. Se expirou, mostrar uma página HTML a dizer "Este link expirou. Contacte a clínica."

---

## Removido na v3.0

Os seguintes componentes foram **removidos** e NÃO devem ser usados:

- Endpoint `/api/webhook` (removido — n8n atualiza Supabase diretamente)
- Endpoint `/api/action` (removido — links de ação do paciente apontam para n8n)
- Tabela `whatsapp_action_tokens` (removida — sem links de ação via backend)
- Tabela `whatsapp_events` (removida na v2.0)
- Tabela `whatsapp_workflows` (removida na v2.0)
- Todas as funções de HMAC/signature (removidas)

---

## Contacto

Para questões sobre webhooks, payloads, ou tabelas:
- Consultar `docs/contracts/SUPABASE_DB_WEBHOOKS_SETUP.md` para setup dos webhooks
- Contactar o admin do Barnum para credenciais e acesso
