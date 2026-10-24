import type { AppointmentTeam } from '@/types/appointmentTeam';

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
