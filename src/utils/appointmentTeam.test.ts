import { describe, expect, it } from 'vitest';
import { getAppointmentProfessionalIds, hasAppointmentProfessional, validateAppointmentTeam } from './appointmentTeam';

describe('appointment participants', () => {
  it('keeps old appointments with only a primary professional', () => {
    expect(getAppointmentProfessionalIds({ primaryProfessionalId: 'a', additionalProfessionalIds: [] })).toEqual(['a']);
  });
  it('includes additional professionals in calendar membership', () => {
    const team = { primaryProfessionalId: 'a', additionalProfessionalIds: ['b', 'c'] };
    expect(getAppointmentProfessionalIds(team)).toEqual(['a', 'b', 'c']);
    expect(hasAppointmentProfessional(team, 'b')).toBe(true);
    expect(hasAppointmentProfessional(team, 'other')).toBe(false);
  });
  it('rejects duplicate professionals instead of silently changing the team', () => {
    expect(() => validateAppointmentTeam({ primaryProfessionalId: 'a', additionalProfessionalIds: ['a'] })).toThrow();
    expect(() => validateAppointmentTeam({ primaryProfessionalId: 'a', additionalProfessionalIds: ['b', 'b'] })).toThrow();
  });
  it('requires a primary and nonempty additional identifiers', () => {
    expect(() => validateAppointmentTeam({ primaryProfessionalId: '', additionalProfessionalIds: [] })).toThrow();
    expect(() => validateAppointmentTeam({ primaryProfessionalId: 'a', additionalProfessionalIds: [''] })).toThrow();
    expect(() => validateAppointmentTeam({ primaryProfessionalId: 'a', additionalProfessionalIds: ['b'] })).not.toThrow();
  });
});
