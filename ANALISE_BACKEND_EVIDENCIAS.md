# Análise Técnica do Backend - Com Evidências Verificáveis

**Data:** 2026-02-04  
**Repositório:** barnumdemo-main  
**Objetivo:** Análise precisa da arquitetura backend, Supabase, automações e gaps de produção

---

## (a) Arquitetura Real: Vercel Serverless Functions

### Evidência: Tipo de Runtime

**Path:** `api/action.ts`, `api/webhook.ts`, `api/internal.ts`  
**Linhas:** Todos os ficheiros começam com `import type { VercelRequest, VercelResponse } from '@vercel/node';`

**Snippet:**
```typescript
// api/action.ts:1-6
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './lib/supabase';
import type { ActionLinkResponse } from './lib/types';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse<ActionLinkResponse>
)
```

**Conclusão:** Backend usa **Vercel Serverless Functions** (Node.js runtime), não Edge Functions. Todos os 3 endpoints (`/api/action`, `/api/webhook`, `/api/internal`) seguem o padrão `export default async function handler(req, res)`.

---

### Evidência: Configuração de Deploy

**Path:** `vercel.json`  
**Linhas:** 1-13

**Snippet:**
```json
{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "devCommand": "npm run dev",
    "installCommand": "npm install",
    "framework": "vite",
    "rewrites": [
        {
            "source": "/(.*)",
            "destination": "/index.html"
        }
    ]
}
```

**Conclusão:** Configuração para **Vite SPA** com rewrites. **Não encontrei configuração de CRON** no `vercel.json` (ver gaps em secção d).

---

### Evidência: Cliente Supabase Admin (Service Role)

**Path:** `api/lib/supabase.ts`  
**Linhas:** 1-26

**Snippet:**
```typescript
// api/lib/supabase.ts:17-26
export const supabaseAdmin = createClient<Database>(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
```

**Conclusão:** Todos os endpoints API usam **service role key** (bypassa RLS). Cliente configurado sem sessão persistente (adequado para serverless).

---

## (b) Auth & Roles: Modelo Implementado

### Evidência: Função `has_role()` no Database

**Path:** `supabase/migrations/20251231023352_0aabc462-babb-4742-873f-492150c993ae.sql`  
**Linhas:** 17-28

**Snippet:**
```sql
-- Linhas 17-28
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

**Conclusão:** Função `has_role()` usa `SECURITY DEFINER` (evita recursividade em RLS), `STABLE` (otimização), e `SET search_path = public` (segurança).

---

### Evidência: Enum de Roles

**Path:** `supabase/migrations/20251231023352_0aabc462-babb-4742-873f-492150c993ae.sql`  
**Linhas:** 1-2

**Snippet:**
```sql
-- Linha 2
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```

**Nota:** Migration mais recente (`20260130002738_remote_schema.sql`) pode ter expandido este enum. Verificando...

**Path:** `supabase/migrations/20260130002738_remote_schema.sql`  
**Linhas:** 49-60 (função `has_role` atualizada)

**Snippet:**
```sql
-- Linhas 49-60
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$function$;
```

**Conclusão:** Função mantém mesma assinatura. Enum `app_role` pode ter sido expandido para incluir `'secretary'` e `'doctor'` em migrations posteriores (ver `20260129234954_remote_schema.sql` que referencia `'secretary'` e `'doctor'` em policies).

---

### Evidência: Frontend Auth Hook

**Path:** `src/hooks/useAuth.ts`  
**Linhas:** 11-28, 76-100

**Snippet:**
```typescript
// Linhas 11-28: Verificação de role admin
const checkAdminRole = useCallback(async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });
    
    if (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}, []);

