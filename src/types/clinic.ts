// Legacy types for backward compatibility with existing components
// These use camelCase while Supabase uses snake_case

// Estados da consulta
export type AppointmentStatus = 
  | 'scheduled'      // Marcada
  | 'pre_confirmed'  // Pré-confirmada (aguarda confirmação 24h antes)
  | 'confirmed'      // Confirmada (cliente respondeu "Vou")
  | 'waiting'        // Em espera (check-in feito)
  | 'in_progress'    // Em atendimento
  | 'completed'      // Concluída
  | 'cancelled'      // Cancelada
  | 'no_show';       // Não compareceu

// Prioridade para lista de espera
export type WaitlistPriority = 'low' | 'medium' | 'high';

// Preferência de horário
export type TimePreference = 'morning' | 'afternoon' | 'any';

// Profissional (camelCase for components)
export interface Professional {
  id: string;
  name: string;
  specialty: string;  // This is specialty_id in DB
  color: string;
  avatar?: string;
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
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  notes?: string;
  roomId?: string;
  createdAt: string;
  updatedAt: string;
}

// Item da Lista de Espera (camelCase)
export interface WaitlistItem {
  id: string;
  patientId: string;
  specialtyId?: string;
  professionalId?: string;
  timePreference: TimePreference;
  preferredDates?: string[];
  priority: WaitlistPriority;
  sortOrder?: number;
  reason?: string;
  createdAt: string;
}

// Sala/Cadeira
export interface Room {
  id: string;
  name: string;
  specialtyId?: string;
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
  scheduled: 'Marcada',
  pre_confirmed: 'Pré-confirmada',
  confirmed: 'Confirmada',
  waiting: 'Em espera',
  in_progress: 'Em atendimento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
};

export const waitlistPriorityLabels: Record<WaitlistPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export const timePreferenceLabels: Record<TimePreference, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  any: 'Qualquer',
};
