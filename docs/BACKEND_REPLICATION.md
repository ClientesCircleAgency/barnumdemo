# BACKEND REPLICATION GUIDE - BARNUM

**Project:** Barnun - Clínica de Medicina Dentária e Rejuvenescimento Facial  
**Version:** 1.0  
**Last Updated:** 2026-01-27  
**Purpose:** Complete guide to replicate the backend architecture in another project

---

## 1. VISÃO GERAL

### Stack Tecnológico

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Database** | PostgreSQL (via Supabase) | 14.x | Relational database with advanced features |
| **BaaS** | Supabase | Latest | Backend-as-a-Service (DB + Auth + Storage + Realtime) |
| **Authentication** | Supabase Auth | Latest | User authentication with email/password |
| **Authorization** | Row Level Security (RLS) | PostgreSQL | Fine-grained access control |
| **API** | PostgREST (via Supabase) | Auto-generated | RESTful API from database schema |
| **Hosting** | Supabase Cloud | N/A | Managed PostgreSQL instance |

### Architecture Decisions

**Why Supabase?**
- ✅ **Rapid Development**: Auto-generated REST API from schema
- ✅ **Built-in Auth**: No need for custom auth implementation
- ✅ **RLS Security**: Database-level security (not application-level)
- ✅ **Real-time**: WebSocket support for live updates
- ✅ **Type Safety**: Auto-generated TypeScript types
- ✅ **Cost**: Free tier suitable for MVP, scalable pricing

**Why PostgreSQL?**
- ✅ **ACID Compliance**: Data integrity guaranteed
- ✅ **Advanced Features**: JSON support, full-text search, triggers
- ✅ **Mature Ecosystem**: Battle-tested, extensive documentation
- ✅ **RLS Support**: Native row-level security

---

## 2. SISTEMA DE ROLES

### 2.1 Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```

**Rationale:**
- Only 2 roles needed for clinic management system
- `admin`: Full access to all features (clinic staff)
- `user`: Reserved for future patient portal (not currently used)
- ENUM ensures type safety and prevents invalid values

### 2.2 Tabela `user_roles`

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);
```

**Schema Decisions:**
- `user_id` → `auth.users`: Links to Supabase Auth users
- `ON DELETE CASCADE`: When user deleted, roles auto-deleted
- `UNIQUE (user_id, role)`: Prevents duplicate role assignments
- No `updated_at`: Roles rarely change, not needed

**Índices:**
- Primary key on `id` (automatic)
- Unique index on `(user_id, role)` (automatic from constraint)
- **Missing but recommended**: `CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);`

### 2.3 Função `has_role()`

```sql
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

**Critical Design Decisions:**

**`SECURITY DEFINER`:**
- Function runs with **creator's permissions**, not caller's
- **Why**: RLS policies call this function → without SECURITY DEFINER, infinite recursion
- **Security**: `SET search_path = public` prevents schema injection attacks

**`STABLE`:**
- Indicates function doesn't modify database
- Allows PostgreSQL to optimize queries (cache results within transaction)

**`EXISTS` vs `COUNT`:**
- `EXISTS` stops at first match (faster)
- `COUNT(*)` would scan all rows unnecessarily

### 2.4 RLS Policies on `user_roles`

```sql
-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

**Policy Design:**
- **Two SELECT policies**: OR logic (either condition grants access)
- **No INSERT/UPDATE/DELETE policies**: Only superadmin can modify roles (via SQL Editor)
- **`TO authenticated`**: Only logged-in users (anonymous users blocked)
- **`auth.uid()`**: Supabase function returning current user's UUID

---

## 3. TODAS AS TABELAS

### 3.1 Tabela `specialties` (Especialidades)

**Purpose:** Medical specialties offered by the clinic

```sql
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema:**
- `id`: UUID for global uniqueness
- `name`: Specialty name (e.g., "Medicina Dentária", "Rejuvenescimento Facial")
- `created_at`: Audit trail

**Constraints:**
- `NOT NULL` on `name`: Every specialty must have a name
- No `UNIQUE` on `name`: Intentional - allows soft deletes/reactivations

**Foreign Keys:** None (root table)

**Índices:**
- Primary key on `id` (automatic)
- **Recommended**: `CREATE INDEX idx_specialties_name ON specialties(name);` for search

**Triggers:** None

**RLS:**
```sql
CREATE POLICY "Admins can manage specialties" ON public.specialties
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```
- `FOR ALL`: Covers SELECT, INSERT, UPDATE, DELETE
- `USING`: Read permission
- `WITH CHECK`: Write permission (INSERT/UPDATE)

