# 🔴 BARNUM — AUDITORIA TÉCNICA COMPLETA

**Data:** 29/01/2026  
**Sistema:** Barnum WhatsApp Automation + Appointment System  
**Arquiteto:** Claude Sonnet 4.5  

---

## RESUMO EXECUTIVO

Esta auditoria identificou **INCONGRUÊNCIAS CRÍTICAS** que **IMPEDIRÃO** o funcionamento correto do sistema em produção. Os principais problemas são:

1. ❌ **Phantom Field:** `service_type` não existe no frontend mas existe no schema
2. ❌ **Missing Field:** `reason` NOT NULL no schema mas frontend NÃO envia
3. ❌ **Status Mismatch:** N8n guide usa `completed`/`responded` mas código usa valores diferentes
4. ❌ **Enum Mismatch:** Schema permite `oftalmologia` mas frontend assume `rejuvenescimento`

**Veredito:** 🔴 **NÃO PRONTO PARA PRODUÇÃO** sem correções críticas

---

## 🔴 PARTE 1: INCONGRUÊNCIAS CRÍTICAS

### 1.1 Frontend ↔ Backend — `appointment_requests`

#### ❌ PROBLEMA CRÍTICO #1: Field Mismatch `service_type` vs `specialty_id`

**Schema (`appointment_requests`):**
```sql
-- Line 8 in 20260103123427_51eb4173-d777-47b8-b761-066563dc2404.sql
service_type TEXT NOT NULL CHECK (service_type IN ('dentaria', 'oftalmologia'))
```

**Frontend (`AppointmentSection.tsx`):**
```typescript
// Line 36 - Form validation schema
serviceType: z.enum(['dentaria', 'rejuvenescimento'], { required_error: 'Selecione o tipo de consulta' })

// Lines 76-84 - Submission transforms serviceType to specialty_id
await addRequest.mutateAsync({
  name: data.name,
  email: data.email,
  phone: data.phone,
  nif: data.nif,
  reason: data.reason,
  specialty_id: SPECIALTY_IDS[data.serviceType], // ❌ SENDS specialty_id
  preferred_date: data.preferredDate,
  preferred_time: data.preferredTime,
});
```

**Hook (`useAppointmentRequests.ts`):**
```typescript
// Lines 4-20 - TypeScript type expects specialty_id
export interface AppointmentRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string; // ❌ Hook expects specialty_id
  reason: string;
  preferred_date: string;
  preferred_time: string;
  // ...
}
```

**🔴 INCONGRUÊNCIA:**
- Schema tem coluna `service_type` (TEXT, valores: 'dentaria', 'oftalmologia')
- Frontend envia objeto com `specialty_id` (UUID)
- Frontend NÃO envia `service_type`
- TypeScript type tem `specialty_id` mas schema NÃO tem essa coluna
- **RESULTADO:** INSERT vai falhar — coluna `service_type` é NOT NULL mas não é enviada

---

#### ❌ PROBLEMA CRÍTICO #2: Missing `reason` Field

**Schema:**
```sql
-- appointment_requests table NO TEM coluna "reason"
```

**Frontend:**
```typescript
// Line 37 - Frontend valida reason
reason: z.string().min(10, 'Por favor descreva o motivo da consulta (mínimo 10 caracteres)')

// Line 81 - Frontend ENVIA reason
await addRequest.mutateAsync({
  reason: data.reason, // ❌ Esta coluna NÃO EXISTE no schema
  // ...
});
```

**Hook:**
```typescript
// Line 11 - TypeScript espera reason
export interface AppointmentRequest {
  reason: string; // ❌ Campo não existe no schema
}
```

**🔴 INCONGRUÊNCIA:**
- Frontend define `reason` como obrigatório (mínimo 10 caracteres)
- Frontend envia `reason` no payload
- Schema de `appointment_requests` **NÃO TEM** coluna `reason`
- **RESULTADO:** Campo ignorado silenciosamente OU erro no INSERT (dependendo do RLS/validação)

---

