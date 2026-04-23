import type { Json } from '@/integrations/supabase/types';

export interface WorkingDay {
  day: string;
  start: string;
  end: string;
  enabled: boolean;
}

export const DEFAULT_CLINIC_WORKING_HOURS: WorkingDay[] = [
  { day: 'Segunda', start: '09:00', end: '19:00', enabled: true },
  { day: 'Terça', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quarta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quinta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Sexta', start: '09:00', end: '18:00', enabled: true },
  { day: 'Sábado', start: '09:00', end: '13:00', enabled: true },
  { day: 'Domingo', start: '', end: '', enabled: false },
];

const WEEK_INDEX_TO_DAY = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

function isWorkingDay(value: unknown): value is WorkingDay {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.day === 'string' &&
    typeof row.start === 'string' &&
    typeof row.end === 'string' &&
    typeof row.enabled === 'boolean'
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const safeMinutes = Math.max(minutes, 0);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function normalizeWorkingHours(value: Json | undefined | null): WorkingDay[] {
  if (!Array.isArray(value)) {
    return DEFAULT_CLINIC_WORKING_HOURS;
  }

  const rows = value.filter(isWorkingDay);
  if (rows.length === 0) {
    return DEFAULT_CLINIC_WORKING_HOURS;
  }

  return DEFAULT_CLINIC_WORKING_HOURS.map((defaultDay) => {
    const customDay = rows.find((row) => row.day === defaultDay.day);
    return customDay ?? defaultDay;
  });
}

export function getWorkingDayForDate(workingHours: WorkingDay[], date: Date): WorkingDay | undefined {
  const targetDay = WEEK_INDEX_TO_DAY[date.getDay()];
  return workingHours.find((day) => day.day === targetDay);
}

export function buildTimeSlotsForWorkingDay(day: WorkingDay | undefined, intervalMinutes = 30): string[] {
  if (!day || !day.enabled || !day.start || !day.end) {
    return [];
  }

  const slots: string[] = [];
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);

  for (let current = start; current < end; current += intervalMinutes) {
    slots.push(minutesToTime(current));
  }

  return slots;
}

export function buildTimeSlotsForDate(workingHours: WorkingDay[], date: Date, intervalMinutes = 30): string[] {
  const workingDay = getWorkingDayForDate(workingHours, date);
  return buildTimeSlotsForWorkingDay(workingDay, intervalMinutes);
}

export function getVisibleClinicBounds(workingHours: WorkingDay[]) {
  const enabledDays = workingHours.filter((day) => day.enabled && day.start && day.end);

  if (enabledDays.length === 0) {
    return { start: '09:00', end: '19:00' };
  }

  const earliest = enabledDays.reduce((current, day) => (
    timeToMinutes(day.start) < timeToMinutes(current) ? day.start : current
  ), enabledDays[0].start);

  const latest = enabledDays.reduce((current, day) => (
    timeToMinutes(day.end) > timeToMinutes(current) ? day.end : current
  ), enabledDays[0].end);

  return { start: earliest, end: latest };
}
