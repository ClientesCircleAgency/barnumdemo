import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AppointmentRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string;
  reason: string;
  preferred_date: string;
  preferred_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
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
    mutationFn: async ({ id, status }: { id: string; status: AppointmentRequest['status'] }) => {
      const { data, error } = await supabase
        .from('appointment_requests')
        .update({
          status,
        })
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
