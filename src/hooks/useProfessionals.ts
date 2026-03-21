import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProfessionalRow, ProfessionalInsert, ProfessionalUpdate } from '@/types/database';

export function useProfessionals() {
  return useQuery({
    queryKey: ['professionals'],
    queryFn: async (): Promise<ProfessionalRow[]> => {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddProfessional() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (professional: ProfessionalInsert) => {
      const { data, error } = await supabase
        .from('professionals')
        .insert(professional)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}

export function useUpdateProfessional() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProfessionalUpdate }) => {
      const { data: updated, error } = await supabase
        .from('professionals')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}

export function useDeleteProfessional() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('professionals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}
