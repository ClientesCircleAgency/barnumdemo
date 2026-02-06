# Auditoria Técnica Barnum - Estado Atual

Este documento resume o estado técnico do sistema Barnum para fins de revisão e continuação de desenvolvimento.

## 1. Arquitetura Geral
- **Frontend:** React 18 (Vite) + Tailwind CSS + Lucide React.
- **Backend:** Supabase (PostgreSQL, RLS, Edge Functions planeadas).
- **API:** Vercel Serverless Functions (`/api/action`, `/api/webhook`, `/api/internal`).
- **Automação:** Integração n8n via Outbox Pattern (tabela `whatsapp_events`).

## 2. Inconsistências Identificadas (Crítico)

### Campo Fantasma: `service_type`
- **Problema:** As migrações SQL (ex: `20260103123427`) definem `service_type` como `NOT NULL` na tabela `appointment_requests`.
- **Realidade:** O Frontend já foi migrado para usar `specialty_id` e `reason`. Submeter o formulário atual resultará em erro 500 no Supabase por falta do campo `service_type`.

### Restrições na Tabela `whatsapp_workflows`
- **Problema:** A tabela possui uma `CHECK constraint` no campo `workflow_type` que permite apenas: `'confirmation_24h'`, `'review_reminder'`, `'availability_suggestion'`.
- **Necessidade:** Os novos triggers de automação precisam de: `'pre_confirmation'`, `'reschedule_no_show'`, `'review_2h'`, `'appointment_suggestion'`.

### Documentação n8n desatualizada
- **Ficheiro:** `mapa-de-webhooks-endpoints.md` diz que não existem API Routes.
- **Realidade:** As rotas na pasta `/api` estão funcionais e devem ser o ponto de entrada para o n8n.

## 3. Estado das Tabelas Principais
- `appointment_requests`: Precisa de patch para `specialty_id` e `reason`.
- `appointments`: Estável, usando `appointment_status` enum (incluindo `pre_confirmed`).
- `whatsapp_events`: Funciona como fila (outbox) para o n8n.
- `whatsapp_workflows`: Precisa de atualização nos enums/constraints.
