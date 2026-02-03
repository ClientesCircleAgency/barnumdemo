-- =============================================
-- BARNUM - SETUP COMPLETO DA BASE DE DADOS
-- =============================================
-- INSTRUÇÕES:
-- 1. Abrir: https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp/sql/new
-- 2. Copiar TODO este ficheiro
-- 3. Colar no SQL Editor
-- 4. Clicar em "RUN" (executar)
-- =============================================

-- =============================================
-- MIGRAÇÃO 1: SISTEMA DE ROLES
-- =============================================

-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de roles de utilizadores
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Ativar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função para verificar roles (SECURITY DEFINER evita recursividade)
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

-- Política: admins podem ver todas as roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Política: utilizadores podem ver as suas próprias roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- MIGRAÇÃO 2: TABELAS PRINCIPAIS + ENUMS
-- =============================================

-- 1. CRIAR ENUMS
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled',    -- Marcada
  'confirmed',    -- Confirmada
  'waiting',      -- Em espera (check-in feito)
  'in_progress',  -- Em atendimento
  'completed',    -- Concluída
  'cancelled',    -- Cancelada
  'no_show',      -- Não compareceu
  'pre_confirmed' -- Pré-confirmada (adicionado depois)
);

CREATE TYPE public.waitlist_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.time_preference AS ENUM ('morning', 'afternoon', 'any');

-- 2. CRIAR TABELAS

-- Especialidades
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tipos de Consulta
CREATE TABLE public.consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_duration INTEGER NOT NULL DEFAULT 30,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salas
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profissionais
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pacientes
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

-- Consultas
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

-- Lista de Espera
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

-- Configurações da Clínica
CREATE TABLE public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ÍNDICES PARA PERFORMANCE

CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_patients_nif ON public.patients(nif);
CREATE INDEX idx_waitlist_priority ON public.waitlist(priority);
CREATE INDEX idx_waitlist_sort_order ON public.waitlist(sort_order);

-- 4. TRIGGERS PARA UPDATED_AT

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinic_settings_updated_at
  BEFORE UPDATE ON public.clinic_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. HABILITAR RLS EM TODAS AS TABELAS

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES - ADMINS TÊM ACESSO TOTAL

-- Specialties
CREATE POLICY "Admins can manage specialties" ON public.specialties
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Consultation Types
CREATE POLICY "Admins can manage consultation_types" ON public.consultation_types
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rooms
CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Professionals
CREATE POLICY "Admins can manage professionals" ON public.professionals
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Patients
CREATE POLICY "Admins can manage patients" ON public.patients
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Appointments
CREATE POLICY "Admins can manage appointments" ON public.appointments
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Waitlist
CREATE POLICY "Admins can manage waitlist" ON public.waitlist
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clinic Settings
CREATE POLICY "Admins can manage clinic_settings" ON public.clinic_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MIGRAÇÃO 3: TABELAS PÚBLICAS
-- =============================================

-- Pedidos de marcação (website público)
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

-- Enable RLS
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- Public can insert (anyone can submit a request)
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

-- Trigger for updated_at
CREATE TRIGGER update_appointment_requests_updated_at
BEFORE UPDATE ON public.appointment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens de contacto (website público)
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Public can insert (anyone can send a message)
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read/update/delete
CREATE POLICY "Admins can manage contact messages"
ON public.contact_messages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================
-- MIGRAÇÃO 4: WHATSAPP WORKFLOWS
-- =============================================

-- Create table to track WhatsApp workflow messages
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

