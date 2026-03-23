import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AppointmentRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string;
  specialty_name: string | null;
  reason: string;
  preferred_date: string;
  preferred_time: string;
  estimated_duration: number | null;
  assigned_professional_id: string | null;
  professional_name: string | null;
  suggested_slots: Array<{ date: string; time: string }>;
  accepted_slot: { date: string; time: string } | null;
  suggestion_expires_at: string | null;
  status: 'pending' | 'pre_confirmed' | 'suggested' | 'converted' | 'cancelled' | 'expired' | 'rejected';
  rejection_reason: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentRequestInsert = Pick<
  AppointmentRequest,
  'name' | 'email' | 'phone' | 'nif' | 'specialty_id' | 'reason' | 'preferred_date' | 'preferred_time'
>;

export function useAppointmentRequests() {
  return useQuery({
    queryKey: ['appointment_requests'],
    queryFn: async (): Promise<AppointmentRequest[]> => {
      const { data, error } = await supabase
        .from('appointment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        suggested_slots: (r.suggested_slots as Array<{ date: string; time: string }>) ?? [],
        accepted_slot: r.accepted_slot as { date: string; time: string } | null,
      }));
    },
  });
}

export function useAddAppointmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AppointmentRequestInsert) => {
      // Public users can INSERT but cannot SELECT (PII). Don't return the row.
      const { error } = await supabase
        .from('appointment_requests')
        .insert(request);

      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment_requests'] });
    },
  });
}

export function useUpdateAppointmentRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, rejection_reason }: {
      id: string;
      status: AppointmentRequest['status'];
      rejection_reason?: string;
    }) => {
      const update: Record<string, unknown> = { status };
      if (rejection_reason !== undefined) update.rejection_reason = rejection_reason;

      const { error } = await supabase
        .from('appointment_requests')
        .update(update)
        .eq('id', id);

      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment_requests'] });
    },
  });
}

export function useUpdateAppointmentRequestSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, suggested_slots, suggestion_expires_at }: {
      id: string;
      suggested_slots: Array<{ date: string; time: string }>;
      suggestion_expires_at?: string;
    }) => {
      const update: Record<string, unknown> = {
        suggested_slots,
        status: 'suggested',
      };
      if (suggestion_expires_at) update.suggestion_expires_at = suggestion_expires_at;

      const { error } = await supabase
        .from('appointment_requests')
        .update(update)
        .eq('id', id);

      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment_requests'] });
    },
  });
}

export function useConvertRequestToAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      request_id: string;
      accepted_date?: string;
      accepted_time?: string;
      professional_id?: string;
      consultation_type_id?: string;
      duration?: number;
    }) => {
      const { data, error } = await supabase.rpc('convert_request_to_appointment', {
        p_request_id: params.request_id,
        p_accepted_date: params.accepted_date ?? null,
        p_accepted_time: params.accepted_time ?? null,
        p_professional_id: params.professional_id ?? null,
        p_consultation_type_id: params.consultation_type_id ?? null,
        p_duration: params.duration ?? null,
      });

      if (error) throw error;
      return data as string; // returns appointment UUID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment_requests'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useDeleteAppointmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment_requests'] });
    },
  });
}