#### ⚠️ PROBLEMA #3: Enum Value Mismatch `oftalmo logia` vs `rejuvenescimento`

**Schema:**
```sql
service_type TEXT NOT NULL CHECK (service_type IN ('dentaria', 'oftalmologia'))
```

**Frontend:**
```typescript
serviceType: z.enum(['dentaria', 'rejuvenescimento'], { required_error: '...' })
```

**🟡 INCONGRUÊNCIA:**
- Schema permite `oftalmologia`
- Frontend usa `rejuvenescimento`
- Frontend mapeia `rejuvenescimento` → specialty_id `11111111-1111-1111-1111-111111111111`
- **RESULTADO:** Se `service_type` existisse no envio, valor `rejuvenescimento` seria rejeitado pelo CHECK constraint

---

### 1.2 Backend ↔ N8n Guide — `whatsapp_workflows`

#### ❌ PROBLEMA CRÍTICO #4: Status Enum Inconsistency

**N8n Guide (`GUIA_N8N_WHATSAPP_BARNUN.md`):**
```markdown
# Lines 44-50 - Ciclo de Vida do status
- 🟡 pending - Aguardando envio
- 🔵 sent - Processado e enviado
- 🟢 delivered - Entregue no telemóvel
- 🟣 responded - Paciente respondeu  # ❌ Guide usa "responded"
- 🔴 cancelled - Consulta cancelada
- ⚫ expired - Passou do tempo
```

**Vercel API — `action.ts`:**
```typescript
// Lines 107-118 - Uses "completed" NOT "responded"
await supabaseAdmin
  .from('whatsapp_workflows')
  .update({
    status: 'completed', // ❌ Usa "completed"
    response: 'confirmed via link',
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('appointment_id', validation.appointment_id)
  .in('workflow_type', ['confirmation_24h', 'pre_confirmation'])
  .eq('status', 'sent');
```

**Vercel API — `webhook.ts`:**
```typescript
// Lines 121-131 - Also uses "completed"
await supabaseAdmin
  .from('whatsapp_workflows')
  .update({
    status: 'completed', // ❌ Usa "completed"
    response: payload.patientResponse || 'confirmed',
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('appointment_id', payload.appointmentId)
  .eq('workflow_type', 'confirmation_24h')
  .eq('status', 'sent');
```

**Schema (`SETUP_DATABASE.sql`):**
```sql
-- Lines 341-355 - whatsapp_workflows table
status text NOT NULL DEFAULT 'pending' 
  CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'expired', 'cancelled'))
  -- ❌ Schema ACEITA "responded" mas NÃO aceita "completed"
```

**🔴 INCONGRUÊNCIA:**
- N8n guide documenta `responded` como status válido
- Schema CHECK constraint aceita `responded`
- Vercel API (`action.ts`, `webhook.ts`) usa `completed`
- **RESULTADO:** UPDATE vai falhar — `completed` viola o CHECK constraint

---

#### ⚠️ PROBLEMA #5: Workflow Type Mismatch

**N8n Guide:**
```markdown
# Lines 39-42 - Documented workflow types
1. confirmation_24h
2. review_reminder
3. availability_suggestion
```

**Vercel API — `webhook.ts`:**
```typescript
// Line 232 - References undocumented workflow type
.eq('workflow_type', 'reschedule_prompt') // ❌ NOT in n8n guide
```

**Vercel API — `internal.ts`:**
```typescript
// Line 252 - References another undocumented type
workflow_type: payload.workflowType || 'reactivation', // ❌ NOT in n8n guide
```

**🟡 INCONGRUÊNCIA:**
- N8n guide lista apenas 3 workflow types
- Código usa `reschedule_prompt` e `reactivation`
- Guia está INCOMPLETO ou código usa tipos obsoletos

---

### 1.3 API Routes — Assumptions sem Validação

#### ⚠️ PROBLEMA #6: `appointmentId` Optional mas Usado sem Fallback

