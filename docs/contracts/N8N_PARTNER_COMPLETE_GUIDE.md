# Guia Completo para o Parceiro n8n — Barnum

> **Versão:** 1.0 — 2026-02-06
> **Destinatário:** Parceiro técnico responsável pelas automações WhatsApp via n8n
> **Idioma:** Português (Portugal) com termos técnicos em inglês quando necessário

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Autenticação](#3-autenticação)
4. [Variáveis de Ambiente](#4-variáveis-de-ambiente)
5. [Endpoints Disponíveis](#5-endpoints-disponíveis)
6. [Automações WhatsApp (1-6)](#6-automações-whatsapp-1-6)
7. [Tabelas da Base de Dados Relevantes](#7-tabelas-da-base-de-dados-relevantes)
8. [Fluxo Completo de Eventos](#8-fluxo-completo-de-eventos)
9. [Exemplos de Workflows n8n](#9-exemplos-de-workflows-n8n)
10. [Checklist do Parceiro](#10-checklist-do-parceiro)
11. [FAQ e Troubleshooting](#11-faq-e-troubleshooting)

---

## 1. Visão Geral

O Barnum é uma plataforma de gestão de clínicas dentárias. Quando certas ações acontecem na plataforma (marcar consulta, cancelar, finalizar, etc.), o sistema cria **eventos** numa tabela de base de dados (`whatsapp_events`). O n8n é responsável por:

1. **Ler** esses eventos periodicamente
2. **Enviar** mensagens WhatsApp aos pacientes
3. **Receber** respostas dos pacientes e comunicar ao backend

**Regra fundamental:** O n8n é o ÚNICO responsável por decidir **quando** executar ações. O backend NÃO tem cron jobs nem timers — é puramente reativo.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    BARNUM (Backend)                   │
│                                                       │
│  ┌─────────────┐    ┌──────────────────┐             │
│  │  UI (React)  │───>│  Supabase (DB)    │             │
│  └─────────────┘    │                    │             │
│                      │  whatsapp_events   │──────────┐ │
│                      │  (outbox table)    │          │ │
│                      └──────────────────┘          │ │
│                                                     │ │
│  ┌──────────────────────────────────┐              │ │
│  │  Vercel API Endpoints            │              │ │
│  │  /api/n8n/process-events     <───│──────────────│─│─── n8n chama
│  │  /api/n8n/create-24h-confirms<───│──────────────│─│─── n8n chama
│  │  /api/webhook                <───│──────────────│─│─── n8n envia respostas
│  │  /api/action                 <───│──────────────│─│─── Paciente clica link
│  └──────────────────────────────────┘              │ │
└─────────────────────────────────────────────────────┘
                                                      │
                 ┌────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│                    n8n (Externo)                      │
│                                                       │
│  Workflow 1: A cada 5 min → process-events           │
│  Workflow 2: Às 08:00 → create-24h-confirmations     │
│  Workflow 3: Enviar mensagens WhatsApp               │
│  Workflow 4: Receber respostas → /api/webhook        │
└─────────────────────────────────────────────────────┘
```

---

## 3. Autenticação

### Para endpoints `/api/n8n/*`

**Header obrigatório:**
```
x-n8n-secret: <valor do N8N_WEBHOOK_SECRET>
```

Se o header estiver em falta ou o valor não corresponder, o endpoint devolve `401 Unauthorized`.

### Para o endpoint `/api/webhook` (respostas de pacientes)

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
| `N8N_WEBHOOK_SECRET` | Combinar com o admin do Barnum | Autenticação dos endpoints /api/n8n/* |
| `WEBHOOK_SECRET` | Combinar com o admin do Barnum | Assinar callbacks para /api/webhook |
| `BARNUM_API_URL` | URL do Vercel (ex: `https://barnumdemo.vercel.app`) | Base URL para chamadas |

Variáveis que devem estar configuradas **no Vercel** (pelo admin do Barnum):

| Variável | Valor |
|----------|-------|
| `N8N_WEBHOOK_SECRET` | Mesmo valor configurado no n8n |
| `WEBHOOK_SECRET` | Mesmo valor configurado no n8n |
| `N8N_WEBHOOK_BASE_URL` | URL base do n8n (para callbacks futuros) |

---

## 5. Endpoints Disponíveis

### 5.1 POST `/api/n8n/process-events`

**O que faz:** Lê todos os `whatsapp_events` com status `pending` e `scheduled_for <= agora`, processa-os e devolve os resultados.

**Quando chamar:** A cada 5 minutos (cron do n8n).

**Request:**
```http
POST /api/n8n/process-events
x-n8n-secret: <secret>
Content-Type: application/json

{}
```

**Response (sucesso):**
```json
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "results": [
    {
      "eventId": "uuid-1",
      "eventType": "appointment.pre_confirmed",
      "status": "processed",
      "payload": {
        "patient_name": "João Silva",
        "patient_phone": "+351912345678",
        "appointment_date": "2026-02-10",
        "appointment_time": "14:30",
        "professional_name": "Dr. Costa",
        "action_links": {
          "confirm": "https://barnumdemo.vercel.app/api/action?type=confirm&token=abc123",
          "cancel": "https://barnumdemo.vercel.app/api/action?type=cancel&token=def456"
        }
      }
    }
  ]
}
```

**Responsabilidade do n8n:** Para cada evento no array `results`, enviar a mensagem WhatsApp correspondente ao paciente usando o `payload`.

---

### 5.2 POST `/api/n8n/create-24h-confirmations`

**O que faz:** Procura consultas marcadas para as próximas 23-25 horas e cria eventos de confirmação no outbox (se ainda não existirem — idempotente).

**Quando chamar:** Uma vez por dia, às 08:00 (cron do n8n).

**Request:**
```http
POST /api/n8n/create-24h-confirmations
x-n8n-secret: <secret>
Content-Type: application/json

{}
```

**Request opcional (para testes):**
```json
{
  "targetDate": "2026-02-10"
}
```

**Response:**
```json
{
  "success": true,
  "created": 5,
  "skipped": 2,
  "targetDate": "2026-02-07"
}
```

**Nota:** Após chamar este endpoint, os eventos ficam no outbox. O n8n deve depois chamar `/api/n8n/process-events` para os obter e enviar.

---

### 5.3 POST `/api/webhook`

**O que faz:** Recebe respostas/ações dos pacientes (vindas do n8n após processar respostas WhatsApp).

**Quando chamar:** Quando o paciente responde a uma mensagem WhatsApp.

**Request:**
```http
POST /api/webhook
x-webhook-signature: <hmac-sha256-hex>
Content-Type: application/json

{
  "action": "confirm",
  "appointmentId": "uuid-da-consulta",
  "workflowId": "uuid-do-workflow",
  "patientPhone": "+351912345678",
  "metadata": {}
}
```

**Ações suportadas:**

| Action | O que faz |
|--------|----------|
| `confirm` | Marca consulta como `confirmed` |
| `cancel` | Marca consulta como `cancelled` |
| `reschedule` | Inicia fluxo de reagendamento |
| `no_show_reschedule` | Reagenda após no-show |
| `reactivation` | Reativa uma consulta cancelada |
| `review` | Regista avaliação do paciente |

**Response:**
```json
{
  "success": true,
  "action": "confirm",
  "appointmentId": "uuid",
  "newStatus": "confirmed"
}
```

---

### 5.4 GET `/api/action`

**O que faz:** Links públicos que os pacientes clicam diretamente (ex: no WhatsApp). Valida o token e executa a ação.

**NÃO é chamado pelo n8n.** É incluído nas mensagens WhatsApp como link clicável.

**Exemplo:**
```
https://barnumdemo.vercel.app/api/action?type=confirm&token=abc123
```

---

## 6. Automações WhatsApp (1-6)

### Automação 1: Pré-confirmação (Nova Consulta)

**Quando:** Uma nova consulta é criada na plataforma.
**Trigger no DB:** Automático — o trigger `trigger_appointment_pre_confirmation` cria o evento.
**Tipo de evento:** `appointment.pre_confirmed`

**O que o n8n deve fazer:**
1. Obter o evento via `process-events`
2. Enviar mensagem WhatsApp ao paciente:
   > "Olá [nome], a sua consulta com [Dr. X] está marcada para [data] às [hora]. Confirme aqui: [link_confirmar] ou cancele aqui: [link_cancelar]"
3. Os links de confirmação/cancelamento já vêm no payload (`action_links`)

**Payload de exemplo:**
```json
{
  "patient_name": "Maria Santos",
  "patient_phone": "+351912345678",
  "appointment_date": "2026-02-10",
  "appointment_time": "10:00",
  "professional_name": "Dra. Silva",
  "consultation_type": "Consulta Geral",
  "action_links": {
    "confirm": "https://barnumdemo.vercel.app/api/action?type=confirm&token=...",
    "cancel": "https://barnumdemo.vercel.app/api/action?type=cancel&token=..."
  }
}
```

---

### Automação 2: Confirmação 24h

**Quando:** 24 horas antes da consulta (às 08:00 do dia anterior).
**Trigger:** O n8n chama `/api/n8n/create-24h-confirmations` às 08:00.
**Tipo de evento:** `appointment.confirmation_24h`

**Workflow n8n recomendado:**
1. Cron: todos os dias às 08:00
2. HTTP Request: POST `/api/n8n/create-24h-confirmations`
3. Esperar 1 minuto
4. HTTP Request: POST `/api/n8n/process-events`
5. Para cada evento: enviar mensagem WhatsApp

**Mensagem sugerida:**
> "Olá [nome], lembrete: tem consulta amanhã [data] às [hora] com [Dr. X]. Confirme: [link] ou cancele: [link]"

---

### Automação 3: Reagendamento por No-Show

**Quando:** Um médico marca o paciente como "no_show" na Sala de Espera.
**Trigger no DB:** Automático — o trigger `trigger_appointment_no_show_reschedule` cria o evento.
**Tipo de evento:** `appointment.no_show_reschedule`

**O que o n8n deve fazer:**
1. Obter o evento via `process-events`
2. Enviar mensagem WhatsApp:
   > "Olá [nome], reparámos que não compareceu à consulta de [data]. Gostaria de reagendar? Responda SIM para reagendar ou NÃO para cancelar."
3. Se o paciente responder, enviar a resposta para `/api/webhook` com `action: "reschedule"` ou `action: "cancel"`

---

### Automação 4: Sugestão de Horários

**Quando:** A secretária sugere horários alternativos a um paciente (via modal na UI).
**Trigger no DB:** Automático — o trigger `trigger_send_appointment_suggestion` cria o evento quando `suggested_slots` é preenchido.
**Tipo de evento:** `appointment.suggestion_ready`

**O que o n8n deve fazer:**
1. Obter o evento via `process-events`
2. Enviar mensagem WhatsApp com os horários sugeridos:
   > "Olá [nome], temos os seguintes horários disponíveis para si:
   > 1. Segunda 10/02 às 14:00 com Dra. Silva
   > 2. Terça 11/02 às 10:30 com Dr. Costa
   > 3. Quarta 12/02 às 16:00 com Dra. Silva
   > Responda com o número da opção que prefere."
3. Quando o paciente responder, enviar para `/api/webhook` com o slot escolhido

**Payload de exemplo:**
```json
{
  "patient_name": "João Mendes",
  "patient_phone": "+351913456789",
  "suggested_slots": [
    { "date": "2026-02-10", "time": "14:00", "professional_name": "Dra. Silva" },
    { "date": "2026-02-11", "time": "10:30", "professional_name": "Dr. Costa" },
    { "date": "2026-02-12", "time": "16:00", "professional_name": "Dra. Silva" }
  ],
  "request_id": "uuid-do-pedido"
}
```

---

### Automação 5: Notificação de Cancelamento

**Quando:** Uma consulta é cancelada (pela secretária/admin ou pelo paciente via link).
**Trigger:** O evento é criado durante o processamento de eventos (`process-events`).
**Tipo de evento:** `appointment.cancelled`

**O que o n8n deve fazer:**
1. Obter o evento via `process-events`
2. Enviar mensagem WhatsApp:
   > "Olá [nome], a sua consulta de [data] às [hora] foi cancelada. Se desejar reagendar, contacte-nos pelo [telefone da clínica]."

---

### Automação 6: Lembrete de Avaliação

**Quando:** O médico finaliza uma consulta (define `finalized_at`) E o paciente NÃO optou por sair (`review_opt_out = false`).
**Trigger no DB:** Automático — o trigger `trigger_appointment_review_reminder` cria o evento com `scheduled_for` = 2 horas após finalização.
**Tipo de evento:** `appointment.review_reminder`

**O que o n8n deve fazer:**
1. Obter o evento via `process-events` (só aparece 2h após finalização, porque `scheduled_for` está no futuro)
2. Enviar mensagem WhatsApp:
   > "Olá [nome], obrigado por visitar a nossa clínica! Gostaríamos de saber como correu a sua consulta. Avalie aqui: [link_avaliação]"

**Nota:** O evento só é devolvido pelo `process-events` quando `scheduled_for <= agora`, por isso o timing de 2h é respeitado automaticamente.

---

## 7. Tabelas da Base de Dados Relevantes

### `whatsapp_events` (tabela principal — outbox)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único do evento |
| `event_type` | TEXT | Tipo: `appointment.pre_confirmed`, `appointment.confirmation_24h`, etc. |
| `entity_type` | TEXT | `appointment`, `appointment_request`, etc. |
| `entity_id` | UUID | ID da entidade relacionada |
| `workflow_id` | UUID | ID do workflow associado |
| `payload` | JSONB | Dados para construir a mensagem (nome, telefone, data, links, etc.) |
| `status` | TEXT | `pending`, `processed`, `failed` |
| `scheduled_for` | TIMESTAMPTZ | Quando o evento deve ser processado (null = imediato) |
| `processed_at` | TIMESTAMPTZ | Quando foi processado |
| `retry_count` | INTEGER | Número de tentativas |

### `whatsapp_workflows` (ciclo de vida do workflow)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `appointment_id` | UUID | Consulta associada |
| `appointment_request_id` | UUID | Pedido associado (se aplicável) |
| `patient_phone` | TEXT | Telefone do paciente |
| `workflow_type` | ENUM | `pre_confirmation_sent`, `confirmation_24h`, `reschedule_prompt`, `slot_suggestion`, `request_cancelled` |
| `status` | ENUM | `pending`, `sent`, `delivered`, `responded`, `expired`, `failed`, `cancelled` |
| `message_payload` | JSONB | Payload da mensagem enviada |
| `response` | TEXT | Resposta do paciente |
| `responded_at` | TIMESTAMPTZ | Quando respondeu |

### `whatsapp_action_tokens` (links de ação)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `token` | TEXT | Token único (na URL) |
| `action_type` | TEXT | `confirm`, `cancel`, `reschedule` |
| `appointment_id` | UUID | Consulta associada |
| `patient_id` | UUID | Paciente |
| `expires_at` | TIMESTAMPTZ | Expiração |
| `used_at` | TIMESTAMPTZ | Quando foi usado (null = não usado) |

---

## 8. Fluxo Completo de Eventos

```
1. AÇÃO NA UI (ex: criar consulta)
        │
        v
2. DB TRIGGER dispara automaticamente
        │
        v
3. Evento inserido em whatsapp_events (status: pending)
        │
        v
4. n8n chama /api/n8n/process-events (a cada 5 min)
        │
        v
5. Endpoint devolve eventos pendentes com payloads completos
        │
        v
6. n8n envia mensagem WhatsApp ao paciente
        │
        v
7. Paciente clica link OU responde mensagem
        │
        v
8a. Se clicou link → /api/action processa diretamente
8b. Se respondeu → n8n envia para /api/webhook
        │
        v
9. Backend atualiza estado da consulta/workflow
```

---

## 9. Exemplos de Workflows n8n

### Workflow Principal: Processar Eventos (a cada 5 min)

```
[Cron: */5 * * * *]
    → [HTTP Request: POST /api/n8n/process-events]
    → [IF: results.length > 0]
        → [Loop: para cada evento]
            → [Switch: por event_type]
                → appointment.pre_confirmed → [Enviar msg WhatsApp]
                → appointment.confirmation_24h → [Enviar msg WhatsApp]
                → appointment.no_show_reschedule → [Enviar msg WhatsApp]
                → appointment.suggestion_ready → [Enviar msg WhatsApp]
                → appointment.review_reminder → [Enviar msg WhatsApp]
```

### Workflow: Criar Confirmações 24h (diário às 08:00)

```
[Cron: 0 8 * * *]
    → [HTTP Request: POST /api/n8n/create-24h-confirmations]
    → [Log resultado]
```

**Nota:** Os eventos criados por este endpoint serão apanhados pelo workflow principal no próximo ciclo de 5 minutos.

### Workflow: Receber Respostas de Pacientes

```
[Webhook WhatsApp: mensagem recebida]
    → [Interpretar resposta (SIM/NÃO/número)]
    → [Mapear para action: confirm/cancel/reschedule]
    → [HTTP Request: POST /api/webhook com HMAC]
    → [Log resultado]
```

---

## 10. Checklist do Parceiro

### Antes de começar
- [ ] Receber `N8N_WEBHOOK_SECRET` do admin Barnum
- [ ] Receber `WEBHOOK_SECRET` do admin Barnum
- [ ] Receber URL do Vercel (ex: `https://barnumdemo.vercel.app`)
- [ ] Configurar variáveis no n8n
- [ ] Acesso ao WhatsApp Business API (Twilio, 360dialog, ou outro)

### Implementar
- [ ] Workflow 1: Process-events (cada 5 min)
- [ ] Workflow 2: Create-24h-confirmations (diário 08:00)
- [ ] Workflow 3: Envio WhatsApp por tipo de evento
- [ ] Workflow 4: Receber respostas → /api/webhook
- [ ] Templates WhatsApp aprovados (6 automações)

### Testar
- [ ] Criar consulta na UI → verificar que evento aparece em process-events
- [ ] Chamar create-24h-confirmations com `targetDate` de teste
- [ ] Enviar mensagem teste → confirmar que chega ao paciente
- [ ] Clicar link de confirmação → verificar que consulta muda para "confirmed"
- [ ] Testar cancelamento via link
- [ ] Testar sugestão de horários → resposta do paciente
- [ ] Finalizar consulta → verificar que review reminder aparece após 2h

### Produção
- [ ] Confirmar que `N8N_WEBHOOK_SECRET` está definido no Vercel
- [ ] Confirmar que 4 migrações pendentes foram aplicadas
- [ ] Monitorizar logs durante primeiros dias
- [ ] Configurar alertas para falhas de envio

---

## 11. FAQ e Troubleshooting

**P: O process-events não devolve eventos.**
R: Verificar que existem eventos com `status = 'pending'` e `scheduled_for <= NOW()` na tabela `whatsapp_events`. Após aplicar as 4 migrações pendentes, os triggers estarão ativos.

**P: Recebo 401 no endpoint.**
R: Verificar que o header `x-n8n-secret` está correto e corresponde ao valor de `N8N_WEBHOOK_SECRET` no Vercel.

**P: O HMAC não valida no /api/webhook.**
R: Verificar que está a calcular o HMAC sobre o body **exato** (como string JSON), usando SHA-256, e que o `WEBHOOK_SECRET` é o mesmo nos dois lados.

**P: Eventos de review_reminder não aparecem.**
R: O `scheduled_for` é definido para 2h após finalização. O evento só aparece no process-events depois desse tempo passar.

**P: Como testar sem WhatsApp?**
R: Chamar os endpoints manualmente (Postman/curl) e verificar as respostas. Os action links (`/api/action?type=...&token=...`) podem ser abertos diretamente no browser para testar a confirmação/cancelamento.

**P: Posso chamar process-events mais frequentemente?**
R: Sim, é idempotente. Cada evento só é processado uma vez. 5 minutos é o recomendado para balançar carga e latência.

---

## Contacto

Para questões sobre endpoints, payloads, ou comportamento do backend:
- Consultar `docs/context/PROJECT_CANONICAL_CONTEXT.md` para estado atual do projeto
- Verificar `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md` para especificações detalhadas
- Contactar o admin do Barnum para credenciais e acesso
