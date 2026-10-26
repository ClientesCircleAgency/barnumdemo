const weekdays = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function minutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

/** Calendar dates use local weekdays, matching the appointment date picker. */
export function isWithinProfessionalWorkingHours(
  date: Date,
  time: string,
  duration: number,
  workingHours: unknown,
): boolean {
  const start = minutes(time);
  if (Number.isNaN(date.getTime()) || start === null || !Number.isFinite(duration) || duration <= 0) return false;

  // Older profiles without a configured weekly schedule retain clinic availability.
  if (workingHours == null || (Array.isArray(workingHours) && workingHours.length === 0)) return true;
  if (!Array.isArray(workingHours)) return false;

  return workingHours.some((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return false;
    const day = entry as Record<string, unknown>;
    if (day.enabled !== true || typeof day.day !== 'string') return false;
    const name = day.day.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (name !== weekdays[date.getDay()]) return false;
    const shiftStart = minutes(day.start);
    const shiftEnd = minutes(day.end);
    return shiftStart !== null && shiftEnd !== null && start >= shiftStart && start + duration <= shiftEnd;
  });
}
