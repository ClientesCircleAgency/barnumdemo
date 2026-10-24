import type { AppointmentRow } from './database';

export interface AppointmentTeam {
  primaryProfessionalId: string;
  additionalProfessionalIds: string[];
}

export type AppointmentWithTeamRow = AppointmentRow & {
  additional_professional_ids: string[];
  version: number;
};