**Webhook Payload (`webhook.ts`):**
```typescript
// Lines 20-32 - Interface definition
interface WebhookPayload {
  action: WebhookAction;
  appointmentId?: string; // ❌ OPTIONAL
  patientId?: string;
  // ...
}

// Lines 101-104 - handleConfirm function
async function handleConfirm(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
  if (!payload.appointmentId) {
    return res.status(400).json({ success: false, error: 'Missing appointmentId' });
  }
  // ❌ OK - validates before use
}
```

**✅ CORRETO:** Webhook valida `appointmentId` antes de usar

**Action Endpoint (`action.ts`):**
```typescript
// Lines 86-94 - handleConfirm uses validation.appointment_id
async function handleConfirm(validation: any, token: string, res: VercelResponse) {
  const { error: updateError } = await supabaseAdmin
    .from('appointments')
    .update({
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', validation.appointment_id); // ✅ Comes from token validation
```

**✅ CORRETO:** Action endpoint usa appointment_id do token validado

---

## 🟡 PARTE 2: RISCOS EM PRODUÇÃO

### 2.1 Riscos de Integridade de Dados

| Risco | Severidade | Impacto |
|-------|-----------|---------|
| Frontend envia `specialty_id` mas schema espera `service_type` | 🔴 CRÍTICO | **INSERT vai falhar** — todas as submissões do website público falharão |
| Frontend envia `reason` mas coluna não existe | 🟡 MÉDIO | Dados perdidos silenciosamente — motivo da consulta nunca guardado |
| Status `completed` vs `responded` | 🔴 CRÍTICO | **UPDATEs falham** — workflows ficam travados em `sent` |
| Enum `rejuvenescimento` vs `oftalmologia` | 🟡 MÉDIO | Se schema for corrigido para ter `service_type`, valor seria rejeitado |

### 2.2 Riscos Operacionais

| Risco | Severidade | Impacto |
|-------|-----------|---------|
| N8n incompleto sobre workflow types | 🟡 MÉDIO | Automações podem não funcionar como esperado |
| Frontend hardcoded specialty UUIDs | 🟡 MÉDIO | Se IDs mudarem no DB, formulário quebra |
| Workflows assumem `appointment_id` sempre existe | 🟡 MÉDIO | Workflows de lista de espera podem não ter appointment_id |

### 2.3 Riscos de Manutenção

| Risco | Severidade | Descrição |
|-------|-----------|-----------|
| Documentação desalinhada | 🟡 MÉDIO | Desenvolvedores n8n vão implementar baseado em guia incorreto |
| TypeScript types vs schema | 🟡 MÉDIO | Types TypeScript não refletem schema real |
| Múltiplas fontes de verdade | 🟡 MÉDIO | Schema SQL, TypeScript types, Form validation — todos inconsistentes |

---

## 🟢 PARTE 3: CORREÇÕES RECOMENDADAS

### 3.1 Frontend Fixes

#### FIX #1: Alinhar `AppointmentSection.tsx` com Schema

**Opção A — Adicionar `reason` ao Schema (RECOMENDADO):**
```sql
-- Migration: add_reason_to_appointment_requests.sql
ALTER TABLE public.appointment_requests 
ADD COLUMN reason TEXT;

-- Opcional: tornar obrigatório depois
ALTER TABLE public.appointment_requests 
ALTER COLUMN reason SET NOT NULL;
```

**Opção B — Remover `reason` do Frontend:**
```diff
- reason: z.string().min(10, '...'),
+ // Remove field from form
```

**Recomendação:** **Opção A** — `reason` é valioso para contexto clínico

---

#### FIX #2: Corrigir `service_type` vs `specialty_id`

**Opção A — Schema aceita `specialty_id` (RECOMENDADO):**
```sql
-- Migration: fix_appointment_requests_schema.sql

-- 1. Drop old column
ALTER TABLE public.appointment_requests 
DROP COLUMN IF EXISTS service_type;

-- 2. Add new column
ALTER TABLE public.appointment_requests 
ADD COLUMN specialty_id UUID REFERENCES public.specialties(id);

-- 3. Tornar obrigatório
ALTER TABLE public.appointment_requests 
ALTER COLUMN specialty_id SET NOT NULL;
```