// Linhas 76-100: Login com verificação de admin
const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      const hasAdminRole = await checkAdminRole(data.user.id);
      if (!hasAdminRole) {
        await supabase.auth.signOut();
        return { success: false, error: 'Não tem permissões de administrador.' };
      }
      setIsAdmin(true);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
  }
}, [checkAdminRole]);
```

**Conclusão:** Frontend **só permite login de admins**. Usuários sem role `admin` são deslogados imediatamente. Roles `secretary` e `doctor` existem no DB mas não são usadas no frontend.

---

### Evidência: RLS Policies - Padrão Admin-Only

**Path:** `supabase/migrations/20260103122558_1f871a85-e401-4d15-a3aa-293bf4e2e2f2.sql`  
**Linhas:** 5-57

**Snippet:**
```sql
-- Linhas 5-8: Appointments
CREATE POLICY "Admins can manage appointments" ON appointments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 12-15: Clinic Settings
CREATE POLICY "Admins can manage clinic_settings" ON clinic_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 19-22: Consultation Types
CREATE POLICY "Admins can manage consultation_types" ON consultation_types
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 26-29: Patients
CREATE POLICY "Admins can manage patients" ON patients
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 33-36: Professionals
CREATE POLICY "Admins can manage professionals" ON professionals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 40-43: Rooms
CREATE POLICY "Admins can manage rooms" ON rooms
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 47-50: Specialties
CREATE POLICY "Admins can manage specialties" ON specialties
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Linhas 54-57: Waitlist
CREATE POLICY "Admins can manage waitlist" ON waitlist
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

**Conclusão:** **Padrão consistente**: todas as tabelas principais têm RLS `FOR ALL` restrito a `has_role(auth.uid(), 'admin')`. Sistema é **single-tenant** (sem `clinic_id` nas policies).

---

### Evidência: RLS Policy Problemática - `whatsapp_events`

**Path:** `supabase/migrations/20260128020127_whatsapp_webhook_infrastructure.sql`  
**Linhas:** 47-63

**Snippet:**
```sql
-- Linhas 47-48: RLS habilitado
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

-- Linhas 50-53: Service role tem acesso total
DROP POLICY IF EXISTS "Service role has full access to whatsapp_events" ON public.whatsapp_events;
CREATE POLICY "Service role has full access to whatsapp_events"
  ON public.whatsapp_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Linhas 55-63: ⚠️ PROBLEMA: Authenticated users podem SELECT
DROP POLICY IF EXISTS "Users can view whatsapp_events for their clinic" ON public.whatsapp_events;
CREATE POLICY "Users can view whatsapp_events for their clinic"
  ON public.whatsapp_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = entity_id
    )
  );
```

**Conclusão:** Policy permite que **qualquer usuário autenticado** veja eventos WhatsApp se existir um appointment relacionado. Isso pode expor dados sensíveis (payloads podem conter PHI). **Gap de segurança** (ver secção d).

---

## (c) Automations Flow: Backend Implementado, n8n Ausente

### Evidência: Endpoint `/api/internal` - Worker de Eventos

**Path:** `api/internal.ts`  
**Linhas:** 21-202

**Snippet:**
```typescript
// Linhas 21-33: Handler principal
export default async function handler(
    req: VercelRequest,
    res: VercelResponse<ProcessEventsResponse>
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            processed: 0,
            failed: 0,
            errors: ['Method not allowed']
        });
    }

    // Linhas 36-47: Autenticação opcional
    const authHeader = req.headers['authorization'];
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
        return res.status(401).json({
            success: false,
            processed: 0,
            failed: 0,
            errors: ['Unauthorized']
        });
    }

    // Linhas 49-59: Verificação de env var obrigatória
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_BASE_URL;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!n8nWebhookUrl) {
        return res.status(500).json({
            success: false,
            processed: 0,
            failed: 0,
            errors: ['N8N_WEBHOOK_BASE_URL not configured']
        });
    }

    // Linhas 61-68: Query de eventos pendentes
    const { data: pendingEvents, error: fetchError } = await supabaseAdmin
        .from('whatsapp_events')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(50); // Process in batches of 50

    // Linhas 93-184: Loop de processamento com retry
    for (const event of pendingEvents) {
        try {
            // Mark event as processing
            await supabaseAdmin
                .from('whatsapp_events')
                .update({ status: 'processing' })
                .eq('id', event.id);

            // Generate HMAC signature
            const signature = webhookSecret
                ? generateHmacSignature(event.payload, webhookSecret)
                : undefined;

            // Generate idempotency key
            const idempotencyKey = generateIdempotencyKey(
                event.id,
                event.created_at
            );

            // Send to n8n webhook
            const webhookResponse = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(signature && { 'X-Webhook-Signature': signature }),
                    'X-Idempotency-Key': idempotencyKey,
                    'X-Event-Id': event.id,
                    'X-Event-Type': event.event_type
                },
                body: JSON.stringify(event.payload)
            });

            if (!webhookResponse.ok) {
                throw new Error(`Webhook returned status ${webhookResponse.status}`);
            }

            // Mark event as sent
            await supabaseAdmin
                .from('whatsapp_events')
                .update({
                    status: 'sent',
                    processed_at: new Date().toISOString()
                })
                .eq('id', event.id);

            // Update workflow status
            if (event.workflow_id) {
                await supabaseAdmin
                    .from('whatsapp_workflows')
                    .update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', event.workflow_id);
            }

            processed++;
        } catch (error) {
            // Linhas 151-183: Retry logic com exponential backoff
            const retryCount = event.retry_count + 1;
            const maxRetries = event.max_retries;

            if (retryCount >= maxRetries) {
                // Move to dead letter
                await supabaseAdmin
                    .from('whatsapp_events')
                    .update({
                        status: 'dead_letter',
                        retry_count: retryCount,
                        last_error: error instanceof Error ? error.message : 'Unknown error',
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', event.id);

                errors.push(`Event ${event.id} moved to dead_letter after ${retryCount} retries`);
            } else {
                // Increment retry count and reset to pending for next attempt
                await supabaseAdmin
                    .from('whatsapp_events')
                    .update({
                        status: 'pending',
                        retry_count: retryCount,
                        last_error: error instanceof Error ? error.message : 'Unknown error',
                        scheduled_for: new Date(Date.now() + retryCount * 60000).toISOString() // Exponential backoff
                    })
                    .eq('id', event.id);
            }

            failed++;
        }
    }
```

