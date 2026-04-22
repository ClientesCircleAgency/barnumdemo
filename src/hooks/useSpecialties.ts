import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SpecialtyInsert, SpecialtyRow, SpecialtyUpdate } from '@/types/database';

export function useSpecialties() {
  return useQuery({
    queryKey: ['specialties'],
    queryFn: async (): Promise<SpecialtyRow[]> => {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddSpecialty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (specialty: SpecialtyInsert) => {
      const { data, error } = await supabase
        .from('specialties')
        .insert(specialty)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] });
    },
  });
}

export function useUpdateSpecialty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SpecialtyUpdate }) => {
      const { data: updated, error } = await supabase
        .from('specialties')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] });
    },
  });
}

export function useDeleteSpecialty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('specialties')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] });
    },
  });
}