-- Enable RLS
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage whatsapp_workflows"
ON public.whatsapp_workflows
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient queries on pending workflows
CREATE INDEX idx_whatsapp_workflows_pending ON public.whatsapp_workflows(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_whatsapp_workflows_appointment ON public.whatsapp_workflows(appointment_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_workflows_updated_at
BEFORE UPDATE ON public.whatsapp_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SEED DATA - DADOS INICIAIS CORRIGIDOS (SEM OFTALMOLOGIA)
-- =============================================

-- Especialidades (APENAS Medicina Dentária e Rejuvenescimento Facial)
INSERT INTO public.specialties (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Medicina Dentária'),
  ('22222222-2222-2222-2222-222222222222', 'Rejuvenescimento Facial');

-- Tipos de Consulta
INSERT INTO public.consultation_types (id, name, default_duration, color) VALUES
  -- Medicina Dentária
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Consulta Dentária', 30, '#10b981'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Ortodontia', 45, '#f59e0b'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Implantologia', 60, '#ef4444'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Branqueamento Dentário', 60, '#06b6d4'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Endodontia', 60, '#8b5cf6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Cirurgia Oral', 45, '#ec4899'),
  -- Rejuvenescimento Facial
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Botox', 30, '#3b82f6'),
  ('22222222-aaaa-aaaa-aaaa-222222222222', 'Filler (Preenchimento)', 45, '#8b5cf6'),
  ('33333333-aaaa-aaaa-aaaa-333333333333', 'Harmonização Facial', 60, '#06b6d4'),
  ('44444444-aaaa-aaaa-aaaa-444444444444', 'Bioestimuladores', 45, '#10b981'),
  ('55555555-aaaa-aaaa-aaaa-555555555555', 'Mesoterapia', 30, '#f59e0b'),
  ('66666666-aaaa-aaaa-aaaa-666666666666', 'Peeling Químico', 45, '#ef4444');

-- Salas
INSERT INTO public.rooms (id, name, specialty_id) VALUES
  ('11111111-bbbb-bbbb-bbbb-111111111111', 'Gabinete Dentário 1', '11111111-1111-1111-1111-111111111111'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'Gabinete Dentário 2', '11111111-1111-1111-1111-111111111111'),
  ('33333333-bbbb-bbbb-bbbb-333333333333', 'Gabinete Estética 1', '22222222-2222-2222-2222-222222222222'),
  ('44444444-bbbb-bbbb-bbbb-444444444444', 'Gabinete Polivalente', NULL);

-- Profissionais (distribuídos pelas 2 especialidades)
INSERT INTO public.professionals (id, name, specialty_id, color) VALUES
  -- Medicina Dentária
  ('aaaa3333-3333-3333-3333-333333333333', 'Dr. João Ferreira', '11111111-1111-1111-1111-111111111111', '#10b981'),
  ('aaaa4444-4444-4444-4444-444444444444', 'Dra. Ana Costa', '11111111-1111-1111-1111-111111111111', '#f59e0b'),
  ('aaaa5555-5555-5555-5555-555555555555', 'Dr. Pedro Oliveira', '11111111-1111-1111-1111-111111111111', '#ef4444'),
  -- Rejuvenescimento Facial
  ('aaaa1111-1111-1111-1111-111111111111', 'Dr. António Silva', '22222222-2222-2222-2222-222222222222', '#3b82f6'),
  ('aaaa2222-2222-2222-2222-222222222222', 'Dra. Maria Santos', '22222222-2222-2222-2222-222222222222', '#8b5cf6');

-- Configurações padrão
INSERT INTO public.clinic_settings (key, value) VALUES
  ('working_hours', '{"monday": {"start": "09:00", "end": "18:00", "enabled": true}, "tuesday": {"start": "09:00", "end": "18:00", "enabled": true}, "wednesday": {"start": "09:00", "end": "18:00", "enabled": true}, "thursday": {"start": "09:00", "end": "18:00", "enabled": true}, "friday": {"start": "09:00", "end": "17:00", "enabled": true}, "saturday": {"start": "09:00", "end": "13:00", "enabled": true}, "sunday": {"start": "09:00", "end": "13:00", "enabled": false}}'),
  ('default_duration', '30'),
  ('buffer_between_appointments', '5');

-- =============================================
-- ÍNDICES ADICIONAIS DE PERFORMANCE
-- =============================================

CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_appointment_requests_status ON appointment_requests(status);
CREATE INDEX idx_appointment_requests_preferred_date ON appointment_requests(preferred_date);
CREATE INDEX idx_whatsapp_workflows_type ON whatsapp_workflows(workflow_type);

-- =============================================
-- FIM DO SETUP
-- =============================================
-- Se não houve erros, a base de dados está pronta!
-- Próximo passo: Criar utilizador admin