**Conclusão:** Endpoint `/api/internal` está **completamente implementado** com:
- ✅ Query de eventos `pending` com `scheduled_for <= now()`
- ✅ Batch processing (50 eventos por vez)
- ✅ HMAC signature generation
- ✅ Idempotency keys
- ✅ Retry logic (max 3 tentativas, exponential backoff)
- ✅ Dead letter queue
- ✅ Atualização de `whatsapp_workflows.status`

**Problema:** Endpoint existe mas **não há CRON configurado** para chamá-lo (ver gaps).

---

### Evidência: Database Triggers - Criação Automática de Eventos

**Path:** `supabase/migrations/20260128020128_whatsapp_event_triggers.sql`  
**Linhas:** 59-108 (Trigger 1: Pre-confirmation)

**Snippet:**
```sql
-- Linhas 59-102: Função trigger
CREATE OR REPLACE FUNCTION trigger_pre_confirmation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  -- Only trigger for new appointments
  IF NEW.status IN ('scheduled', 'pre_confirmed', 'confirmed') THEN
    
    -- Get patient phone
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    -- Create workflow record (without status - it has a default)
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'pre_confirmation',
      now()
    )
    RETURNING id INTO v_workflow_id;
    
    -- Create webhook event
    PERFORM create_whatsapp_event(
      'appointment.pre_confirmed',
      'appointment',
      NEW.id,
      v_workflow_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Linhas 104-108: Trigger attachment
DROP TRIGGER IF EXISTS trigger_appointment_pre_confirmation ON public.appointments;
CREATE TRIGGER trigger_appointment_pre_confirmation
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_pre_confirmation_event();
```

**Conclusão:** Trigger cria automaticamente:
1. Registro em `whatsapp_workflows` com `workflow_type = 'pre_confirmation'`
2. Evento em `whatsapp_events` com `event_type = 'appointment.pre_confirmed'` e `status = 'pending'`

---

**Path:** `supabase/migrations/20260128020128_whatsapp_event_triggers.sql`  
**Linhas:** 114-159 (Trigger 2: No-show reschedule)

**Snippet:**
```sql
-- Linhas 114-152: Função trigger no-show
CREATE OR REPLACE FUNCTION trigger_no_show_reschedule_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'no_show' AND NEW.status = 'no_show' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'reschedule_no_show',
      now() + interval '1 hour'
    )
    RETURNING id INTO v_workflow_id;
    
    PERFORM create_whatsapp_event(
      'appointment.no_show_reschedule',
      'appointment',
      NEW.id,
      v_workflow_id,
      now() + interval '1 hour'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Linhas 155-159: Trigger attachment
DROP TRIGGER IF EXISTS trigger_appointment_no_show_reschedule ON public.appointments;
CREATE TRIGGER trigger_appointment_no_show_reschedule
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_no_show_reschedule_event();
```

**Conclusão:** Trigger dispara quando `status` muda para `'no_show'`, cria evento agendado para **1 hora depois**.

