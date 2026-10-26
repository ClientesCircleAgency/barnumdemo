import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppointmentInsert, AppointmentUpdate, AppointmentStatus } from '@/types/database';
import type { AppointmentWithTeamRow } from '@/types/appointmentTeam';
import { normalizeAppointmentTeamRow } from '@/utils/appointmentTeam';

const selection = '*, appointment_additional_professionals(professional_id,professional_name)' as const;
export class AppointmentChangedError extends Error {}

async function readAppointment(id: string): Promise<AppointmentWithTeamRow> {
  const { data, error } = await supabase.from('appointments').select(selection).eq('id', id).single();
  if (error) throw error;
  return normalizeAppointmentTeamRow(data);
}

export function useAppointments() {
  return useQuery({ queryKey: ['appointments'], refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from('appointments').select(selection).order('date').order('time');
    if (error) throw error;
    return (data || []).map(normalizeAppointmentTeamRow);
  } });
}
export function useAppointmentsByDate(date: string | undefined) {
  return useQuery({ queryKey: ['appointments', 'date', date], refetchInterval: 15000, enabled: !!date, queryFn: async () => {
    const { data, error } = await supabase.from('appointments').select(selection).eq('date', date!).order('time');
    if (error) throw error;
    return (data || []).map(normalizeAppointmentTeamRow);
  } });
}
export function useAppointmentsByPatient(patientId: string | undefined) {
  return useQuery({ queryKey: ['appointments', 'patient', patientId], refetchInterval: 15000, enabled: !!patientId, queryFn: async () => {
    const { data, error } = await supabase.from('appointments').select(selection).eq('patient_id', patientId!).order('date', { ascending: false }).order('time', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeAppointmentTeamRow);
  } });
}

function useInvalidateAppointments() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ['appointments'] });
    client.invalidateQueries({ queryKey: ['appointment-team-availability'] });
  };
}

export function useAddAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({ mutationFn: async (appointment: AppointmentInsert & { additional_professional_ids?: string[] }) => {
    const { additional_professional_ids = [], ...fields } = appointment;
    const { data, error } = await supabase.rpc('save_appointment_team', {
      p_appointment_id: null, p_expected_version: null, p_appointment: fields, p_additional_professional_ids: additional_professional_ids,
    });
    if (error) throw error;
    return readAppointment(data);
  }, onSuccess: invalidate });
}

export interface UpdateAppointmentParams {
  id: string;
  data: AppointmentUpdate;
  ifStatus?: AppointmentStatus;
  expectedVersion?: number;
  additionalProfessionalIds?: string[];
}
export function useUpdateAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({ mutationFn: async ({ id, data, ifStatus, expectedVersion, additionalProfessionalIds }: UpdateAppointmentParams) => {
    const current = await readAppointment(id);
    if ((ifStatus && current.status !== ifStatus) || (expectedVersion !== undefined && current.version !== expectedVersion)) throw new AppointmentChangedError('A consulta foi alterada. Atualize os dados.');
    let error;
    const fields=Object.fromEntries(Object.entries(data).filter(([key,value])=>value!==undefined && key!=='professional_name'));
    if (data.status && Object.keys(fields).every(key => ['status','final_notes','send_review','finalized_at'].includes(key))) {
      ({ error } = await supabase.rpc('set_appointment_state', {
        p_appointment_id: id, p_expected_version: expectedVersion ?? current.version, p_status: data.status, p_final_notes: data.final_notes ?? null,
        p_send_review: data.send_review ?? null,
      }));
    } else {
      ({ error } = await supabase.rpc('save_appointment_team', {
        p_appointment_id: id, p_expected_version: expectedVersion ?? current.version, p_appointment: fields,
        p_additional_professional_ids: additionalProfessionalIds ?? current.additional_professional_ids,
      }));
    }
    if (error?.code === '40001') throw new AppointmentChangedError('A consulta foi alterada. Atualize os dados.');
    if (error) throw error;
    return readAppointment(id);
  }, onSuccess: invalidate });
}
export function useUpdateAppointmentStatus() {
  const update = useUpdateAppointment();
  return useMutation({ mutationFn: ({ id, status, expectedVersion }: { id: string; status: AppointmentStatus; expectedVersion?: number }) =>
    update.mutateAsync({ id, data: { status }, expectedVersion }) });
}
export function useDeleteAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
  }, onSuccess: invalidate });
}
