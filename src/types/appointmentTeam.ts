import type { AppointmentRow } from './database';

export interface AppointmentTeam {
  primaryProfessionalId: string;
  additionalProfessionalIds: string[];
}

export type AppointmentWithTeamRow = AppointmentRow & {
  additional_professional_ids: string[];
  version: number;
  additional_professional_names: Record<string, string>;
};