**Seed Data:**
```sql
INSERT INTO public.specialties (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Medicina Dentária'),
  ('22222222-2222-2222-2222-222222222222', 'Rejuvenescimento Facial');
```
- Fixed UUIDs for referential integrity in seed data
- Only 2 specialties (clinic's core services)

---

### 3.2 Tabela `consultation_types` (Tipos de Consulta)

**Purpose:** Specific services offered within each specialty

```sql
CREATE TABLE public.consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_duration INTEGER NOT NULL DEFAULT 30,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema:**
- `name`: Service name (e.g., "Botox", "Ortodontia")
- `default_duration`: Minutes (used for calendar scheduling)
- `color`: Hex color for calendar UI (e.g., "#3b82f6")

**Design Decisions:**
- **No FK to `specialties`**: Services can be cross-specialty
- **`default_duration` not NULL**: Every service must have duration
- **`color` nullable**: Optional UI enhancement

**Índices:**
- Primary key on `id`
- **Recommended**: `CREATE INDEX idx_consultation_types_name ON consultation_types(name);`

**Triggers:** None

**RLS:** Same pattern as `specialties` (admin-only)

**Seed Data:**
```sql
-- Medicina Dentária (6 services)
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Consulta Dentária', 30, '#10b981'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Ortodontia', 45, '#f59e0b'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Implantologia', 60, '#ef4444'),
-- ... more

-- Rejuvenescimento Facial (6 services)
('11111111-aaaa-aaaa-aaaa-111111111111', 'Botox', 30, '#3b82f6'),
-- ... more
```

---

### 3.3 Tabela `rooms` (Salas/Gabinetes)

**Purpose:** Physical rooms where consultations happen

```sql
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Foreign Keys:**
- `specialty_id` → `specialties(id)` **ON DELETE SET NULL**
  - **Why SET NULL**: If specialty deleted, room remains (becomes general-purpose)
  - **Alternative considered**: `ON DELETE CASCADE` (rejected - too destructive)
  - **Alternative considered**: `ON DELETE RESTRICT` (rejected - too rigid)

**Índices:**
- Primary key on `id`
- **Automatic**: Index on `specialty_id` (FK creates index)

**Triggers:** None

**RLS:** Admin-only (same pattern)

**Seed Data:**
```sql
('11111111-bbbb-bbbb-bbbb-111111111111', 'Gabinete Dentário 1', '11111111-...'),
('22222222-bbbb-bbbb-bbbb-222222222222', 'Gabinete Dentário 2', '11111111-...'),
('33333333-bbbb-bbbb-bbbb-333333333333', 'Gabinete Estética 1', '22222222-...'),
('44444444-bbbb-bbbb-bbbb-444444444444', 'Gabinete Polivalente', NULL),
```
- 4 rooms: 2 dental, 1 aesthetic, 1 multi-purpose

---

### 3.4 Tabela `professionals` (Profissionais)

**Purpose:** Doctors and medical staff

```sql
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema:**
- `color`: For calendar color-coding (each professional has unique color)
- `avatar_url`: Optional profile picture (Supabase Storage URL)
- `specialty_id`: Primary specialty (professionals can work cross-specialty)

**Design Decisions:**
- **No `user_id` FK**: Professionals are not necessarily system users
- **`color` has DEFAULT**: Ensures calendar always works
- **`avatar_url` nullable**: Not all professionals have photos

**Foreign Keys:**
- `specialty_id` → `specialties(id)` **ON DELETE SET NULL** (same rationale as rooms)

**Índices:**
- Primary key on `id`
- FK index on `specialty_id` (automatic)
- **Recommended**: `CREATE INDEX idx_professionals_name ON professionals(name);`

**Triggers:** None

**RLS:** Admin-only

**Seed Data:**
```sql
-- 3 Dental professionals
('aaaa3333-...', 'Dr. João Ferreira', '11111111-...', '#10b981'),
('aaaa4444-...', 'Dra. Ana Costa', '11111111-...', '#f59e0b'),
('aaaa5555-...', 'Dr. Pedro Oliveira', '11111111-...', '#ef4444'),

-- 2 Aesthetic professionals
('aaaa1111-...', 'Dr. António Silva', '22222222-...', '#3b82f6'),
('aaaa2222-...', 'Dra. Maria Santos', '22222222-...', '#8b5cf6'),
```

---

### 3.5 Tabela `patients` (Pacientes)

**Purpose:** Patient records

```sql
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nif TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  birth_date DATE,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema:**
- `nif`: Portuguese tax ID (unique patient identifier)
- `tags`: PostgreSQL array for flexible categorization (e.g., ["VIP", "Allergic to X"])
- `email` nullable: Not all patients have email
- `birth_date` nullable: Optional demographic data

**Constraints:**
- `UNIQUE (nif)`: Prevents duplicate patients
- `NOT NULL` on `nif, name, phone`: Minimum required data

**Design Decisions:**
- **No `user_id` FK**: Patients are not system users (no patient portal yet)
- **`tags` as TEXT[]**: More flexible than junction table for simple categorization
- **`notes` as TEXT**: Unstructured clinical notes (future: structured medical records)

**Índices:**
```sql
CREATE INDEX idx_patients_nif ON public.patients(nif);
```
- **Why**: NIF is primary lookup field (patient check-in, search)
- **UNIQUE constraint already creates index**, but explicit for clarity

**Triggers:**
```sql
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```
- Auto-updates `updated_at` on every modification

**RLS:** Admin-only

**Seed Data:** None (real patient data added via admin panel)

---

### 3.6 Tabela `appointments` (Consultas)

**Purpose:** Scheduled appointments

```sql
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  consultation_type_id UUID NOT NULL REFERENCES public.consultation_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Enum `appointment_status`:**
```sql
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled',      -- Initial state
  'confirmed',      -- Patient confirmed attendance
  'pre_confirmed',  -- Confirmed via WhatsApp automation
  'waiting',        -- Patient checked in (in waiting room)
  'in_progress',    -- Consultation started
  'completed',      -- Consultation finished
  'cancelled',      -- Cancelled by patient/clinic
  'no_show'         -- Patient didn't show up
);
```

**Foreign Keys - Critical Design:**

| FK | ON DELETE | Rationale |
|----|-----------|-----------|
| `patient_id` | **CASCADE** | If patient deleted, their appointments must go too (GDPR compliance) |
| `professional_id` | **CASCADE** | If professional leaves, historical appointments deleted (business decision) |
| `specialty_id` | **CASCADE** | If specialty removed, appointments invalid |
| `consultation_type_id` | **CASCADE** | If service discontinued, appointments invalid |
| `room_id` | **SET NULL** | If room removed, appointment still valid (room reassignable) |

**Design Decisions:**
- **Separate `date` and `time`**: Easier querying than TIMESTAMP
- **`duration` with DEFAULT**: Inherited from `consultation_types.default_duration` but overridable
- **`status` enum**: Type-safe state machine
- **`room_id` nullable**: Room assigned later (not at booking time)

**Índices:**
```sql
CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
```
- **Why `date`**: Most common query (daily/weekly agenda)
- **Why `status`**: Filter by status (e.g., show only waiting patients)
- **Why `professional_id`**: Professional's daily schedule
- **Why `patient_id`**: Patient's appointment history

**Triggers:**
```sql
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**RLS:** Admin-only

