import type { AppointmentRow } from '@/types/database';

/**
 * Time utility: parse "HH:MM" time string into minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate end time in minutes given start time and duration
 */
function calculateEndMinutes(startTime: string, durationMinutes: number): number {
  return timeToMinutes(startTime) + durationMinutes;
}

/**
 * Check if two time ranges overlap
 * @param start1 - Start time in minutes
 * @param end1 - End time in minutes
 * @param start2 - Start time in minutes
 * @param end2 - End time in minutes
 * @returns true if ranges overlap
 */
function rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  // Overlap rule: existing.start < new.end AND existing.end > new.start
  return start1 < end2 && end1 > start2;
}

export interface AvailabilityCheckParams {
  professionalId: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  durationMinutes: number;
}

/**
 * Check if a professional is available at a given time slot
 * 
 * @param params - Professional ID, date, start time, and duration
 * @param existingAppointments - All appointments (will be filtered internally)
 * @returns true if professional is available (no overlapping appointments)
 * 
 * **Limitation**: Does not check professional working hours (requires professional_working_hours table, not yet implemented)
 */
export function isProfessionalAvailable(
  params: AvailabilityCheckParams,
  existingAppointments: AppointmentRow[]
): boolean {
  const { professionalId, date, startTime, durationMinutes } = params;

  // Calculate requested time window
  const requestedStart = timeToMinutes(startTime);
  const requestedEnd = requestedStart + durationMinutes;

  // Filter appointments for this professional on this date
  const relevantAppointments = existingAppointments.filter(
    apt => apt.professional_id === professionalId && apt.date === date
  );

  // Check for overlaps
  for (const apt of relevantAppointments) {
    const existingStart = timeToMinutes(apt.time);
    const existingEnd = existingStart + apt.duration;

    if (rangesOverlap(requestedStart, requestedEnd, existingStart, existingEnd)) {
      return false; // Overlap found, not available
    }
  }

  return true; // No overlaps, available
}

/**
 * Get list of available professionals for a given time slot
 * 
 * @param params - Date, start time, and duration
 * @param allProfessionals - List of all professionals
 * @param existingAppointments - All appointments (will be filtered internally)
 * @returns Array of professional IDs that are available
 * 
 * **Limitation**: Does not filter by specialty or working hours
 */
export function getAvailableProfessionalIds(
  params: Omit<AvailabilityCheckParams, 'professionalId'>,
  allProfessionals: { id: string }[],
  existingAppointments: AppointmentRow[]
): string[] {
  return allProfessionals
    .filter(prof =>
      isProfessionalAvailable(
        { ...params, professionalId: prof.id },
        existingAppointments
      )
    )
    .map(prof => prof.id);
}
