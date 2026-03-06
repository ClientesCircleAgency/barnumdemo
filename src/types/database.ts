import type { Database } from '@/integrations/supabase/types';

// Row types (for reading from database)
export type SpecialtyRow = Database['public']['Tables']['specialties']['Row'];
export type ProfessionalRow = Database['public']['Tables']['professionals']['Row'];
export type ConsultationTypeRow = Database['public']['Tables']['consultation_types']['Row'];
export type PatientRow = Database['public']['Tables']['patients']['Row'];
export type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
export type ClinicSettingsRow = Database['public']['Tables']['clinic_settings']['Row'];

// Insert types (for creating new records)
export type SpecialtyInsert = Database['public']['Tables']['specialties']['Insert'];
export type ProfessionalInsert = Database['public']['Tables']['professionals']['Insert'];
export type ConsultationTypeInsert = Database['public']['Tables']['consultation_types']['Insert'];
export type PatientInsert = Database['public']['Tables']['patients']['Insert'];
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
export type ClinicSettingsInsert = Database['public']['Tables']['clinic_settings']['Insert'];

// Update types (for updating existing records)
export type SpecialtyUpdate = Database['public']['Tables']['specialties']['Update'];
export type ProfessionalUpdate = Database['public']['Tables']['professionals']['Update'];
export type ConsultationTypeUpdate = Database['public']['Tables']['consultation_types']['Update'];
export type PatientUpdate = Database['public']['Tables']['patients']['Update'];
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];
export type ClinicSettingsUpdate = Database['public']['Tables']['clinic_settings']['Update'];

// Enum types
export type AppointmentStatus = Database['public']['Enums']['appointment_status'];
