import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SpecialtyRow } from '@/types/database';

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
