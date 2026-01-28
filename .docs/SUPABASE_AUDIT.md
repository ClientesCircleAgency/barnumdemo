# 🔍 AUDITORIA SUPABASE - PROJETO BARNUM
**Data:** 27 de Janeiro de 2026  
**Projeto:** Barnum - Clínica de Medicina Dentária e Rejuvenescimento Facial  
**Supabase Project ID:** `ihkjadztuopcvvmmodpp`

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ Estado Geral: **BOM**
O Supabase está bem configurado com uma arquitetura sólida, segura e escalável. Foi identificado um problema principal: **referências a Oftalmologia** nos dados de exemplo (seed data), que precisa ser corrigido para refletir o rebranding do projeto.

### 🎯 Ações Necessárias
1. **🔴 CRÍTICO:** Limpar seed data com referências a Oftalmologia
2. **🟡 RECOMENDADO:** Adicionar índices para melhor performance
3. **🟢 OPCIONAL:** Criar utilizador admin inicial

---

## 🗄️ ESTRUTURA ATUAL DA BASE DE DADOS

### **Tabelas Principais (12 tabelas)**

| Tabela | Descrição | Status |
|--------|-----------|--------|
| `specialties` | Especialidades da clínica | ⚠️ Contém Oftalmologia |
| `consultation_types` | Tipos de consulta | ⚠️ Contém consultas de Oftalmologia |
| `rooms` | Salas/Gabinetes | ✅ OK |
| `professionals` | Médicos e profissionais | ⚠️ Contém profissionais de Oftalmologia |
| `patients` | Pacientes (NIF único) | ✅ OK |
| `appointments` | Consultas agendadas | ✅ OK |
| `waitlist` | Lista de espera | ✅ OK |
| `clinic_settings` | Configurações gerais | ✅ OK |
| `appointment_requests` | Pedidos de marcação (website público) | ✅ OK |
| `contact_messages` | Mensagens de contacto (website público) | ✅ OK |
| `whatsapp_workflows` | Automação WhatsApp | ✅ OK |
| `user_roles` | Sistema de permissões | ✅ OK |

---

## ❌ PROBLEMA IDENTIFICADO: OFTALMOLOGIA

### 📍 Localização do Problema
**Ficheiro:** `supabase/migrations/20251231141633_3fa7c414-1cf9-4c79-adc0-9045a9f1af17.sql`

### Dados Incorretos (Linhas 213-238)

#### 1. Especialidades (linha 213-215)
```sql
INSERT INTO public.specialties (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Oftalmologia'),  -- ❌ REMOVER
  ('22222222-2222-2222-2222-222222222222', 'Medicina Dentária'); -- ✅ MANTER
```

**Deve ser:**
```sql
INSERT INTO public.specialties (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Medicina Dentária'),
  ('22222222-2222-2222-2222-222222222222', 'Rejuvenescimento Facial');
```

---

#### 2. Tipos de Consulta (linhas 218-224)
```sql
INSERT INTO public.consultation_types (id, name, default_duration, color) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Consulta Oftalmologia', 30, '#3b82f6'),      -- ❌ REMOVER
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cirurgia Cataratas', 60, '#8b5cf6'),         -- ❌ REMOVER
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Cirurgia Refrativa', 45, '#06b6d4'),        -- ❌ REMOVER
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Consulta Dentária', 30, '#10b981'),         -- ✅ MANTER
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Ortodontia', 45, '#f59e0b'),                -- ✅ MANTER
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Implantologia', 60, '#ef4444');             -- ✅ MANTER
```

**Deve incluir consultas de:**
- **Medicina Dentária:** Consulta Dentária, Ortodontia, Implantologia, Branqueamento, Endodontia, Cirurgia Oral, Próteses
- **Rejuvenescimento Facial:** Botox, Filler, Harmonização Facial, Bioestimuladores, Mesoterapia, Peeling

---

#### 3. Salas (linhas 227-230)
```sql
INSERT INTO public.rooms (id, name, specialty_id) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Gabinete 1', '11111111-1111-1111-1111-111111111111'),  -- ❌ FK Oftalmologia
  ('22222222-aaaa-aaaa-aaaa-222222222222', 'Gabinete 2', '22222222-2222-2222-2222-222222222222'),  -- Medicina Dentária
  ('33333333-aaaa-aaaa-aaaa-333333333333', 'Gabinete 3', NULL);
```

**Ajustar:** Gabinete 1 deve referenciar nova especialidade

---

