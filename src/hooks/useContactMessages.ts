import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}

export type ContactMessageInsert = Omit<ContactMessage, 'id' | 'status' | 'created_at'>;

export function useContactMessages() {
  return useQuery({
    queryKey: ['contact_messages'],
    queryFn: async (): Promise<ContactMessage[]> => {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ContactMessage[];
    },
  });
}

export function useAddContactMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (message: ContactMessageInsert) => {
      // Note: public users can INSERT but cannot SELECT from this table (PII).
      // Avoid returning the inserted row to prevent RLS SELECT failures.
      const { error } = await supabase
        .from('contact_messages')
        .insert(message);

      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_messages'] });
    },
  });
}

export function useUpdateContactMessageStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContactMessage['status'] }) => {
      const { data, error } = await supabase
        .from('contact_messages')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_messages'] });
    },
  });
}

export function useDeleteContactMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_messages'] });
    },
  });
}
