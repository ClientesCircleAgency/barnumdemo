import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  is_read: boolean;
  created_at: string;
  status: 'new' | 'read' | 'archived'; // Computed field for backwards compatibility
}

export type ContactMessageInsert = Omit<ContactMessage, 'id' | 'is_read' | 'created_at'>;

export function useContactMessages() {
  return useQuery({
    queryKey: ['contact_messages'],
    queryFn: async (): Promise<ContactMessage[]> => {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Map is_read boolean to status for backwards compatibility
      return (data || []).map(msg => ({
        ...msg,
        status: msg.is_read ? 'read' : 'new'
      })) as ContactMessage[];
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

export function useMarkContactMessageAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('contact_messages')
        .update({ is_read: true })
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

export function useUpdateContactMessageStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'read' | 'archived' }) => {
      // Map status to is_read boolean (we'll use a separate field for archived later if needed)
      const { data, error } = await supabase
        .from('contact_messages')
        .update({ is_read: status === 'read' || status === 'archived' })
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

