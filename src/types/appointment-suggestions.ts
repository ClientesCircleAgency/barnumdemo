export interface AppointmentSuggestion {
  id: string;
  appointment_request_id: string | null;
  patient_id: string | null;
  suggested_slots: Record<string, any>[];
  status: 'pending' | 'accepted' | 'expired';
  accepted_slot: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  // Denormalized from appointment_request
  patient_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  patient_nif: string | null;
  specialty_id: string | null;
  specialty_name: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  reason: string | null;
  estimated_duration: number | null;
  professional_name: string | null;
}

export interface AppointmentSuggestionInsert {
  id?: string;
  appointment_request_id?: string | null;
  patient_id?: string | null;
  suggested_slots: Record<string, any>[];
  status?: 'pending' | 'accepted' | 'expired';
  accepted_slot?: Record<string, any> | null;
  expires_at?: string;
  // Denormalized from appointment_request
  patient_name?: string | null;
  patient_email?: string | null;
  patient_phone?: string | null;
  patient_nif?: string | null;
  specialty_id?: string | null;
  specialty_name?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  reason?: string | null;
  estimated_duration?: number | null;
  professional_name?: string | null;
}