#### 4. Profissionais (linhas 233-238)
```sql
INSERT INTO public.professionals (id, name, specialty_id, color) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'Dr. António Silva', '11111111-1111-1111-1111-111111111111', '#3b82f6'),    -- ❌ Oftalmologia
  ('aaaa2222-2222-2222-2222-222222222222', 'Dra. Maria Santos', '11111111-1111-1111-1111-111111111111', '#8b5cf6'),    -- ❌ Oftalmologia
  ('aaaa3333-3333-3333-3333-333333333333', 'Dr. João Ferreira', '22222222-2222-2222-2222-222222222222', '#10b981'),    -- ✅ Medicina Dentária
  ('aaaa4444-4444-4444-4444-444444444444', 'Dra. Ana Costa', '22222222-2222-2222-2222-222222222222', '#f59e0b'),       -- ✅ Medicina Dentária
  ('aaaa5555-5555-5555-5555-555555555555', 'Dr. Pedro Oliveira', '22222222-2222-2222-2222-222222222222', '#ef4444');   -- ✅ Medicina Dentária
```

**Ajustar:** Redistribuir profissionais entre as duas especialidades

---

## 🎯 ENUMS (TIPOS DE DADOS FIXOS)

### ✅ Bem Configurados

```typescript
app_role: 'admin' | 'user'

appointment_status: 
  'scheduled'      // Marcada
  'confirmed'      // Confirmada
  'waiting'        // Em espera (check-in feito)
  'in_progress'    // Em atendimento
  'completed'      // Concluída
  'cancelled'      // Cancelada
  'no_show'        // Não compareceu
  'pre_confirmed'  // Pré-confirmada (WhatsApp)

waitlist_priority: 'low' | 'medium' | 'high'

time_preference: 'morning' | 'afternoon' | 'any'
```

---

## 🔐 SEGURANÇA (ROW LEVEL SECURITY)

### ✅ Estado: EXCELENTE

#### Configuração Atual
- ✅ Todas as 12 tabelas têm **RLS ativado**
- ✅ Função `has_role()` implementada corretamente
- ✅ Políticas admin configuradas
- ✅ Tabelas públicas permitem INSERT anónimo (`appointment_requests`, `contact_messages`)

#### Políticas Aplicadas
```sql
-- Exemplo de política típica
CREATE POLICY "Admins can manage [table]"
  ON public.[table]
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

#### ⚠️ Atenção
É necessário criar pelo menos **1 utilizador admin** para aceder ao painel administrativo:
```sql
-- Após criar utilizador via Supabase Auth
INSERT INTO public.user_roles (user_id, role) 
VALUES ('[USER_UUID]', 'admin');
```

---

## 📊 ÍNDICES DE PERFORMANCE

### O que são Índices?
Índices são estruturas que aceleram pesquisas na base de dados, funcionando como um "índice de livro". Sem índices, o Supabase precisa verificar **todas as linhas** de uma tabela para encontrar dados.

### ✅ Índices Existentes

```sql
-- Appointments
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_professional ON appointments(professional_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);

-- Patients
CREATE INDEX idx_patients_nif ON patients(nif);

-- Waitlist
CREATE INDEX idx_waitlist_priority ON waitlist(priority);
CREATE INDEX idx_waitlist_sort_order ON waitlist(sort_order);

-- WhatsApp Workflows
CREATE INDEX idx_whatsapp_workflows_pending ON whatsapp_workflows(status, scheduled_at) 
  WHERE status = 'pending';
CREATE INDEX idx_whatsapp_workflows_appointment ON whatsapp_workflows(appointment_id);
```

### 🟡 Índices Recomendados (Melhoria de Performance)

```sql
-- Contact Messages - filtrar por status
CREATE INDEX idx_contact_messages_status 
  ON contact_messages(status);

-- Contact Messages - ordenar por data
CREATE INDEX idx_contact_messages_created_at 
  ON contact_messages(created_at DESC);

-- Appointment Requests - filtrar por status
CREATE INDEX idx_appointment_requests_status 
  ON appointment_requests(status);

-- Appointment Requests - ordenar por data preferida
CREATE INDEX idx_appointment_requests_preferred_date 
  ON appointment_requests(preferred_date);

-- WhatsApp Workflows - filtrar por tipo
CREATE INDEX idx_whatsapp_workflows_type 
  ON whatsapp_workflows(workflow_type);
```

**Impacto esperado:** Redução de 50-90% no tempo de queries em tabelas com muitos registos.

---

## 🔄 TRIGGERS (AUTOMATIZAÇÕES)

### ✅ Configurados

```sql
-- Atualiza automaticamente o campo updated_at
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_settings_updated_at
  BEFORE UPDATE ON clinic_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_requests_updated_at
  BEFORE UPDATE ON appointment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_workflows_updated_at
  BEFORE UPDATE ON whatsapp_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 📝 MIGRAÇÕES APLICADAS

### Lista de Migrações (6 ficheiros)

1. **`20251231023352`** - Sistema de roles (admin/user)
2. **`20251231141633`** - Tabelas principais + seed data ⚠️
3. **`20251231144917`** - Fix função `update_updated_at_column`
4. **`20260103122558`** - Recreação de políticas RLS
5. **`20260103123427`** - Tabelas públicas (requests + messages)
6. **`20260103125627`** - WhatsApp workflows + status `pre_confirmed`

