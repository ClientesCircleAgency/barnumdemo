# Guia de Implementação de Automação n8n - Barnum

**Documento para Parceiros de Automação**
**Versão:** 1.0 (Simplificada)
**Data:** 28 de Janeiro de 2026

---

## 1. Visão Geral

Este guia explica como configurar o **n8n** para enviar mensagens automáticas de WhatsApp para os pacientes da clínica **Barnum**.

### Como funciona:
1. **Barnum envia dados para o n8n** quando acontece algo (ex: nova consulta marcada).
2. **n8n recebe os dados** e envia a mensagem WhatsApp adequada.
3. **O Paciente recebe a mensagem** com links para confirmar/cancelar/reagendar.
4. **Se o paciente clicar no link**, o Barnum trata tudo automaticamente.
5. **Se o paciente responder com texto** (ex: "Sim, vou"), o n8n deve avisar o Barnum.

---

## 2. URLs Importantes

### Onde o n8n recebe dados (Webhook da Automação)
Você deve criar um Workflow no n8n que inicie com um **Webhook Trigger**.
A URL desse webhook será fornecida por você para configurarmos no Barnum.

### Onde o n8n envia respostas de texto (Webhook do Barnum)
Se o paciente responder por texto (não clicando no link), o n8n deve enviar os dados para cá:

`POST https://barnum.com/api/webhook`

### Links de Ação (Para usar nas mensagens)
Estes links já vêm prontos no payload que o Barnum envia. Você só precisa colocá-los na mensagem.

*   **Confirmar:** `https://barnum.com/api/action?type=confirm&token={TOKEN}`
*   **Cancelar:** `https://barnum.com/api/action?type=cancel&token={TOKEN}`
*   **Reagendar:** `https://barnum.com/api/action?type=reschedule&token={TOKEN}`

---

## 3. Campos que o n8n vai receber

O Barnum envia um JSON para o seu webhook. Os campos mais comuns são:

| Campo | Descrição | Exemplo |
| :--- | :--- | :--- |
| `event_type` | O tipo de automação a disparar | `appointment.pre_confirmed` |
| `appointment.patient.name` | Nome do paciente | "João Silva" |
| `appointment.patient.phone` | Telefone do paciente (com código país) | "+351912345678" |
| `appointment.date` | Data da consulta | "2026-02-01" |
| `appointment.time` | Hora da consulta | "10:00" |
| `appointment.professional.name` | Nome do médico/dentista | "Dr. Maria Santos" |
| `appointment.specialty.name` | Especialidade | "Medicina Dentária" |
| `action_links` | Objeto com os links prontos para uso | `{ "confirm": "...", "cancel": "..." }` |

---

## 4. As 7 Automações

Configure o seu n8n para filtrar pelo campo `event_type` e executar a lógica abaixo para cada caso.

### 1. Consulta Pré-confirmada
**Quando dispara:** Assim que uma consulta é marcada no sistema.
**Objetivo:** Enviar comprovativo e pedir confirmação inicial.

**Payload Exemplo (O que você recebe):**
```json
{
  "event_type": "appointment.pre_confirmed",
  "appointment": {
    "patient": { "name": "João Silva", "phone": "+351912345678" },
    "date": "2026-02-01",
    "time": "10:00",
    "specialty": { "name": "Ortodontia" },
    "professional": { "name": "Dr. Pedro" }
  },
  "action_links": {
    "confirm": "https://barnum.com/api/action?type=confirm&token=...",
    "cancel": "https://barnum.com/api/action?type=cancel&token=..."
  }
}
```

**Mensagem WhatsApp Sugerida:**
> Olá João Silva! 👋
> A sua consulta de Ortodontia está marcada:
> 📅 2026-02-01 às 10:00
> 👨‍⚕️ Dr. Pedro
>
> Por favor, confirme:
> ✅ Confirmar: {{action_links.confirm}}
> ❌ Cancelar: {{action_links.cancel}}

---

### 2. Sugestão de Horário
**Quando dispara:** Quando a clínica quer sugerir horários alternativos para um paciente.
**Objetivo:** O paciente escolher um dos horários clicando no link.

**Payload Exemplo:**
```json
{
  "event_type": "appointment.time_suggestion",
  "appointment": {
    "specialty": { "name": "Higiene Oral" }
  },
  "suggested_slots": [
    { "date": "2026-02-05", "time": "09:00", "professional": "Dra. Ana" },
    { "date": "2026-02-05", "time": "14:30", "professional": "Dra. Ana" }
  ],
  "action_links": {
    "slot_1": "https://...token1...",
    "slot_2": "https://...token2..."
  }
}
```

**Mensagem WhatsApp Sugerida:**
> Olá! Temos vagas para Higiene Oral:
>
> 1️⃣ 2026-02-05 às 09:00 - Dra. Ana
> 👉 Clique para marcar: {{action_links.slot_1}}
>
> 2️⃣ 2026-02-05 às 14:30 - Dra. Ana
> 👉 Clique para marcar: {{action_links.slot_2}}

---

### 3. Confirmar consulta 24h antes
**Quando dispara:** 24 horas antes da consulta, se já estiver confirmada.
**Objetivo:** Relembrar e garantir presença. Adicionar opções de "Vou" / "Não vou".