**Seed Data:** None (appointments created via admin panel)

---

### 3.7 Tabela `waitlist` (Lista de Espera)

**Purpose:** Patients waiting for available appointment slots

```sql
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  time_preference public.time_preference NOT NULL DEFAULT 'any',
  preferred_dates DATE[],
  priority public.waitlist_priority NOT NULL DEFAULT 'medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Enums:**
```sql
CREATE TYPE public.waitlist_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.time_preference AS ENUM ('morning', 'afternoon', 'any');
```

**Schema:**
- `preferred_dates`: Array of dates patient is available
- `sort_order`: Manual ordering (drag-and-drop in UI)
- `priority`: Urgency level
- `time_preference`: Morning/afternoon preference

**Design Decisions:**
- **`specialty_id` and `professional_id` both nullable**: Patient can wait for "any dentist" or "specific Dr. João"
- **`preferred_dates` as DATE[]**: Flexible date selection
- **`sort_order` for manual control**: Business logic may override priority

**Foreign Keys:**
- `patient_id` → **CASCADE**: If patient deleted, remove from waitlist
- `specialty_id` → **SET NULL**: If specialty removed, waitlist entry remains (manual review)
- `professional_id` → **SET NULL**: If professional leaves, waitlist entry remains

**Índices:**
```sql
CREATE INDEX idx_waitlist_priority ON public.waitlist(priority);
CREATE INDEX idx_waitlist_sort_order ON public.waitlist(sort_order);
```
- **Why**: Ordered list queries (ORDER BY priority, sort_order)

**Triggers:** None

**RLS:** Admin-only

**Seed Data:** None

---

### 3.8 Tabela `clinic_settings` (Configurações)

**Purpose:** Key-value store for clinic settings

```sql
CREATE TABLE public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema:**
- `key`: Setting name (e.g., "working_hours", "default_duration")
- `value`: JSONB for flexible schema