---

## 🚀 AÇÕES NECESSÁRIAS

### 🔴 PRIORIDADE 1: LIMPEZA DE DADOS

#### Criar Nova Migração
**Ficheiro:** `supabase/migrations/[timestamp]_clean_ophthalmology_data.sql`

**Objetivos:**
1. Remover especialidade "Oftalmologia"
2. Adicionar especialidade "Rejuvenescimento Facial"
3. Remover tipos de consulta de oftalmologia
4. Adicionar tipos de consulta de rejuvenescimento facial
5. Atualizar profissionais e salas

**Impacto:** ⚠️ Esta migração irá **DELETAR** dados. Certifica-te que não existem pacientes ou consultas reais antes de executar.

---

### 🟡 PRIORIDADE 2: MELHORIAS DE PERFORMANCE

#### Adicionar Índices Recomendados
**Ficheiro:** `supabase/migrations/[timestamp]_add_performance_indexes.sql`

**Benefícios:**
- Queries 50-90% mais rápidas
- Melhor experiência de utilizador no admin
- Menor carga no servidor Supabase

---

### 🟢 PRIORIDADE 3: UTILIZADOR ADMIN

#### Criar Primeiro Admin
Após registar utilizador no Supabase Auth:

```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('[USER_UUID_DO_SUPABASE_AUTH]', 'admin');
```

**Nota:** Podes obter o UUID do utilizador no painel do Supabase → Authentication → Users

---

## 📋 FUNCIONALIDADES WEBSITE vs SUPABASE

| Funcionalidade | Frontend | Backend | Status |
|---|---|---|---|
| **Landing Page - Hero** | ✅ | N/A | ✅ OK |
| **Sobre Nós** | ✅ | N/A | ✅ OK |
| **Serviços** | ✅ Hardcoded | N/A | ✅ OK |
| **Equipa Médica** | ✅ Hardcoded | `professionals` | 🟡 Usar DB |
| **Formulário Marcação** | ✅ | `appointment_requests` | ✅ OK |
| **Testemunhos** | ✅ | Google Reviews | ✅ OK |
| **Contacto** | ✅ | `contact_messages` | ✅ OK |
| **Google Maps** | ✅ | N/A | ✅ OK |
| **Admin - Login** | ✅ | Supabase Auth | ✅ OK |
| **Admin - Dashboard** | ✅ | Várias tabelas | ✅ OK |
| **Admin - Agenda** | ✅ | `appointments` | ✅ OK |
| **Admin - Pacientes** | ✅ | `patients` | ✅ OK |
| **Admin - Pedidos** | ✅ | `appointment_requests` | ✅ OK |
| **Admin - Mensagens** | ✅ | `contact_messages` | ✅ OK |
| **Admin - Sala Espera** | ✅ | `appointments` (waiting) | ✅ OK |
| **Admin - Lista Espera** | ✅ | `waitlist` | ✅ OK |
| **Admin - Definições** | ✅ | `clinic_settings` | ✅ OK |

---

## 🎁 EXTRAS / MELHORIAS FUTURAS

### Considerar Adicionar

1. **Soft Deletes** - Em vez de apagar registos, marcar como "deleted"
   ```sql
   ALTER TABLE patients ADD COLUMN deleted_at TIMESTAMPTZ;
   ```

2. **Audit Log** - Rastrear alterações importantes
   ```sql
   CREATE TABLE audit_log (
     id UUID PRIMARY KEY,
     table_name TEXT,
     record_id UUID,
     action TEXT,
     old_data JSONB,
     new_data JSONB,
     user_id UUID,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

3. **Notificações** - Sistema de notificações in-app
   ```sql
   CREATE TABLE notifications (
     id UUID PRIMARY KEY,
     user_id UUID,
     title TEXT,
     message TEXT,
     read_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

4. **Serviços Dinâmicos** - Gerir serviços pelo admin
   ```sql
   CREATE TABLE services (
     id UUID PRIMARY KEY,
     specialty_id UUID REFERENCES specialties(id),
     name TEXT,
     description TEXT,
     price DECIMAL(10,2),
     duration INTEGER,
     image_url TEXT,
     is_active BOOLEAN DEFAULT true
   );
   ```

---

## 📞 CONTACTOS & RECURSOS

### Supabase Dashboard
- **URL:** https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp
- **Project ID:** `ihkjadztuopcvvmmodpp`

### Documentação
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ CONCLUSÃO

O Supabase está **bem configurado** e pronto para produção. A única ação **crítica** é limpar as referências a Oftalmologia nos dados de exemplo. As melhorias de performance (índices) são recomendadas mas não obrigatórias para começar.

**Próximo passo:** Criar e executar a migração de limpeza de dados.

---

*Documento gerado em 27/01/2026 - Projeto Barnum*
