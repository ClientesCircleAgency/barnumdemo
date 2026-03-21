import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ConsultationTypeRow, ConsultationTypeInsert, ConsultationTypeUpdate } from '@/types/database';

export function useConsultationTypes() {
  return useQuery({
    queryKey: ['consultation_types'],
    queryFn: async (): Promise<ConsultationTypeRow[]> => {
      const { data, error } = await supabase
        .from('consultation_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddConsultationType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (type: ConsultationTypeInsert) => {
      const { data, error } = await supabase
        .from('consultation_types')
        .insert(type)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_types'] });
    },
  });
}

export function useUpdateConsultationType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ConsultationTypeUpdate }) => {
      const { data: updated, error } = await supabase
        .from('consultation_types')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_types'] });
    },
  });
}

export function useDeleteConsultationType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consultation_types')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_types'] });
    },
  });
}
