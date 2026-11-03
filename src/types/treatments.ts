import type { Database } from '@/integrations/supabase/types';
type Tables = Database['public']['Tables'];
export type Treatment = Tables['treatments']['Row'];
export type TreatmentSession = Tables['treatment_sessions']['Row'];
export type TreatmentStatus = 'active' | 'completed' | 'cancelled';
export type SessionKind = 'consultation' | 'surgery';
export type TreatmentBooking = { session_id: string; expected_version: number; date: string; time: string };
