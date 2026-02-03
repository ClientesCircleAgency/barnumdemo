# 📱 GUIA DE AUTOMAÇÃO N8N & WHATSAPP - CLÍNICA BARNUM

**Versão:** 1.0  
**Data:** 27/01/2026  
**Status:** Documento Técnico para Implementação  
**Destinatário:** Equipa de Automação n8n

---

## 1. 🎯 OBJETIVO
Este documento serve como mapa técnico para a implementação das automações de WhatsApp na Clínica Barnum. O sistema central é o **Supabase** (PostgreSQL) e o orquestrador é o **n8n**.

O objetivo é garantir que o n8n consiga **ler** as mensagens pendentes, **enviar** através do provider de WhatsApp (ex: Twilio, Gupshup, Meta Cloud API) e **atualizar** o estado na base de dados.

---

## 2. 🏗️ ARQUITETURA DE DADOS

Todas as automações são geridas através da tabela `whatsapp_workflows`.

### Tabela: `public.whatsapp_workflows`
Esta é a fila de mensagens a processar.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único da mensagem. |
| `appointment_id` | UUID | FK para a consulta (se aplicável). |
| `patient_id` | UUID | ID do paciente (para logs). |
| `phone` | TEXT | Número de destino (ex: `+351912345678`). |
| `workflow_type` | TEXT | Tipo de automação (ver Enumeradores). |
| `status` | TEXT | Estado atual (ver Ciclo de Vida). |
| `scheduled_at` | TIMESTAMPTZ | **Gatilho:** Data/hora agendada para envio. |
| `message_payload` | JSONB | Dados dinâmicos para o template (nome, data, médico). |
| `sent_at` | TIMESTAMPTZ | Data real de envio. |
| `response` | TEXT | Resposta recebida do paciente. |

### Enumeradores Importantes (Enums/Constraints)

**Tipos de Workflow (`workflow_type`):**
1.  `confirmation_24h` - Mensagem enviada 24h antes da consulta para confirmar presença.
2.  `review_reminder` - Enviada após a consulta pedir avaliação no Google.
3.  `availability_suggestion` - Enviada para lista de espera quando surge vaga.

**Ciclo de Vida (`status`):**
- 🟡 `pending` - Aguardando envio (n8n deve ler estes).
- 🔵 `sent` - Processado pelo n8n e enviado à API do WhatsApp.
- 🟢 `delivered` - Entregue no telemóvel (webhook de retorno).
- 🟣 `responded` - Paciente respondeu (webhook de retorno).
- 🔴 `cancelled` - Consulta cancelada antes do envio.
- ⚫ `expired` - Passou do tempo útil de envio.

---

## 3. 🤖 MAPA DE AUTOMAÇÕES E GATILHOS

### Automação 1: Confirmação de Consulta (24h Antes)
**Lógica:** O backend cria um registo em `whatsapp_workflows` quando uma consulta é marcada, com `scheduled_at` definido para 24h antes da data.

*   **Trigger n8n:** Polling (Cron) a cada 15 min.
*   **Query Filtro:**
    ```sql
    SELECT * FROM whatsapp_workflows
    WHERE status = 'pending'
    AND workflow_type = 'confirmation_24h'
    AND scheduled_at <= NOW()
    ```
*   **Ação:** Enviar Template de Confirmação.
*   **Payload Esperado (JSONB):**
    ```json
    {
      "patient_name": "João Silva",
      "doctor_name": "Dra. Ana Costa",
      "date": "28/01/2026",
      "time": "14:30",
      "location_link": "https://maps.google.com/..."
    }
    ```

### Automação 2: Lembrete de Review
**Lógica:** Criado automaticamente quando o status da consulta muda para `completed`. `scheduled_at` = Consulta + 2 horas.

*   **Trigger n8n:** Polling (Cron).
*   **Query Filtro:**
    ```sql
    status = 'pending' AND workflow_type = 'review_reminder' AND scheduled_at <= NOW()
    ```
*   **Ação:** Enviar Pedido de Review.
*   **Payload Esperado (JSONB):**
    ```json
    {
      "patient_name": "João Silva",
      "review_link": "https://g.page/r/Cp..."
    }
    ```

