import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfessionalSpecialtyRow {
  professional_id: string;
  specialty_id: string;
}

export function useProfessionalSpecialties() {
  return useQuery({
    queryKey: ['professional_specialties'],
    queryFn: async (): Promise<ProfessionalSpecialtyRow[]> => {
      const { data, error } = await supabase
        .from('professional_specialties')
        .select('*');

      if (error) throw error;
      return data || [];
    },
  });
}

/** Replace all specialties for a given professional (delete + insert) */
export function useSetProfessionalSpecialties() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ professionalId, specialtyIds }: { professionalId: string; specialtyIds: string[] }) => {
      // Delete existing
      const { error: deleteError } = await supabase
        .from('professional_specialties')
        .delete()
        .eq('professional_id', professionalId);

      if (deleteError) throw deleteError;

      // Insert new (if any)
      if (specialtyIds.length > 0) {
        const rows = specialtyIds.map(sid => ({
          professional_id: professionalId,
          specialty_id: sid,
        }));

        const { error: insertError } = await supabase
          .from('professional_specialties')
          .insert(rows);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professional_specialties'] });
    },
  });
}