**Opção B — Frontend envia `service_type`:**
```diff
// AppointmentSection.tsx
await addRequest.mutateAsync({
  name: data.name,
  email: data.email,
  phone: data.phone,
  nif: data.nif,
- specialty_id: SPECIALTY_IDS[data.serviceType],
+ service_type: data.serviceType, // Send as-is
  preferred_date: data.preferredDate,
  preferred_time: data.preferredTime,
});
```

**Recomendação:** **Opção A** — `specialty_id` é mais robusto, evita strings hardcoded

---

#### FIX #3: Atualizar Enum Values

```sql
-- Migration: update_service_type_enum.sql
-- Se mantiver service_type, atualizar constraint

ALTER TABLE public.appointment_requests 
DROP CONSTRAINT IF EXISTS appointment_requests_service_type_check;

ALTER TABLE public.appointment_requests 
ADD CONSTRAINT appointment_requests_service_type_check 
CHECK (service_type IN ('dentaria', 'rejuvenescimento'));
```

---

### 3.2 Supabase Fixes

#### FIX #4: Corrigir Workflow Status Enum

```sql
-- Migration: fix_workflow_status_enum.sql

-- Opção A: Adicionar "completed" ao enum (se quiser manter "responded")
ALTER TABLE public.whatsapp_workflows 
DROP CONSTRAINT IF EXISTS whatsapp_workflows_status_check;

ALTER TABLE public.whatsapp_workflows 
ADD CONSTRAINT whatsapp_workflows_status_check 
CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'completed', 'expired', 'cancelled'));

-- Opção B: Unificar para um único valor (RECOMENDADO)
-- Escolher "completed" E atualizar n8n guide
```

**Recomendação:** Usar `completed` como status final, é mais genérico

---

### 3.3 Vercel API Fixes

#### FIX #5: Uniformizar Status Updates

```diff
// action.ts e webhook.ts - Padronizar para "completed"
await supabaseAdmin
  .from('whatsapp_workflows')
  .update({
-   status: 'completed',
+   status: 'responded', // OU manter "completed" e atualizar schema
    response: payload.patientResponse || 'confirmed',
    responded_at: new Date().toISOString(),
  })
```

**Recomendação:** Escolher UM valor e ser consistente em todos os lugares

---

### 3.4 N8n Guide Fixes

#### FIX #6: Atualizar Documentação

```diff
# GUIA_N8N_WHATSAPP_BARNUN.md

**Tipos de Workflow (`workflow_type`):**
1. `confirmation_24h` - Mensagem 24h antes
2. `review_reminder` - Pedir avaliação
3. `availability_suggestion` - Vaga lista de espera
+4. `reschedule_prompt` - Prompt para reagendar após no-show
+5. `reactivation` - Reativação de pacientes inativos
+6. `pre_confirmation` - Pré-confirmação (usado em alguns flows)

**Ciclo de Vida (`status`):**
- 🟡 `pending`
- 🔵 `sent`
- 🟢 `delivered`
-- 🟣 `responded` - Paciente respondeu
+- 🟣 `completed` - Workflow completo (resposta ou ação tomada)
- 🔴 `cancelled`
- ⚫ `expired`
```

---

### 3.5 TypeScript Type Fixes

#### FIX #7: Gerar Types from Schema

**Instalar Supabase CLI:**
```bash
npx supabase gen types typescript --project-id ihkjadztuopcvvmmodpp > src/types/database.types.ts
```

**Usar Generated Types:**
```typescript
// useAppointmentRequests.ts
import { Database } from '@/types/database.types';

export type AppointmentRequest = Database['public']['Tables']['appointment_requests']['Row'];
export type AppointmentRequestInsert = Database['public']['Tables']['appointment_requests']['Insert'];
```