**Design Decisions:**
- **JSONB vs separate columns**: Flexible schema for varying setting types
- **UNIQUE on `key`**: Only one value per setting
- **No `created_at`**: Settings updated, not created

**Índices:**
- Primary key on `id`
- Unique index on `key` (automatic)

**Triggers:**
```sql
CREATE TRIGGER update_clinic_settings_updated_at
  BEFORE UPDATE ON public.clinic_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**RLS:** Admin-only

**Seed Data:**
```sql
INSERT INTO public.clinic_settings (key, value) VALUES
  ('working_hours', '{"monday": {"start": "09:00", "end": "18:00", "enabled": true}, ...}'),
  ('default_duration', '30'),
  ('buffer_between_appointments', '5');
```

---

### 3.9 Tabela `appointment_requests` (Pedidos de Marcação)

**Purpose:** Public appointment requests from website (not authenticated)

```sql
CREATE TABLE public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nif TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('dentaria', 'rejuvenescimento')),
  preferred_date DATE NOT NULL,
  preferred_time TIME WITHOUT TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID
);
```

**Schema:**
- `service_type`: High-level category (not FK - public users don't know internal IDs)
- `status`: Workflow state
- `processed_by`: Admin who handled request (no FK - allows admin deletion)

**Design Decisions:**
- **No FKs**: Public table, no referential integrity to internal tables
- **CHECK constraints**: Validate enum-like values without actual enums
- **`processed_at` and `processed_by`**: Audit trail

**Índices:**
```sql
CREATE INDEX idx_appointment_requests_status ON appointment_requests(status);
CREATE INDEX idx_appointment_requests_preferred_date ON appointment_requests(preferred_date);
```

**Triggers:**
```sql
CREATE TRIGGER update_appointment_requests_updated_at
  BEFORE UPDATE ON public.appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**RLS:**
```sql
-- Public can insert (anyone can submit)
CREATE POLICY "Anyone can submit appointment requests"
ON public.appointment_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read/update/delete
CREATE POLICY "Admins can manage appointment requests"
ON public.appointment_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
```

**Critical RLS Design:**
- **`TO anon`**: Allows unauthenticated users (public website)
- **`WITH CHECK (true)`**: No restrictions on INSERT
- **Separate admin policy**: Prevents public from reading others' requests

**Seed Data:** None

---

### 3.10 Tabela `contact_messages` (Mensagens de Contacto)

**Purpose:** Contact form submissions from website

```sql
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

**Schema:**
- `status`: Simple workflow (new → read → archived)
- No `updated_at`: Messages don't change after creation

**Índices:**
```sql
CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
```
- **Why `created_at DESC`**: Show newest messages first

**Triggers:** None

**RLS:** Same pattern as `appointment_requests` (public INSERT, admin ALL)

**Seed Data:** None

---

### 3.11 Tabela `whatsapp_workflows` (Automação WhatsApp)

**Purpose:** Track automated WhatsApp messages (confirmations, reminders)

```sql
CREATE TABLE public.whatsapp_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  phone text NOT NULL,
  workflow_type text NOT NULL CHECK (workflow_type IN ('confirmation_24h', 'review_reminder', 'availability_suggestion')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'expired', 'cancelled')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  response text,
  responded_at timestamptz,
  message_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Schema:**
- `workflow_type`: Type of automation
- `status`: Message lifecycle
- `message_payload`: JSONB with message template data
- `response`: Patient's reply (if any)

**Design Decisions:**
- **`appointment_id` nullable**: Some workflows not tied to appointment (e.g., availability suggestions)
- **`patient_id` not FK**: Allows sending to non-patients (future feature)
- **Timestamps for audit**: Track entire message lifecycle

**Foreign Keys:**
- `appointment_id` → **CASCADE**: If appointment deleted, workflow deleted

**Índices:**
```sql
CREATE INDEX idx_whatsapp_workflows_pending ON whatsapp_workflows(status, scheduled_at) 
  WHERE status = 'pending';
CREATE INDEX idx_whatsapp_workflows_appointment ON whatsapp_workflows(appointment_id);
CREATE INDEX idx_whatsapp_workflows_type ON whatsapp_workflows(workflow_type);
```
- **Partial index on pending**: Optimize cron job queries
- **Why `workflow_type`**: Filter by automation type