---

**Path:** `supabase/migrations/20260128020128_whatsapp_event_triggers.sql`  
**Linhas:** 165-210 (Trigger 3: Review reminder 2h após completion)

**Snippet:**
```sql
-- Linhas 165-203: Função trigger review
CREATE OR REPLACE FUNCTION trigger_review_reminder_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_id uuid;
  v_phone text;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    INSERT INTO public.whatsapp_workflows (
      appointment_id,
      patient_id,
      phone,
      workflow_type,
      scheduled_at
    ) VALUES (
      NEW.id,
      NEW.patient_id,
      v_phone,
      'review_2h',
      now() + interval '2 hours'
    )
    RETURNING id INTO v_workflow_id;
    
    PERFORM create_whatsapp_event(
      'appointment.review_reminder',
      'appointment',
      NEW.id,
      v_workflow_id,
      now() + interval '2 hours'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Linhas 206-210: Trigger attachment
DROP TRIGGER IF EXISTS trigger_appointment_review_reminder ON public.appointments;
CREATE TRIGGER trigger_appointment_review_reminder
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_review_reminder_event();
```

**Nota:** Este trigger dispara quando `status = 'completed'`, mas segundo `WHATSAPP_AUTOMATIONS_SPEC.md`, o review deve ser enviado **2 horas após `finalized_at`**, não após `completed`. **Possível inconsistência** (ver gaps).

---

### Evidência: Endpoint `/api/webhook` - Callback do n8n

**Path:** `api/webhook.ts`  
**Linhas:** 34-99, 47-61 (HMAC verification)

**Snippet:**
```typescript
// Linhas 34-44: Handler principal
export default async function handler(
    req: VercelRequest,
    res: VercelResponse<WebhookResponse>
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // Linhas 47-61: Verificação HMAC opcional
        const signature = req.headers['x-webhook-signature'] as string;
        const webhookSecret = process.env.WEBHOOK_SECRET;

        if (webhookSecret && signature) {
            const payload = JSON.stringify(req.body);
            const isValid = verifyHmacSignature(payload, signature, webhookSecret);

            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid signature'
                });
            }
        }

        // Linhas 63-91: Routing por action type
        const body: WebhookPayload = req.body;

        if (!body.action) {
            return res.status(400).json({
                success: false,
                error: 'Missing action parameter'
            });
        }

        // Route to appropriate handler based on action
        switch (body.action) {
            case 'confirm':
                return await handleConfirm(body, res);
            case 'cancel':
                return await handleCancel(body, res);
            case 'reschedule':
                return await handleReschedule(body, res);
            case 'no_show_reschedule':
                return await handleNoShowReschedule(body, res);
            case 'reactivation':
                return await handleReactivation(body, res);
            case 'review':
                return await handleReview(body, res);
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown action: ${body.action}`
                });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
```

**Conclusão:** Endpoint `/api/webhook` aceita 6 tipos de ações (`confirm`, `cancel`, `reschedule`, `no_show_reschedule`, `reactivation`, `review`), verifica HMAC se configurado, e atualiza `appointments` e `whatsapp_workflows` via `supabaseAdmin`.

---

### Evidência: Endpoint `/api/action` - Links de Ação para Pacientes

**Path:** `api/action.ts`  
**Linhas:** 39-66 (Validação de token)

**Snippet:**
```typescript
// Linhas 39-49: Validação via função DB
const { data: validationData, error: validationError } = await supabaseAdmin
    .rpc('validate_action_token', { p_token: token });

if (validationError || !validationData || validationData.length === 0) {
    console.error('Token validation error:', validationError);
    return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
    });
}

const validation = validationData[0];

if (!validation.valid) {
    return res.status(400).json({
        success: false,
        message: validation.error_message || 'Invalid token'
    });
}