**Benefícios:**
- ✅ Garantia de alinhamento schema ↔ types
- ✅ Autocomplete correto
- ✅ Erros de compilação se schema mudar

---

## 📋 PARTE 4: CHECKLIST DE PRODUÇÃO

### 4.1 Base de Dados

- [ ] **Migração Crítica #1:** Adicionar coluna `reason` a `appointment_requests`
- [ ] **Migração Crítica #2:** Substituir `service_type` por `specialty_id` em `appointment_requests`
- [ ] **Migração Crítica #3:** Atualizar enum de status em `whatsapp_workflows` para aceitar `completed`
- [ ] **Validação:** Executar test INSERT no `appointment_requests` com payload do frontend
- [ ] **Validação:** Executar test UPDATE no `whatsapp_workflows` com `status = 'completed'`

### 4.2 Frontend

- [ ] **Atualizar Hook:** `useAppointmentRequests.ts` para refletir schema real
- [ ] **Gerar Types:** Executar `supabase gen types` e substituir interfaces manuais
- [ ] **Testar Submissão:** Validar que formulário funciona end-to-end
- [ ] **Validar Erros:** Testar casos de validação (email inválido, NIF errado, etc.)

### 4.3 Vercel API

- [ ] **Padronizar Status:** Escolher `completed` OU `responded` e ser consistente
- [ ] **Validação Defensive:** Adicionar mais validações de campos obrigatórios
- [ ] **Error Handling:** Melhorar mensagens de erro (não expor detalhes internos)
- [ ] **Logging:** Adicionar logs estruturados para debug em produção

### 4.4 N8n Documentation

- [ ] **Atualizar Lista de Workflow Types:** Adicionar tipos faltantes
- [ ] **Corrigir Status Enum:** Alinhar com decisão final do schema
- [ ] **Adicionar Exemplos:** Payloads reais de exemplo para cada workflow
- [ ] **Documentar Fallbacks:** O que fazer se `appointment_id` for null

### 4.5 Testes End-to-End

- [ ] **Teste #1:** Submissão de appointment request no website
- [ ] **Teste #2:** Admin aprova request e cria appointment
- [ ] **Teste #3:** Workflow confirmation_24h é criado
- [ ] **Teste #4:** N8n processa e envia mensagem
- [ ] **Teste #5:** Action link de confirmação funciona
- [ ] **Teste #6:** Webhook callback de resposta atualiza DB

---

## 🎯 PLANO DE AÇÃO PRIORIZADO

### 🔴 PRIORIDADE MÁXIMA (BLOQUEIA PRODUÇÃO)

1. **FIX Schema `appointment_requests`** — Adicionar `specialty_id` e `reason`
2. **FIX Status Enum** — Permitir `completed` em `whatsapp_workflows`
3. **TESTAR** — Executar fluxo completo de submissão appointment request

### 🟡 PRIORIDADE ALTA (DEVE SER FEITO)

4. **Gerar TypeScript Types** — Executar `supabase gen types`
5. **Atualizar N8n Guide** — Corrigir workflow_types e status values
6. **Adicionar Logging** — Vercel APIs devem logar requests/responses

### 🟢 PRIORIDADE MÉDIA (MELHORIAS)

7. **Refactor Hardcoded UUIDs** — Buscar specialties dinamicamente
8. **Defensive Coding** — Validar todos os payloads
9. **Documentation** — README com setup de ambiente

---

## 🚨 WARNINGS FINAIS

### Não Deploy Até:

1. ❌ Migração de schema `appointment_requests` aplicada
2. ❌ Teste manual de submissão do formulário funcionando
3. ❌ Confirmação de que workflows são criados corretamente

### Assumptions Perigosas Encontradas:

1. Frontend assume specialty IDs fixos `11111111...` e `22222222...`
2. Código assume `appointment_id` sempre existe (workflows de lista de espera podem não ter)
3. N8n guide assume polling a cada 15min mas sistema pode ter triggers

---

**FIM DA AUDITORIA**

*Documento técnico gerado por arquiteto de software senior — 29/01/2026*
