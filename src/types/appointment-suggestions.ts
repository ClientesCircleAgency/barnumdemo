// Manual type definitions for appointment_suggestions (not yet in generated types)
export interface AppointmentSuggestion {
  id: string;
  appointment_request_id: string | null;
  patient_id: string;
  suggested_slots: Record<string, any>; // JSONB
  status: 'pending' | 'accepted' | 'expired';
  accepted_slot: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface AppointmentSuggestionInsert {
  id?: string;
  appointment_request_id?: string | null;
  patient_id: string;
  suggested_slots: Record<string, any>;
  status?: 'pending' | 'accepted' | 'expired';
  accepted_slot?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
}