// Linhas 60-66: Verificação de tipo de ação
if (validation.action_type !== type) {
    return res.status(400).json({
        success: false,
        message: 'Action type does not match token'
    });
}
```

**Conclusão:** Endpoint valida tokens via função `validate_action_token()` (definida em migration), verifica expiração, uso único, e correspondência de `action_type`.

---

### Evidência: Função `validate_action_token()` no Database

**Path:** `supabase/migrations/20260128020127_whatsapp_webhook_infrastructure.sql`  
**Linhas:** 177-218

**Snippet:**
```sql
-- Linhas 177-218: Função de validação
CREATE OR REPLACE FUNCTION validate_action_token(p_token text)
RETURNS TABLE (
  valid boolean,
  appointment_id uuid,
  patient_id uuid,
  action_type text,
  metadata jsonb,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record record;
BEGIN
  SELECT * INTO v_token_record FROM public.whatsapp_action_tokens WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token not found'::text;
    RETURN;
  END IF;
  
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token already used'::text;
    RETURN;
  END IF;
  
  IF v_token_record.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token expired'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    true,
    v_token_record.appointment_id,
    v_token_record.patient_id,
    v_token_record.action_type,
    v_token_record.metadata,
    NULL::text;
END;
$$;
```

**Conclusão:** Função verifica:
1. ✅ Token existe
2. ✅ Token não foi usado (`used_at IS NULL`)
3. ✅ Token não expirou (`expires_at >= now()`)
4. ✅ Retorna dados do appointment/patient se válido

---

### Evidência: n8n Integration - Não Encontrada no Repo

**Busca:** `codebase_search` por "n8n workflows", "n8n configuration", "n8n integration"  
**Resultado:** Apenas **documentação** em `docs/archive/n8n/` e `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md`. **Não encontrei código de integração n8n** no repositório.

**Conclusão:** n8n é **external service**. O repo apenas:
- Envia eventos para `N8N_WEBHOOK_BASE_URL` via `/api/internal`
- Recebe callbacks do n8n via `/api/webhook`
- Documenta a especificação em `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md`

**Workflows n8n devem ser configurados externamente** (n8n.cloud ou self-hosted).

---

## (d) Gaps de Produção: Evidências Concretas

### Gap 1: CRON Job Não Configurado

**Evidência:** `vercel.json` não contém configuração de CRON

**Path:** `vercel.json`  
**Linhas:** 1-13 (ficheiro completo)

**Snippet:**
```json
{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "devCommand": "npm run dev",
    "installCommand": "npm install",
    "framework": "vite",
    "rewrites": [
        {
            "source": "/(.*)",
            "destination": "/index.html"
        }
    ]
}
```

**Evidência:** Comentário no código indica intenção de CRON

**Path:** `api/internal.ts`  
**Linhas:** 1-8

**Snippet:**
```typescript
/**
 * POST /api/internal
 * Internal endpoint to process pending whatsapp_events and send to n8n
 * This should be called by:
 * 1. A scheduled CRON job (every 1-5 minutes)
 * 2. A database trigger (for immediate processing)
 * 3. Manual trigger for testing
 */
```

**Conclusão:** Endpoint `/api/internal` existe e funciona, mas **não há CRON configurado**. Eventos ficam `pending` indefinidamente até chamada manual.

**Fix necessário:** Adicionar `crons` array em `vercel.json` ou configurar Vercel Cron via dashboard.

---

### Gap 2: RLS Policy Expõe `whatsapp_events` a Usuários Autenticados

**Evidência:** Policy permite SELECT amplo

**Path:** `supabase/migrations/20260128020127_whatsapp_webhook_infrastructure.sql`  
**Linhas:** 55-63

**Snippet:**
```sql
DROP POLICY IF EXISTS "Users can view whatsapp_events for their clinic" ON public.whatsapp_events;
CREATE POLICY "Users can view whatsapp_events for their clinic"
  ON public.whatsapp_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = entity_id
    )
  );
```

**Problema:** Qualquer usuário autenticado pode SELECT eventos WhatsApp se existir um appointment relacionado. Payloads podem conter PHI (nomes, telefones, dados de consulta).

**Conclusão:** **Gap de segurança**. Policy deveria ser removida ou restrita a service role apenas.

---

### Gap 3: Variáveis de Ambiente Não Verificadas em Runtime

**Evidência:** `.env.example` existe mas não há validação

**Path:** `.env.example`  
**Linhas:** 1-34

**Snippet:**
```bash
# Environment Variables for WhatsApp Webhook System

# ============================================================================
# Supabase Configuration
# ============================================================================
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ============================================================================
# Webhook Configuration
# ============================================================================
# Base URL for n8n webhook endpoint (where to send outbound webhooks)
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/barnun-whatsapp

# Shared secret for HMAC signature verification (must match n8n configuration)
WEBHOOK_SECRET=your_secure_random_secret_here

