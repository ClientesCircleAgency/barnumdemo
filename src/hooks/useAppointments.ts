import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppointmentRow, AppointmentInsert, AppointmentUpdate, AppointmentStatus } from '@/types/database';

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAppointmentsByDate(date: string | undefined) {
  return useQuery({
    queryKey: ['appointments', 'date', date],
    queryFn: async (): Promise<AppointmentRow[]> => {
      if (!date) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('date', date)
        .order('time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
  });
}

export function useAppointmentsByPatient(patientId: string | undefined) {
  return useQuery({
    queryKey: ['appointments', 'patient', patientId],
    queryFn: async (): Promise<AppointmentRow[]> => {
      if (!patientId) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });
}

export function useAddAppointment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (appointment: AppointmentInsert) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/** Lançado quando a consulta já não está no estado esperado (alterada noutro ecrã). */
export class AppointmentChangedError extends Error {}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data, ifStatus }: { id: string; data: AppointmentUpdate; ifStatus?: AppointmentStatus }) => {
      let query = supabase
        .from('appointments')
        .update(data)
        .eq('id', id);

      // Só atualiza se a consulta ainda estiver no estado que o utilizador viu
      if (ifStatus) query = query.eq('status', ifStatus);

      const { data: updated, error } = await query.select().maybeSingle();

      if (error) throw error;
      if (!updated) throw new AppointmentChangedError('Consulta não encontrada ou já alterada');
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
