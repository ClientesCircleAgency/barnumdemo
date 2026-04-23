import { useMemo } from 'react';
import { buildTimeSlotsForDate, getVisibleClinicBounds, normalizeWorkingHours } from '@/lib/clinicSettings';
import { useSettings } from '@/hooks/useSettings';

export function useClinicSchedule() {
  const { data: settings = {} } = useSettings();

  const workingHours = useMemo(
    () => normalizeWorkingHours(settings.working_hours),
    [settings],
  );

  const bounds = useMemo(
    () => getVisibleClinicBounds(workingHours),
    [workingHours],
  );

  return {
    workingHours,
    bounds,
    getTimeSlotsForDate: (date: Date, intervalMinutes = 30) =>
      buildTimeSlotsForDate(workingHours, date, intervalMinutes),
  };
}