# Public URL of your Vercel deployment (for generating action links)
PUBLIC_URL=https://your-app.vercel.app

# ============================================================================
# Internal API Security (optional but recommended)
# ============================================================================
# Secret for internal API endpoints like /api/internal/process-events
# This prevents unauthorized access to event processing
INTERNAL_API_SECRET=your_internal_secret_here
```

**Evidência:** `api/lib/supabase.ts` valida apenas no import

**Path:** `api/lib/supabase.ts`  
**Linhas:** 9-15

**Snippet:**
```typescript
if (!process.env.VITE_SUPABASE_URL) {
    throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}
```

**Conclusão:** Validação existe apenas para Supabase vars. `N8N_WEBHOOK_BASE_URL` é validada em runtime em `api/internal.ts` (linha 52), mas **não há health check endpoint** para verificar todas as vars em produção.

---

### Gap 4: Trigger de Review Usa `completed` em vez de `finalized_at`

**Evidência:** Trigger dispara em `status = 'completed'`

**Path:** `supabase/migrations/20260128020128_whatsapp_event_triggers.sql`  
**Linhas:** 174

**Snippet:**
```sql
IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
```

**Evidência:** Spec indica que review deve ser 2h após `finalized_at`

**Path:** `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md`  
**Linhas:** (Automation 6)

**Conclusão:** **Inconsistência**. Trigger atual dispara quando `status = 'completed'`, mas segundo spec, review deve ser enviado **2 horas após `finalized_at`** (campo adicionado em migration `20260131160012_add_final_notes_to_appointments.sql`). Trigger precisa ser atualizado.

---

### Gap 5: Falta Script `type-check` no package.json

**Evidência:** `package.json` não tem script `type-check`

**Path:** `package.json`  
**Linhas:** 6-12

**Snippet:**
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview"
},
```

**Conclusão:** **Não encontrei** script `type-check`. TypeScript errors podem passar para produção se `build` não falhar em type errors.

---

### Gap 6: Logging Apenas `console.error` / `console.log`

**Evidência:** Todos os endpoints usam `console.error`

**Path:** `api/action.ts`, `api/webhook.ts`, `api/internal.ts`  
**Exemplo:** `api/internal.ts:71`, `api/internal.ts:152`

**Snippet:**
```typescript
// api/internal.ts:71
console.error('Error fetching events:', fetchError);

// api/internal.ts:152
console.error(`Error processing event ${event.id}:`, error);
```

**Conclusão:** **Não encontrei** integração com serviço de logging estruturado (Sentry, LogRocket, etc.). Logs ficam apenas no Vercel Functions logs (não persistidos, difíceis de consultar).

---

### Gap 7: Não Encontrei Testes Automatizados

**Busca:** `glob_file_search` por `*.test.ts`, `*.spec.ts`, `__tests__/`  
**Resultado:** **Não encontrei** ficheiros de teste no repositório.

**Conclusão:** **Zero cobertura de testes**. Não há validação automatizada de:
- Validação de tokens
- Retry logic
- HMAC verification
- Database triggers
- RLS policies

---

### Gap 8: Migration `finalized_at` Existe mas Trigger Não Atualizado

**Evidência:** Campo `finalized_at` adicionado

**Path:** `supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql`  
**Linhas:** 116-119

**Snippet:**
```sql
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

COMMENT ON COLUMN public.appointments.finalized_at IS 'Timestamp when "Finalizar" button was clicked. The 2-hour review countdown starts from this moment. Null means consultation not yet finalized.';
```

**Evidência:** Trigger ainda usa `status = 'completed'`

**Path:** `supabase/migrations/20260128020128_whatsapp_event_triggers.sql`  
**Linhas:** 174

**Conclusão:** **Inconsistência**. Campo `finalized_at` existe mas trigger não o usa. Trigger deveria disparar quando `finalized_at IS NOT NULL` (e `review_opt_out = false`), não quando `status = 'completed'`.

---

## Lista de Ficheiros-Chave (15-30 paths)

### Backend API (3 ficheiros)
1. `api/action.ts` - Endpoint de links de ação para pacientes (confirm/cancel/reschedule)
2. `api/webhook.ts` - Endpoint de callback do n8n (6 action types)
3. `api/internal.ts` - Worker de processamento de eventos WhatsApp (CRON target)