**Triggers:**
```sql
CREATE TRIGGER update_whatsapp_workflows_updated_at
  BEFORE UPDATE ON public.whatsapp_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**RLS:** Admin-only

**Seed Data:** None

---

## 4. RESUMO DE TABELAS

| Table | Purpose | Auth Required | RLS Policy | Seed Data |
|-------|---------|---------------|------------|-----------|
| `user_roles` | User permissions | ✅ | Admin view all, users view own | ❌ |
| `specialties` | Medical specialties | ✅ | Admin-only | ✅ 2 rows |
| `consultation_types` | Services offered | ✅ | Admin-only | ✅ 12 rows |
| `rooms` | Physical rooms | ✅ | Admin-only | ✅ 4 rows |
| `professionals` | Medical staff | ✅ | Admin-only | ✅ 5 rows |
| `patients` | Patient records | ✅ | Admin-only | ❌ |
| `appointments` | Scheduled appointments | ✅ | Admin-only | ❌ |
| `waitlist` | Waiting list | ✅ | Admin-only | ❌ |
| `clinic_settings` | Configuration | ✅ | Admin-only | ✅ 3 rows |
| `appointment_requests` | Public requests | ❌ Public INSERT | Public INSERT, Admin ALL | ❌ |
| `contact_messages` | Contact form | ❌ Public INSERT | Public INSERT, Admin ALL | ❌ |
| `whatsapp_workflows` | WhatsApp automation | ✅ | Admin-only | ❌ |

**Total:** 12 tables, 5 with seed data

---

## 5. PADRÕES E BOAS PRÁTICAS

### 5.1 RLS Patterns

**Pattern 1: Admin-Only Table**
```sql
CREATE POLICY "Admins can manage [table]" ON public.[table]
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```
- Used for: All internal tables
- `FOR ALL`: Single policy for all operations
- `USING` and `WITH CHECK`: Same condition (read = write permission)

**Pattern 2: Public Insert, Admin Manage**
```sql
CREATE POLICY "Anyone can submit [table]"
ON public.[table]
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage [table]"
ON public.[table]
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
```
- Used for: `appointment_requests`, `contact_messages`
- **Two policies**: OR logic (either grants access)
- `TO anon`: Allows unauthenticated users

**Pattern 3: View Own Data**
```sql
CREATE POLICY "Users can view own [table]"
  ON public.[table] FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```
- Used for: `user_roles`
- Only SELECT (no INSERT/UPDATE/DELETE)

### 5.2 Foreign Key Patterns

**CASCADE vs SET NULL Decision Matrix:**

| Scenario | ON DELETE | Rationale |
|----------|-----------|-----------|
| **Parent is core entity** (patient, professional) | CASCADE | Child data meaningless without parent |
| **Parent is configuration** (room, specialty) | SET NULL | Child data still valid, just unlinked |
| **Parent is optional** (room in appointment) | SET NULL | Child can exist without parent |

**Examples:**
- `appointments.patient_id` → CASCADE (appointment without patient = invalid)
- `appointments.room_id` → SET NULL (appointment without room = valid, room TBD)
- `professionals.specialty_id` → SET NULL (professional without specialty = general practitioner)

### 5.3 Security Definer Pattern

**When to use `SECURITY DEFINER`:**
- ✅ Functions called by RLS policies (prevents recursion)
- ✅ Functions accessing tables user shouldn't directly access
- ❌ Regular business logic functions (security risk)

**Always pair with `SET search_path`:**
```sql
CREATE FUNCTION my_function()
SECURITY DEFINER
SET search_path = public  -- Prevents schema injection
AS $$ ... $$;
```

### 5.4 Index Strategy

**Always index:**
- ✅ Foreign keys (automatic in PostgreSQL)
- ✅ Columns in WHERE clauses (status, date)
- ✅ Columns in ORDER BY (sort_order, created_at)
- ✅ UNIQUE constraints (automatic)

**Consider indexing:**
- 🟡 Columns in JOIN conditions
- 🟡 Columns in GROUP BY
- 🟡 Text columns with frequent LIKE queries

**Don't index:**
- ❌ Low-cardinality columns (boolean, small enums)
- ❌ Columns rarely queried
- ❌ Small tables (<1000 rows)

**Partial indexes for specific queries:**
```sql
CREATE INDEX idx_whatsapp_workflows_pending 
  ON whatsapp_workflows(status, scheduled_at) 
  WHERE status = 'pending';
```
- Only indexes pending workflows (smaller, faster)

---

## 6. ORDEM DE CRIAÇÃO

**Step-by-step sequence (order matters!):**

### Step 1: Enums
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.appointment_status AS ENUM (...);
CREATE TYPE public.waitlist_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.time_preference AS ENUM ('morning', 'afternoon', 'any');
```
**Why first:** Tables reference enums, must exist before table creation

