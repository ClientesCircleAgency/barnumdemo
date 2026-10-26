import { appointmentProfessionalIds } from '@/utils/appointmentTeam';

type Team = Parameters<typeof appointmentProfessionalIds>[0];
export interface AppointmentTeamListProps {
  appointment: Team;
  getProfessional: (id: string) => { name: string; color?: string | null } | undefined;
  className?: string;
}

export function AppointmentTeamList({ appointment, getProfessional, className = '' }: AppointmentTeamListProps) {
  const ids = appointmentProfessionalIds(appointment);
  const names = appointment.additionalProfessionalNames ?? appointment.additional_professional_names ?? {};
  return <ul aria-label="Equipa da consulta" className={`space-y-1.5 text-left ${className}`}>
    {ids.map((id, index) => {
      const professional = getProfessional(id);
      const name = professional?.name ?? (index === 0 ? appointment.professionalName ?? appointment.professional_name : names[id]) ?? 'Profissional';
      return <li key={id} className="flex items-start gap-2 leading-snug">
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10" style={{backgroundColor:professional?.color || '#94a3b8'}} />
        <span className="min-w-0 break-words">{name}{index === 0 && ids.length > 1 && <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">Principal</span>}</span>
      </li>;
    })}
  </ul>;
}
