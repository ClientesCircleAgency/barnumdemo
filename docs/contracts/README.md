# Contratos Técnicos do Sistema Barnum

Esta pasta contém a documentação técnica extraída do codebase que descreve os "contratos" reais entre frontend, backend (Supabase), e APIs Vercel.

## 📄 Documentos

### 1. FRONTEND_DB_CONTRACT.md
Documentação completa de todas as interações do frontend com o Supabase:
- **12 tabelas** documentadas
- Todas as operações: SELECT, INSERT, UPDATE, DELETE
- Payloads enviados com exemplos
- Filtros utilizados (eq, in, order, etc.)
- Colunas esperadas no retorno
- Status e enums usados

**Tabelas cobertas:**
- `appointments`, `appointment_requests`, `patients`, `professionals`
- `consultation_types`, `specialties`, `rooms`, `waitlist`
- `whatsapp_workflows`, `clinic_settings`, `contact_messages`, `notifications`

### 2. FRONTEND_ENUMS_AND_TYPES.md
Todos os tipos TypeScript, interfaces, enums e validações:
- Tipos gerados do Supabase (`src/integrations/supabase/types.ts`)
- Interfaces customizadas não auto-geradas
- Enums e seus valores literais
- Schemas de validação Zod (formulários)
- Arrays hardcoded de status
- Mapeamentos e normalizações

**Inclui:**
- `AppointmentStatus`, `WaitlistPriority`, `TimePreference`
- Schemas de validação dos formulários (appointment, contact)
- Hardcoded `SPECIALTY_IDS` mapping
- Time slots array

### 3. VERCEL_API_CONTRACT.md
Documentação das 3 rotas Vercel Serverless:

#### `/api/action` (GET)
- Public action links (confirm, cancel, reschedule)
- Token validation
- Payloads e query params
- Tabelas acessadas

#### `/api/webhook` (POST)
- Callbacks do n8n/WhatsApp provider
- HMAC signature validation
- Actions suportadas
- Event types

#### `/api/internal` (POST)
- Event processor (outbox pattern)
- Idempotency support
- n8n webhook integration
- Batch processing

### 4. AUDIT_REPORT.md
Relatório técnico da auditoria completa de incongruências:
- **Críticas:** Mismatches entre frontend/backend/API que impedem produção
- **Médias:** Inconsistências de nomenclatura e tipos
- **Baixas:** Recomendações de refactoring
- Plano de ação priorizado

## 🎯 Uso

Estes documentos servem para:

1. **Onboarding** de novos desenvolvedores
2. **Análise técnica** (podem ser enviados diretamente ao ChatGPT/Claude)
3. **Validação de schemas** antes de migrations
4. **Debugging** de erros de integração
5. **Documentação de referência** para desenvolvimento

## ⚠️ Incongruências Identificadas

### 🔴 Críticas
- `whatsapp_workflows.status = 'completed'` usado em API mas não permitido por schema
- Frontend envia `specialty_id` e `reason` mas schema pode ter conflitos

### 🟡 Médias
- Workflow types `'reactivation'` e `'reschedule_prompt'` não documentados
- Divergências entre valores de enum em diferentes partes do código

## 🔄 Manutenção

Estes documentos devem ser atualizados quando:
- Houver mudanças no schema Supabase
- Novos endpoints forem adicionados
- Tipos TypeScript mudarem
- Novos workflows forem implementados

---

**Última atualização:** 2026-01-29  
**Extraído de:** Frontend hooks, API routes, Supabase types  
**Formato:** Markdown (pronto para análise por LLMs)
