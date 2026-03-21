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
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  rejection_reason: string | null;
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export type AppointmentRequestInsert = Omit<AppointmentRequest, 'id' | 'status' | 'created_at' | 'updated_at' | 'processed_at' | 'processed_by' | 'notes'> & { notes?: string };

export function useAppointmentRequests() {
  return useQuery({
    queryKey: ['appointment_requests'],
    queryFn: async (): Promise<AppointmentRequest[]> => {
      const { data, error } = await supabase
        .from('appointment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AppointmentRequest[];
    },
  });
}

export function useAddAppointmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AppointmentRequestInsert) => {
      // Note: public users can INSERT but cannot SELECT from this table (PII).
      // Avoid returning the inserted row to prevent RLS SELECT failures.
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
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: AppointmentRequest['status']; rejection_reason?: string }) => {
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
