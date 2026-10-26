import { describe, expect, it } from 'vitest';
import { getAppointmentProfessionalIds, hasAppointmentProfessional, validateAppointmentTeam, normalizeAppointmentTeamRow, appointmentProfessionalIds, appointmentTeamLabel } from './appointmentTeam';

describe('appointment participants', () => {
  it('filters both database and UI appointments by every participant and retains names', () => {
    expect(appointmentProfessionalIds({professionalId:'a',additionalProfessionalIds:['b']})).toEqual(['a','b']);
    expect(appointmentProfessionalIds({professional_id:'a',additional_professional_ids:['b']})).toEqual(['a','b']);
    expect(appointmentTeamLabel({professionalId:'a',professionalName:'A',additionalProfessionalIds:['b'],additionalProfessionalNames:{b:'B'}},()=>undefined)).toBe('A (principal) · B');
  });
  it('maps nested participants without dropping historical names', () => {
    const row = normalizeAppointmentTeamRow({ id: 'appointment', professional_id: 'a', version: 2, appointment_additional_professionals: [{ professional_id: 'b', professional_name: 'Doctor B' }] });
    expect(row.additional_professional_ids).toEqual(['b']);
    expect(row.additional_professional_names).toEqual({ b: 'Doctor B' });
    expect(row.version).toBe(2);
  });
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
