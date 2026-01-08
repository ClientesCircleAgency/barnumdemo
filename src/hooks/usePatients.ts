import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PatientRow, PatientInsert, PatientUpdate } from '@/types/database';

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: async (): Promise<PatientRow[]> => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async (): Promise<PatientRow | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function usePatientByNif(nif: string | undefined) {
  return useQuery({
    queryKey: ['patients', 'nif', nif],
    queryFn: async (): Promise<PatientRow | null> => {
      if (!nif) return null;
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('nif', nif)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!nif,
  });
}

export function useAddPatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (patient: PatientInsert) => {
      const { data, error } = await supabase
        .from('patients')
        .insert(patient)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PatientUpdate }) => {
      const { data: updated, error } = await supabase
        .from('patients')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updated;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
