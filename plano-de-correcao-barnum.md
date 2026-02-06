# Plano de Correção e Alinhamento - Barnum

Instruções para o próximo desenvolvedor/AI para estabilizar o ambiente de produção.

## Passo 1: Correção do Schema `appointment_requests`
Executar no SQL Editor do Supabase:
```sql
ALTER TABLE public.appointment_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.appointment_requests ADD COLUMN IF NOT EXISTS specialty_id UUID REFERENCES public.specialties(id);
ALTER TABLE public.appointment_requests ALTER COLUMN service_type DROP NOT NULL;
```
*Nota: Remover `service_type` permanentemente após validar que o frontend não o utiliza em nenhuma branch.*

## Passo 2: Atualização de Constraints `whatsapp_workflows`
Para permitir que os triggers funcionem sem erros de violação de check:
```sql
-- Remover constraint antiga
ALTER TABLE public.whatsapp_workflows DROP CONSTRAINT IF EXISTS whatsapp_workflows_workflow_type_check;

-- Adicionar nova constraint abrangente
ALTER TABLE public.whatsapp_workflows ADD CONSTRAINT whatsapp_workflows_workflow_type_check 
CHECK (workflow_type IN (
  'confirmation_24h', 
  'review_reminder', 
  'availability_suggestion', 
  'pre_confirmation', 
  'reschedule_no_show', 
  'review_2h', 
  'appointment_suggestion',
  'pre_confirmation_sent',
  'reschedule_prompt'
));
```

## Passo 3: Verificação de Triggers
Garantir que os triggers em `supabase/migrations/20260128020128_whatsapp_event_triggers.sql` estão ativos. Estes triggers são responsáveis por alimentar a tabela `whatsapp_events`.

## Passo 4: Configuração de Variáveis na Vercel
Garantir que o ambiente Vercel tem as seguintes env vars:
- `SUPABASE_SERVICE_ROLE_KEY`: Para bypassar RLS nas rotas `/api`.
- `WEBHOOK_SECRET`: Para assinar os payloads enviados ao n8n.
- `N8N_WEBHOOK_BASE_URL`: O endpoint de receção no n8n.

## Passo 5: Teste de Ponta-a-Ponta
1. Submeter uma marcação no site.
2. Verificar se a row aparece em `appointment_requests` com as colunas corretas.
3. Verificar se um evento foi gerado na tabela `whatsapp_events`.
4. Chamar `/api/internal` manualmente para validar o envio para o n8n.
