import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamAvailabilityParams {
  specialtyId?: string;
  consultationTypeId?: string;
  date?: string;
  time?: string;
  duration: number;
  excludeAppointmentId?: string;
  enabled?: boolean;
}

export function useAppointmentTeamAvailability(params: TeamAvailabilityParams) {
  return useQuery({
    queryKey: ['appointment-team-availability', params.specialtyId, params.consultationTypeId, params.date, params.time, params.duration, params.excludeAppointmentId],
    enabled: params.enabled !== false && !!params.specialtyId && !!params.date && !!params.time && params.duration > 0,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_appointment_team_availability', {
        p_specialty_id: params.specialtyId!, p_consultation_type_id: params.consultationTypeId || null,
        p_date: params.date!, p_time: params.time!, p_duration: params.duration,
        p_exclude_appointment_id: params.excludeAppointmentId || null,
      });
      if (error) throw error;
      return data;
    },
  });
}