### Step 2: Functions
```sql
CREATE FUNCTION public.has_role(...) ...;
CREATE FUNCTION public.update_updated_at_column() ...;
```
**Why before tables:** RLS policies and triggers reference functions

### Step 3: Root Tables (no FKs)
```sql
CREATE TABLE public.user_roles (...);
CREATE TABLE public.specialties (...);
CREATE TABLE public.consultation_types (...);
CREATE TABLE public.clinic_settings (...);
```

### Step 4: First-Level FK Tables
```sql
CREATE TABLE public.rooms (...);           -- FK to specialties
CREATE TABLE public.professionals (...);   -- FK to specialties
CREATE TABLE public.patients (...);        -- No FKs
```

### Step 5: Second-Level FK Tables
```sql
CREATE TABLE public.appointments (...);    -- FK to patients, professionals, etc.
CREATE TABLE public.waitlist (...);        -- FK to patients, specialties, professionals
```

### Step 6: Third-Level FK Tables
```sql
CREATE TABLE public.whatsapp_workflows (...);  -- FK to appointments
```

### Step 7: Public Tables (no FKs)
```sql
CREATE TABLE public.appointment_requests (...);
CREATE TABLE public.contact_messages (...);
```

### Step 8: Indices
```sql
CREATE INDEX idx_appointments_date ON appointments(date);
-- ... all other indices
```

### Step 9: Triggers
```sql
CREATE TRIGGER update_patients_updated_at ...;
-- ... all other triggers
```

### Step 10: RLS Policies
```sql
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage specialties" ...;
-- ... all other policies
```

### Step 11: Seed Data
```sql
INSERT INTO public.specialties ...;
INSERT INTO public.consultation_types ...;
-- ... all seed data
```

---

## 7. CHECKLIST DE REPLICAÇÃO

### Pre-Replication
- [ ] Supabase project created
- [ ] Database credentials obtained
- [ ] SQL Editor access confirmed

### Enums & Functions
- [ ] Create `app_role` enum
- [ ] Create `appointment_status` enum
- [ ] Create `waitlist_priority` enum
- [ ] Create `time_preference` enum
- [ ] Create `has_role()` function
- [ ] Create `update_updated_at_column()` function

### Tables (in order)
- [ ] Create `user_roles` table
- [ ] Create `specialties` table
- [ ] Create `consultation_types` table
- [ ] Create `clinic_settings` table
- [ ] Create `rooms` table
- [ ] Create `professionals` table
- [ ] Create `patients` table
- [ ] Create `appointments` table
- [ ] Create `waitlist` table
- [ ] Create `whatsapp_workflows` table
- [ ] Create `appointment_requests` table
- [ ] Create `contact_messages` table

### Indices
- [ ] Create all performance indices (see section 3)

### Triggers
- [ ] Attach `update_updated_at` triggers to 5 tables

### RLS
- [ ] Enable RLS on all 12 tables
- [ ] Create admin policies for 10 internal tables
- [ ] Create public INSERT policies for 2 public tables
- [ ] Create view-own policy for `user_roles`

### Seed Data
- [ ] Insert 2 specialties
- [ ] Insert 12 consultation types
- [ ] Insert 4 rooms
- [ ] Insert 5 professionals
- [ ] Insert 3 clinic settings

### Post-Migration
- [ ] Create first admin user (see section 8)
- [ ] Test RLS policies (see section 8)
- [ ] Verify all FKs work
- [ ] Test triggers fire correctly

---

## 8. CONFIGURAÇÃO PÓS-MIGRATION

### 8.1 Criar Primeiro Admin

**Step 1: Create User via Supabase Auth**
1. Go to: `https://supabase.com/dashboard/project/[PROJECT_ID]/auth/users`
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Check "Auto Confirm User"
5. Copy the user's UUID

**Step 2: Assign Admin Role**
```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('[USER_UUID_HERE]', 'admin');
```

**Step 3: Verify**
```sql
SELECT * FROM public.user_roles WHERE role = 'admin';
```

### 8.2 Validar RLS

**Test 1: Admin Can Access Everything**
```sql
-- Login as admin user in frontend
-- Try to query all tables - should succeed
SELECT * FROM specialties;
SELECT * FROM patients;
-- etc.
```

**Test 2: Unauthenticated Can Submit Requests**
```sql
-- Logout from frontend
-- Submit appointment request form - should succeed
-- Try to view requests - should fail
```

