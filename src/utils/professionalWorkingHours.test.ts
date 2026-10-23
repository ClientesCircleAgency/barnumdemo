import { describe, expect, it } from 'vitest';
import { isWithinProfessionalWorkingHours } from './professionalWorkingHours';

const monday = new Date(2026, 9, 26);
const hours = [
  { day: 'Segunda', start: '16:00', end: '19:00', enabled: true },
  { day: 'Terça', start: '09:00', end: '19:00', enabled: true },
  { day: 'Sábado', start: '09:00', end: '13:00', enabled: false },
];

describe('professional working hours', () => {
  it.each([
    ['13:00', 30, false], ['15:45', 30, false], ['16:00', 30, true],
    ['18:30', 30, true], ['18:30', 45, false], ['19:00', 30, false],
    ['16:00', 1440, false], ['16:00', NaN, false], ['', 30, false],
  ])('checks the whole appointment at %s for %s minutes', (time, duration, expected) => {
    expect(isWithinProfessionalWorkingHours(monday, time, duration, hours)).toBe(expected);
  });
  it('matches accented Portuguese weekday names', () => {
    expect(isWithinProfessionalWorkingHours(new Date(2026, 9, 27), '09:00', 30, hours)).toBe(true);
  });
  it('excludes disabled days and days absent from an explicit schedule', () => {
    expect(isWithinProfessionalWorkingHours(new Date(2026, 9, 31), '10:00', 30, hours)).toBe(false);
    expect(isWithinProfessionalWorkingHours(new Date(2026, 9, 28), '10:00', 30, hours)).toBe(false);
  });
  it('preserves legacy profiles with no configured schedule', () => {
    for (const value of [null, undefined, []]) {
      expect(isWithinProfessionalWorkingHours(monday, '13:00', 30, value)).toBe(true);
    }
  });
  it('does not treat a malformed configured schedule as available', () => {
    expect(isWithinProfessionalWorkingHours(monday, '16:00', 30, [{ ...hours[0], end: '' }])).toBe(false);
  });
});
