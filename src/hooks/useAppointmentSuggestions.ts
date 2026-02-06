import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppointmentSuggestionInsert } from '@/types/appointment-suggestions';

export function useAddAppointmentSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (suggestion: AppointmentSuggestionInsert) => {
      const { data, error } = await supabase
        .from('appointment_suggestions')
        .insert(suggestion)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-suggestions'] });
    },
  });
}