**Test 3: Non-Admin Cannot Access Internal Tables**
```sql
-- Create user without admin role
-- Try to query patients - should return empty (RLS blocks)
```

### 8.3 Verificar Integridade

**Check FK Constraints:**
```sql
-- Try to delete specialty with linked professionals - should fail
DELETE FROM specialties WHERE id = '11111111-1111-1111-1111-111111111111';
-- Error: violates foreign key constraint

-- Try to delete room - should succeed (SET NULL)
DELETE FROM rooms WHERE id = '44444444-bbbb-bbbb-bbbb-444444444444';
-- Success: appointments.room_id set to NULL
```

**Check Triggers:**
```sql
-- Update patient
UPDATE patients SET name = 'Test' WHERE id = '[PATIENT_ID]';

-- Verify updated_at changed
SELECT updated_at FROM patients WHERE id = '[PATIENT_ID]';
-- Should show current timestamp
```

---

## 9. NOTAS IMPORTANTES

### 9.1 Security Definer
- ⚠️ **Always use `SET search_path`** with `SECURITY DEFINER`
- ⚠️ Never use `SECURITY DEFINER` for user-facing functions (security risk)
- ✅ Only for RLS helper functions

### 9.2 Unique Constraints
- `patients.nif` is UNIQUE (prevents duplicate patients)
- `user_roles.(user_id, role)` is UNIQUE (prevents duplicate role assignments)
- `clinic_settings.key` is UNIQUE (one value per setting)

### 9.3 Cascade Deletes
- **Dangerous operations:**
  - Deleting patient → cascades to appointments, waitlist
  - Deleting professional → cascades to appointments
  - Deleting appointment → cascades to whatsapp_workflows
- **Mitigation:** Implement soft deletes in application layer (future enhancement)

### 9.4 Enums
- ⚠️ **Cannot remove enum values** (PostgreSQL limitation)
- ⚠️ **Cannot reorder enum values**
- ✅ Can add new values: `ALTER TYPE appointment_status ADD VALUE 'new_status';`
- 💡 **Alternative:** Use CHECK constraints instead of enums for flexibility

### 9.5 JSONB Performance
- `clinic_settings.value` is JSONB (flexible but slower than columns)
- **Mitigation:** Create GIN index if querying JSONB fields:
  ```sql
  CREATE INDEX idx_clinic_settings_value ON clinic_settings USING GIN (value);
  ```

### 9.6 Timezone Handling
- All `TIMESTAMPTZ` fields store in UTC
- **Frontend responsibility:** Convert to local timezone for display
- **Backend:** Always use `now()` (returns UTC)

---

## 10. SQL CONSOLIDADO

**Complete executable script:**

