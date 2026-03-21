-- =============================================
-- FASE 4: CRIAÇÃO DE ENUMS, TABELAS, RLS E SEED DATA
-- =============================================

-- 1. CRIAR ENUMS
-- =============================================

CREATE TYPE public.appointment_status AS ENUM (
  'scheduled',    -- Marcada
  'confirmed',    -- Confirmada
  'waiting',      -- Em espera (check-in feito)
  'in_progress',  -- Em atendimento
  'completed',    -- Concluída
  'cancelled',    -- Cancelada
  'no_show'       -- Não compareceu
);

CREATE TYPE public.waitlist_priority AS ENUM ('low', 'medium', 'high');

CREATE TYPE public.time_preference AS ENUM ('morning', 'afternoon', 'any');

-- 2. CRIAR TABELAS
-- =============================================

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
-- =============================================

CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_patients_nif ON public.patients(nif);
CREATE INDEX idx_waitlist_priority ON public.waitlist(priority);
CREATE INDEX idx_waitlist_sort_order ON public.waitlist(sort_order);

-- 4. TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- =============================================

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES - ADMINS TÊM ACESSO TOTAL
-- =============================================

-- Specialties
CREATE POLICY "Admins can manage specialties" ON public.specialties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Consultation Types
CREATE POLICY "Admins can manage consultation_types" ON public.consultation_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rooms
CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Professionals
CREATE POLICY "Admins can manage professionals" ON public.professionals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Patients
CREATE POLICY "Admins can manage patients" ON public.patients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Appointments
CREATE POLICY "Admins can manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Waitlist
CREATE POLICY "Admins can manage waitlist" ON public.waitlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clinic Settings
CREATE POLICY "Admins can manage clinic_settings" ON public.clinic_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. SEED DATA - DADOS INICIAIS
-- =============================================

-- Especialidades
INSERT INTO public.specialties (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Oftalmologia'),
  ('22222222-2222-2222-2222-222222222222', 'Medicina Dentária');

-- Tipos de Consulta
INSERT INTO public.consultation_types (id, name, default_duration, color) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Consulta Oftalmologia', 30, '#3b82f6'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cirurgia Cataratas', 60, '#8b5cf6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Cirurgia Refrativa', 45, '#06b6d4'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Consulta Dentária', 30, '#10b981'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Ortodontia', 45, '#f59e0b'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Implantologia', 60, '#ef4444');

-- Salas
INSERT INTO public.rooms (id, name, specialty_id) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'Gabinete 1', '11111111-1111-1111-1111-111111111111'),
  ('22222222-aaaa-aaaa-aaaa-222222222222', 'Gabinete 2', '22222222-2222-2222-2222-222222222222'),
  ('33333333-aaaa-aaaa-aaaa-333333333333', 'Gabinete 3', NULL);

-- Profissionais
INSERT INTO public.professionals (id, name, specialty_id, color) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'Dr. António Silva', '11111111-1111-1111-1111-111111111111', '#3b82f6'),
  ('aaaa2222-2222-2222-2222-222222222222', 'Dra. Maria Santos', '11111111-1111-1111-1111-111111111111', '#8b5cf6'),
  ('aaaa3333-3333-3333-3333-333333333333', 'Dr. João Ferreira', '22222222-2222-2222-2222-222222222222', '#10b981'),
  ('aaaa4444-4444-4444-4444-444444444444', 'Dra. Ana Costa', '22222222-2222-2222-2222-222222222222', '#f59e0b'),
  ('aaaa5555-5555-5555-5555-555555555555', 'Dr. Pedro Oliveira', '22222222-2222-2222-2222-222222222222', '#ef4444');

-- Configurações padrão
INSERT INTO public.clinic_settings (key, value) VALUES
  ('working_hours', '{"monday": {"start": "09:00", "end": "18:00", "enabled": true}, "tuesday": {"start": "09:00", "end": "18:00", "enabled": true}, "wednesday": {"start": "09:00", "end": "18:00", "enabled": true}, "thursday": {"start": "09:00", "end": "18:00", "enabled": true}, "friday": {"start": "09:00", "end": "17:00", "enabled": true}, "saturday": {"start": "09:00", "end": "13:00", "enabled": true}, "sunday": {"start": "09:00", "end": "13:00", "enabled": false}}'),
  ('default_duration', '30'),
  ('buffer_between_appointments', '5');