### Automação 3: Sugestão de Vaga (Lista de Espera)
**Lógica:** Disparado manualmente pelo Admin ou automaticamente quando uma consulta é cancelada.

*   **Trigger n8n:** Webhook direto (Realtime) OU Polling imediato.
*   **Query Filtro:**
    ```sql
    status = 'pending' AND workflow_type = 'availability_suggestion'
    ```
*   **Ação:** Enviar Oferta de Vaga.
*   **Payload Esperado (JSONB):**
    ```json
    {
      "patient_name": "Maria",
      "slot_date": "Hoje, 16:00",
      "doctor_name": "Dr. Pedro"
    }
    ```

---

## 4. 🔗 ENDPOINTS & WEBHOOKS (INTEGRAÇÃO TÉCNICA)

O n8n vai comunicar com o Supabase via REST API.

**URL Base:** `https://oziejxqmghwmtjufstfp.supabase.co/rest/v1`
**Autenticação:** Header `apikey: <SERVICE_ROLE_KEY>` (Para o n8n ter permissão total).

### 4.1. Ler Fila de Envio (GET)
Para o nó de "Supabase" ou "HTTP Request" no n8n.

**Endpoint:** `/whatsapp_workflows?status=eq.pending&scheduled_at=lte.now()`
**Método:** `GET`
**Headers:**
```
apikey: <SUA_SERVICE_ROLE_KEY>
Authorization: Bearer <SUA_SERVICE_ROLE_KEY>
Range: 0-9 (Processar em batches de 10 para segurança)
```

### 4.2. Atualizar Status para "Sent" (PATCH)
Logo após o n8n enviar a mensagem com sucesso, DEVE atualizar o registo.

**Endpoint:** `/whatsapp_workflows?id=eq.<UUID_DA_MENSAGEM>`
**Método:** `PATCH`
**Body:**
```json
{
  "status": "sent",
  "sent_at": "NOW()"
}
```

### 4.3. Receber Resposta do Paciente (WEBHOOK)
Se o paciente responder (ex: "Sim confirma"), o provider de WhatsApp chama um Webhook no n8n.

**Fluxo:**
1.  **WhatsApp** -> **n8n Webhook Node**.
2.  n8n processa o texto (NLP ou Keyword "CONFIRMAR").
3.  n8n procura a mensagem original na DB.
4.  n8n atualiza a tabela `whatsapp_workflows`.
    *   **Endpoint:** `/whatsapp_workflows?phone=eq.<TELEFONE>&status=eq.sent`
    *   **Body:**
        ```json
        {
          "status": "responded",
          "response": "Texto da resposta",
          "responded_at": "NOW()"
        }
        ```
5.  **(Opcional)** n8n atualiza o status da consulta principal na tabela `appointments` para `confirmed`.

---

## 5. 🛠️ CHECKLIST PARA O DESENVOLVEDOR N8N

- [ ] **Configurar Credenciais Supabase:** Adicionar URL e Service Role Key no n8n.
- [ ] **Criar Worflow "Sender":** Cron a cada 5-15min -> Get Pending -> Send WhatsApp -> Update DB.
- [ ] **Criar Workflow "Receiver":** Webhook -> Parse Resposta -> Update DB -> Update Appointment.
- [ ] **Tratamento de Erros:** Se a API do WhatsApp falhar, atualizar `status` para `failed` (adicionar este status ao enum se necessário ou usar log de erro).

---

## 6. 📝 NOTAS FINAIS

- **Timezone:** O Supabase trabalha em UTC (`TIMESTAMPTZ`). Garantir que o n8n converte corretamente para a hora de Lisboa antes de comparar datas.
- **Service Role Key:** É crítica. Não partilhar publicamente. Usar apenas nas variáveis de ambiente do n8n.
- **Formato Telefone:** O sistema guarda telefones com indicativo (ex: `+351...`). O provider de WhatsApp pode exigir sem o `+`. Validar no n8n.

---
**Fim do Documento**