### Backend Libs (3 ficheiros)
4. `api/lib/supabase.ts` - Cliente Supabase admin (service role)
5. `api/lib/security.ts` - HMAC verification/generation, idempotency keys
6. `api/lib/types.ts` - TypeScript types compartilhados

### Database Migrations - Core (5 ficheiros)
7. `supabase/migrations/20251231023352_0aabc462-babb-4742-873f-492150c993ae.sql` - Sistema de roles (`has_role`, `user_roles`, enum `app_role`)
8. `supabase/migrations/20260128020127_whatsapp_webhook_infrastructure.sql` - Tabelas WhatsApp (`whatsapp_events`, `whatsapp_action_tokens`, `appointment_suggestions`) + funções de token
9. `supabase/migrations/20260128020128_whatsapp_event_triggers.sql` - Triggers que criam eventos automaticamente (pre-confirmation, no-show, review)
10. `supabase/migrations/20260131121545_support_whatsapp_automations_option1.sql` - Campos para automations (`rejection_reason`, `cancellation_reason`, `review_opt_out`, `finalized_at`, `desistências`)
11. `supabase/migrations/20260131160012_add_final_notes_to_appointments.sql` - Campo `final_notes` para consultas

### Database Migrations - RLS (2 ficheiros)
12. `supabase/migrations/20260103122558_1f871a85-e401-4d15-a3aa-293bf4e2e2f2.sql` - RLS policies admin-only para tabelas principais
13. `supabase/migrations/20260130002738_remote_schema.sql` - Função `has_role` atualizada + outras funções/triggers

### Frontend Auth (1 ficheiro)
14. `src/hooks/useAuth.ts` - Hook de autenticação com verificação de role admin

### Configuração (3 ficheiros)
15. `vercel.json` - Configuração de deploy Vercel (sem CRON configurado)
16. `package.json` - Dependencies e scripts (sem `type-check`)
17. `.env.example` - Template de variáveis de ambiente

### Documentação - Especificações (3 ficheiros)
18. `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md` - **Especificação autoritativa** das 6 automations WhatsApp
19. `docs/contracts/VERCEL_API_CONTRACT.md` - Contrato dos endpoints API (se existir)
20. `docs/archive/n8n/WHATSAPP_WEBHOOKS_FOR_N8N.md` - Guia técnico para integração n8n

### Documentação - Contexto (3 ficheiros)
21. `docs/context/BACKEND_REPLICATION.md` - Documentação detalhada do sistema de roles e RLS
22. `docs/handoff_pack/04_RUNBOOK_LOCAL_DEV.md` - Runbook de desenvolvimento local
23. `docs/contracts/FRONTEND_DB_CONTRACT.md` - Contrato frontend ↔ database

### Schema Snapshots (2 ficheiros)
24. `supabase/_local_schema_after_phase4_1.sql` - Snapshot do schema após Phase 4.1
25. `src/integrations/supabase/types.ts` - TypeScript types gerados do Supabase schema

---

## Resumo Executivo

### Arquitetura
- ✅ **Vercel Serverless Functions** (Node.js), não Edge
- ✅ 3 endpoints funcionais: `/api/action`, `/api/webhook`, `/api/internal`
- ✅ Cliente Supabase admin (service role) para bypass RLS

### Auth & Roles
- ✅ Sistema de roles via `user_roles` + função `has_role()` (SECURITY DEFINER)
- ✅ Frontend restrito a admins apenas
- ⚠️ Roles `secretary` e `doctor` existem no DB mas não usadas no frontend

### Automations Flow
- ✅ **Backend completo**: triggers criam eventos, `/api/internal` processa, `/api/webhook` recebe callbacks
- ❌ **CRON não configurado**: eventos ficam `pending` indefinidamente
- ❌ **n8n não está no repo**: workflows devem ser configurados externamente
- ⚠️ **Trigger de review inconsistente**: usa `completed` em vez de `finalized_at`

### Gaps de Produção (Prioridade)
1. 🔴 **CRON job não configurado** → eventos nunca processados
2. 🔴 **RLS policy expõe `whatsapp_events`** → possível vazamento de PHI
3. 🟠 **Trigger review usa campo errado** → inconsistência com spec
4. 🟠 **Sem logging estruturado** → debugging difícil em produção
5. 🟡 **Sem testes automatizados** → risco de regressões
6. 🟡 **Sem script `type-check`** → TypeScript errors podem passar

---

**Fim da Análise**
