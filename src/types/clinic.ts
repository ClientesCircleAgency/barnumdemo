// Legacy types for backward compatibility with existing components
// These use camelCase while Supabase uses snake_case

// Estados da consulta
export type AppointmentStatus = 
  | 'confirmed'      // Confirmada
  | 'waiting'        // Em espera (check-in feito)
  | 'in_progress'    // Em atendimento
  | 'completed'      // Concluída
  | 'cancelled'      // Cancelada
  | 'no_show';       // Não compareceu

// Profissional (camelCase for components)
export interface Professional {
  id: string;
  name: string;
  specialty: string;  // Primary specialty_id in DB (backward compat)
  specialtyIds: string[]; // All specialties from professional_specialties table
  color: string;
  avatar?: string;
  userId?: string | null; // Link to auth.users.id
}

// Especialidade
export interface Specialty {
  id: string;
  name: string;
}

// Tipo de consulta (camelCase)
export interface ConsultationType {
  id: string;
  name: string;
  defaultDuration: number;
  color?: string;
  specialtyId?: string;
}

// Paciente (camelCase)
export interface Patient {
  id: string;
  nif: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

// Consulta clínica (camelCase)
export interface ClinicAppointment {
  id: string;
  patientId: string;
  professionalId: string;
  specialtyId: string;
  consultationTypeId: string;
  consultationTypeName?: string | null;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  finalNotes?: string;
  cancellationReason?: string;
  sendReview?: boolean;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Configurações da agenda
export interface AgendaSettings {
  workingHours: {
    [key: string]: { start: string; end: string; enabled: boolean };
  };
  defaultDuration: number;
  bufferBetweenAppointments: number;
}

// Labels para estados (para UI)
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmada',
  waiting: 'Em espera',
  in_progress: 'Em atendimento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
};

