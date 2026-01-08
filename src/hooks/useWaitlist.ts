import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WaitlistRow, WaitlistInsert, WaitlistUpdate } from '@/types/database';

export function useWaitlist() {
  return useQuery({
    queryKey: ['waitlist'],
    queryFn: async (): Promise<WaitlistRow[]> => {
      const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('priority', { ascending: false })
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddToWaitlist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: WaitlistInsert) => {
      const { data, error } = await supabase
        .from('waitlist')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useUpdateWaitlistItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WaitlistUpdate }) => {
      const { data: updated, error } = await supabase
        .from('waitlist')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useRemoveFromWaitlist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('waitlist')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}
