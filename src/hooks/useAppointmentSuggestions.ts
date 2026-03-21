import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SuggestionInsert = Database['public']['Tables']['appointment_suggestions']['Insert'];

export function useAddAppointmentSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestion: SuggestionInsert) => {
      const { error } = await supabase
        .from('appointment_suggestions')
        .insert(suggestion);

      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-suggestions'] });
    },
  });
}