**Payload Exemplo:**
```json
{
  "event_type": "appointment.confirmation_24h",
  "appointment": {
    "date": "2026-02-01",
    "time": "10:00", 
    "notes": "Trazer RX"
  },
  "action_links": {
    "confirm_presence": "https://barnum.com/api/action?type=confirm&token=...",
    "reschedule": "https://barnum.com/api/action?type=reschedule&token=...",
    "cancel": "https://barnum.com/api/action?type=cancel&token=..."
  }
}
```

**Mensagem WhatsApp Sugerida:**
> 🔔 Lembrete: Consulta amanhã!
> 📅 2026-02-01 às 10:00
> ⚠️ Nota: Trazer RX
>
> Opções:
> ✅ Vou: {{action_links.confirm_presence}}
> 📅 Reagendar: {{action_links.reschedule}}
> ❌ Cancelar: {{action_links.cancel}}

---

### 4. Reagendar (não compareceu)
**Quando dispara:** 1 hora depois de um paciente faltar à consulta ("No Show").
**Objetivo:** Tentar recuperar o paciente oferecendo nova data.

**Payload Exemplo:**
```json
{
  "event_type": "appointment.no_show_reschedule",
  "reschedule_options": [
    { "date": "2026-02-03", "time": "15:00" }
  ],
  "action_links": {
    "reschedule": "https://barnum.com/api/action?type=reschedule&token=..."
  }
}
```

**Mensagem WhatsApp Sugerida:**
> Notámos que não conseguiu vir hoje. Gostaríamos de reagendar?
> Temos vaga para 2026-02-03 às 15:00.
>
> 👉 Clique para reagendar: {{action_links.reschedule}}
> Ou responda a esta mensagem.

---

### 5. Reagendar (não vou)
**Quando dispara:** Imediatamente após o paciente cancelar uma consulta.
**Objetivo:** Oferecer horários alternativos para não perder o paciente.

**Payload Exemplo:**
```json
{
  "event_type": "appointment.patient_cancelled",
  "appointment": { "cancellation_reason": "Imprevisto" },
  "alternative_slots": [
    { "date": "2026-02-12", "time": "14:00" }
  ],
  "action_links": {
    "slot_1": "https://..."
  }
}
```

**Mensagem WhatsApp Sugerida:**
> A sua consulta foi cancelada. Gostaria de reagendar?
> Opção: 2026-02-12 às 14:00
> 👉 {{action_links.slot_1}}

---

### 6. Lembrete review 2h após consulta
**Quando dispara:** 2 horas após a consulta terminar.
**Objetivo:** Pedir avaliação no Google ou interna.

**Payload Exemplo:**
```json
{
  "event_type": "appointment.review_reminder",
  "review_link": "https://barnum.com/review?token=...",
  "google_review_link": "https://g.page/..."
}
```

**Mensagem WhatsApp Sugerida:**
> Olá! Esperamos que tenha gostado da consulta.
> ⭐ A sua opinião é importante!
>
> Avaliar no Google: {{google_review_link}}

---

### 7. Reativação de clientes
**Quando dispara:** Quando um paciente não vem há 6 meses.
**Objetivo:** Trazer o paciente de volta com uma oferta ou lembrete.

**Payload Exemplo:**
```json
{
  "event_type": "patient.reactivation",
  "patient": { "days_inactive": 180 },
  "campaign": { "offer": "Check-up gratuito" },
  "action_links": {
    "book_now": "https://..."
  }
}
```

**Mensagem WhatsApp Sugerida:**
> Olá! Já não o vemos há 180 dias.
> Está na hora de cuidar do sorriso. Temos uma oferta: Check-up gratuito!
>
> 📅 Marque aqui: {{action_links.book_now}}

---

## 5. Confirmações e Respostas do Paciente

O ideal é o paciente clicar nos links (Ação Automática).
Mas se ele responder com texto, o n8n deve processar e avisar o Barnum.

### Cenário A: Paciente clica no Link
1. O navegador abre uma página de confirmação.
2. O Barnum atualiza tudo sozinho.
3. **O n8n NÃO precisa fazer nada.**

### Cenário B: Paciente responde texto (Ex: "Sim, confirmo")
1. O n8n recebe a mensagem do WhatsApp.
2. O n8n deve identificar a intenção (AI ou palavras-chave).
3. O n8n deve enviar um POST para o Barnum:

**Enviar para:** `POST https://barnum.com/api/webhook`

**Exemplo de JSON a enviar:**
```json
{
  "action": "confirm",
  "appointmentId": "ID_DA_CONSULTA",
  "patientResponse": "Sim, confirmo",
  "phone": "+351..."
}
```
*Nota: Você deve guardar o `appointmentId` no n8n ou recuperá-lo do contexto da conversa.*

---

## 6. Checklist para o Parceiro

Antes de entregar, verifique:

- [ ] **Webhook Criado:** Você forneceu a URL do seu webhook para a equipa do Barnum.
- [ ] **Router por Evento:** O seu workflow separa corretamente os 7 tipos de evento (`event_type`).
- [ ] **Links Dinâmicos:** As mensagens estão usando os `action_links` que vêm no JSON (não links fixos).
- [ ] **Tratamento de Erros:** Se o envio falhar, o n8n tenta novamente ou avisa alguém?
- [ ] **Teste de Resposta:** Testou o que acontece se o paciente responder texto em vez de clicar?

---
**Dúvidas?** Contacte a equipa técnica do Barnum.
