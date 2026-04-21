import type { ProfessionalServicePreference } from '@/hooks/useProfessionalServicePreferences';

interface ProfessionalLike {
  id: string;
}

function hasExplicitValues(values: string[] | undefined) {
  return Array.isArray(values) && values.length > 0;
}

export function professionalSupportsService(
  professional: ProfessionalLike,
  preferences: ProfessionalServicePreference[],
  specialtyId?: string | null,
  consultationTypeId?: string | null,
) {
  const preference = preferences.find((item) => item.professionalId === professional.id);

  if (!preference) {
    return true;
  }

  const specialtyAllowed =
    !specialtyId ||
    !hasExplicitValues(preference.activeSpecialtyIds) ||
    preference.activeSpecialtyIds.includes(specialtyId);

  const consultationTypeAllowed =
    !consultationTypeId ||
    !hasExplicitValues(preference.activeConsultationTypeIds) ||
    preference.activeConsultationTypeIds.includes(consultationTypeId);

  return specialtyAllowed && consultationTypeAllowed;
}

export function filterConsultationTypesForProfessional<T extends { id: string; specialtyId?: string | null; specialty_id?: string | null }>(
  consultationTypes: T[],
  professionalId: string | null | undefined,
  preferences: ProfessionalServicePreference[],
) {
  if (!professionalId) return consultationTypes;

  const preference = preferences.find((item) => item.professionalId === professionalId);

  if (!preference || !hasExplicitValues(preference.activeConsultationTypeIds)) {
    return consultationTypes;
  }

  return consultationTypes.filter((type) => preference.activeConsultationTypeIds.includes(type.id));
}