```sql
-- =============================================
-- BARNUM - COMPLETE DATABASE SETUP
-- =============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled', 'confirmed', 'pre_confirmed', 'waiting', 
  'in_progress', 'completed', 'cancelled', 'no_show'
);
CREATE TYPE public.waitlist_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.time_preference AS ENUM ('morning', 'afternoon', 'any');

-- 2. FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. TABLES (in dependency order)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_duration INTEGER NOT NULL DEFAULT 30,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nif TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  birth_date DATE,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  consultation_type_id UUID NOT NULL REFERENCES public.consultation_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  time_preference public.time_preference NOT NULL DEFAULT 'any',
  preferred_dates DATE[],
  priority public.waitlist_priority NOT NULL DEFAULT 'medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  phone text NOT NULL,
  workflow_type text NOT NULL CHECK (workflow_type IN ('confirmation_24h', 'review_reminder', 'availability_suggestion')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'expired', 'cancelled')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  response text,
  responded_at timestamptz,
  message_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nif TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('dentaria', 'rejuvenescimento')),
  preferred_date DATE NOT NULL,
  preferred_time TIME WITHOUT TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID
);

CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. INDICES
CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_patients_nif ON public.patients(nif);
CREATE INDEX idx_waitlist_priority ON public.waitlist(priority);
CREATE INDEX idx_waitlist_sort_order ON public.waitlist(sort_order);
CREATE INDEX idx_whatsapp_workflows_pending ON public.whatsapp_workflows(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_whatsapp_workflows_appointment ON public.whatsapp_workflows(appointment_id);
CREATE INDEX idx_whatsapp_workflows_type ON public.whatsapp_workflows(workflow_type);
CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_appointment_requests_status ON appointment_requests(status);
CREATE INDEX idx_appointment_requests_preferred_date ON appointment_requests(preferred_date);

-- 5. TRIGGERS
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinic_settings_updated_at
  BEFORE UPDATE ON public.clinic_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointment_requests_updated_at
  BEFORE UPDATE ON public.appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_workflows_updated_at
  BEFORE UPDATE ON public.whatsapp_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. ENABLE RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES
-- user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Internal tables (admin-only pattern)
CREATE POLICY "Admins can manage specialties" ON public.specialties FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage consultation_types" ON public.consultation_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage rooms" ON public.rooms FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage professionals" ON public.professionals FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage patients" ON public.patients FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage appointments" ON public.appointments FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage waitlist" ON public.waitlist FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage clinic_settings" ON public.clinic_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage whatsapp_workflows" ON public.whatsapp_workflows FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public tables
CREATE POLICY "Anyone can submit appointment requests" ON public.appointment_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage appointment requests" ON public.appointment_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can submit contact messages" ON public.contact_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage contact messages" ON public.contact_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 8. SEED DATA
INSERT INTO public.specialties (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Medicina Dentária'),
  ('22222222-2222-2222-2222-222222222222', 'Rejuvenescimento Facial');

INSERT INTO public.consultation_types (id, name, default_duration, color) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Consulta Dentária', 30, '#10b981'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Ortodontia', 45, '#f59e0b'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Implantologia', 60, '#ef4444'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Branqueamento Dentário', 60, '#06b6d4'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Endodontia', 60, '#8b5cf6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Cirurgia Oral', 45, '#ec4899'),
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Botox', 30, '#3b82f6'),
  ('22222222-aaaa-aaaa-aaaa-222222222222', 'Filler (Preenchimento)', 45, '#8b5cf6'),
  ('33333333-aaaa-aaaa-aaaa-333333333333', 'Harmonização Facial', 60, '#06b6d4'),
  ('44444444-aaaa-aaaa-aaaa-444444444444', 'Bioestimuladores', 45, '#10b981'),
  ('55555555-aaaa-aaaa-aaaa-555555555555', 'Mesoterapia', 30, '#f59e0b'),
  ('66666666-aaaa-aaaa-aaaa-666666666666', 'Peeling Químico', 45, '#ef4444');

INSERT INTO public.rooms (id, name, specialty_id) VALUES
  ('11111111-bbbb-bbbb-bbbb-111111111111', 'Gabinete Dentário 1', '11111111-1111-1111-1111-111111111111'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Gabinete Dentário 2', '11111111-1111-1111-1111-111111111111'),
  ('33333333-bbbb-bbbb-bbbb-333333333333', 'Gabinete Estética 1', '22222222-2222-2222-2222-222222222222'),
  ('44444444-bbbb-bbbb-bbbb-444444444444', 'Gabinete Polivalente', NULL);

INSERT INTO public.professionals (id, name, specialty_id, color) VALUES
  ('aaaa3333-3333-3333-3333-333333333333', 'Dr. João Ferreira', '11111111-1111-1111-1111-111111111111', '#10b981'),
  ('aaaa4444-4444-4444-4444-444444444444', 'Dra. Ana Costa', '11111111-1111-1111-1111-111111111111', '#f59e0b'),
  ('aaaa5555-5555-5555-5555-555555555555', 'Dr. Pedro Oliveira', '11111111-1111-1111-1111-111111111111', '#ef4444'),
  ('aaaa1111-1111-1111-1111-111111111111', 'Dr. António Silva', '22222222-2222-2222-2222-222222222222', '#3b82f6'),
  ('aaaa2222-2222-2222-2222-222222222222', 'Dra. Maria Santos', '22222222-2222-2222-2222-222222222222', '#8b5cf6');

INSERT INTO public.clinic_settings (key, value) VALUES
  ('working_hours', '{"monday": {"start": "09:00", "end": "18:00", "enabled": true}, "tuesday": {"start": "09:00", "end": "18:00", "enabled": true}, "wednesday": {"start": "09:00", "end": "18:00", "enabled": true}, "thursday": {"start": "09:00", "end": "18:00", "enabled": true}, "friday": {"start": "09:00", "end": "17:00", "enabled": true}, "saturday": {"start": "09:00", "end": "13:00", "enabled": true}, "sunday": {"start": "09:00", "end": "13:00", "enabled": false}}'),
  ('default_duration', '30'),
  ('buffer_between_appointments', '5');

-- =============================================
-- SETUP COMPLETE
-- Next: Create admin user (see section 8.1)
-- =============================================
```

---

**End of BACKEND_REPLICATION.md**

*This document provides complete backend architecture for replication. For frontend implementation details, see FUNCTIONAL_ANALYSIS.md*
