import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfessionalServicePreference {
  professionalId: string;
  userId: string | null;
  activeSpecialtyIds: string[];
  activeConsultationTypeIds: string[];
}

interface ProfessionalProfileRow {
  user_id: string;
  active_specialty_ids: string[] | null;
  active_consultation_type_ids: string[] | null;
}

export function useProfessionalServicePreferences() {
  return useQuery({
    queryKey: ['professional_service_preferences'],
    queryFn: async (): Promise<ProfessionalServicePreference[]> => {
      const { data: professionals, error: professionalsError } = await supabase
        .from('professionals')
        .select('id, user_id');

      if (professionalsError) throw professionalsError;

      const userIds = Array.from(
        new Set((professionals || []).map((professional) => professional.user_id).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) {
        return (professionals || []).map((professional) => ({
          professionalId: professional.id,
          userId: professional.user_id ?? null,
          activeSpecialtyIds: [],
          activeConsultationTypeIds: [],
        }));
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, active_specialty_ids, active_consultation_type_ids')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileByUserId = new Map(
        ((profiles || []) as ProfessionalProfileRow[]).map((profile) => [profile.user_id, profile]),
      );

      return (professionals || []).map((professional) => {
        const profile = professional.user_id ? profileByUserId.get(professional.user_id) : undefined;

        return {
          professionalId: professional.id,
          userId: professional.user_id ?? null,
          activeSpecialtyIds: profile?.active_specialty_ids ?? [],
          activeConsultationTypeIds: profile?.active_consultation_type_ids ?? [],
        };
      });
    },
  });
}
