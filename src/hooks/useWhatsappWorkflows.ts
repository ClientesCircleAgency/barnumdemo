import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface WhatsappWorkflow {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  phone: string;
  workflow_type: 'confirmation_24h' | 'review_reminder' | 'availability_suggestion';
  status: 'pending' | 'sent' | 'delivered' | 'responded' | 'expired' | 'cancelled';
  scheduled_at: string;
  sent_at: string | null;
  response: string | null;
  responded_at: string | null;
  message_payload: Json | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappWorkflowInsert {
  appointment_id?: string | null;
  patient_id: string;
  phone: string;
  workflow_type: string;
  scheduled_at: string;
  message_payload?: Json;
}

export function useWhatsappWorkflows() {
  return useQuery({
    queryKey: ['whatsapp_workflows'],
    queryFn: async (): Promise<WhatsappWorkflow[]> => {
      const { data, error } = await supabase
        .from('whatsapp_workflows')
        .select('*')
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as WhatsappWorkflow[];
    },
  });
}

export function usePendingWorkflows() {
  return useQuery({
    queryKey: ['whatsapp_workflows', 'pending'],
    queryFn: async (): Promise<WhatsappWorkflow[]> => {
      const { data, error } = await supabase
        .from('whatsapp_workflows')
        .select('*')
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as WhatsappWorkflow[];
    },
  });
}

export function useAddWhatsappWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workflow: WhatsappWorkflowInsert) => {
      const { data, error } = await supabase
        .from('whatsapp_workflows')
        .insert([workflow])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_workflows'] });
    },
  });
}

export function useUpdateWhatsappWorkflowStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, response }: { id: string; status: WhatsappWorkflow['status']; response?: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      }
      
      if (response) {
        updateData.response = response;
        updateData.responded_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('whatsapp_workflows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_workflows'] });
    },
  });
}

export function useCancelWorkflowsByAppointment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('whatsapp_workflows')
        .update({ status: 'cancelled' })
        .eq('appointment_id', appointmentId)
        .eq('status', 'pending');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_workflows'] });
    },
  });
}

// Helper to schedule a review reminder 2h after appointment completion
export function scheduleReviewReminder(patientId: string, phone: string, appointmentId: string): WhatsappWorkflowInsert {
  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + 2);
  
  return {
    appointment_id: appointmentId,
    patient_id: patientId,
    phone,
    workflow_type: 'review_reminder',
    scheduled_at: scheduledAt.toISOString(),
    message_payload: {
      type: 'review_request',
      appointment_id: appointmentId,
    },
  };
}

// Helper to schedule 24h confirmation message
export function scheduleConfirmation24h(patientId: string, phone: string, appointmentId: string, appointmentDate: string): WhatsappWorkflowInsert {
  const scheduledAt = new Date(appointmentDate);
  scheduledAt.setHours(scheduledAt.getHours() - 24);
  
  // If less than 24h away, schedule for now
  const now = new Date();
  if (scheduledAt < now) {
    scheduledAt.setTime(now.getTime() + 60000); // 1 minute from now
  }
  
  return {
    appointment_id: appointmentId,
    patient_id: patientId,
    phone,
    workflow_type: 'confirmation_24h',
    scheduled_at: scheduledAt.toISOString(),
    message_payload: {
      type: 'confirmation_request',
      appointment_id: appointmentId,
      appointment_date: appointmentDate,
    },
  };
}
