import type { AppointmentTeam } from '@/types/appointmentTeam';

interface AppointmentParticipants {
  professionalId?: string;
  professional_id?: string;
  professionalName?: string | null;
  professional_name?: string | null;
  additionalProfessionalIds?: string[];
  additional_professional_ids?: string[];
  additionalProfessionalNames?: Record<string,string>;
  additional_professional_names?: Record<string,string>;
}

export function appointmentProfessionalIds(appointment: AppointmentParticipants): string[] {
  return [appointment.professionalId ?? appointment.professional_id, ...(appointment.additionalProfessionalIds ?? appointment.additional_professional_ids ?? [])].filter(Boolean);
}

export function appointmentTeamLabel(appointment: AppointmentParticipants, getProfessional: (id: string) => { name: string } | undefined): string {
  const ids = appointmentProfessionalIds(appointment);
  const names = appointment.additionalProfessionalNames ?? appointment.additional_professional_names ?? {};
  return ids.map((id,index) => {
    const name = getProfessional(id)?.name ?? (index===0 ? appointment.professionalName ?? appointment.professional_name : names[id]) ?? 'Profissional';
    return index===0 && ids.length>1 ? `${name} (principal)` : name;
  }).join(' · ');
}

export function normalizeAppointmentTeamRow<T extends { appointment_additional_professionals?: { professional_id: string; professional_name: string }[] }>(row: T) {
  const participants = row.appointment_additional_professionals ?? [];
  return { ...row, additional_professional_ids: participants.map(p => p.professional_id),
    additional_professional_names: Object.fromEntries(participants.map(p => [p.professional_id, p.professional_name])) };
}

export function getAppointmentProfessionalIds(team: AppointmentTeam): string[] {
  return [team.primaryProfessionalId, ...team.additionalProfessionalIds];
}

export function hasAppointmentProfessional(team: AppointmentTeam, professionalId: string): boolean {
  return getAppointmentProfessionalIds(team).includes(professionalId);
}

export function validateAppointmentTeam(team: AppointmentTeam): void {
  const ids = getAppointmentProfessionalIds(team);
  if (ids.some(id => !id.trim())) throw new Error('Selecione um profissional.');
  if (new Set(ids).size !== ids.length) throw new Error('Não pode repetir um profissional na consulta.');
}
