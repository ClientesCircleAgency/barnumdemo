import { describe, expect, it } from 'vitest';
import { appointmentErrorMessage } from './appointmentError';

describe('appointment error diagnosis', () => {
  it('distinguishes stale edits from permissions and connectivity', () => {
    expect(appointmentErrorMessage({code:'40001'})).toContain('alterada entretanto');
    expect(appointmentErrorMessage(new Error('A consulta foi alterada. Atualize os dados.'))).toContain('40001');
    expect(appointmentErrorMessage({code:'42501'})).toContain('permissão');
    expect(appointmentErrorMessage(new TypeError('Failed to fetch'))).toContain('ligar ao servidor');
  });
  it('does not expose backend details or arbitrary codes', () => {
    expect(appointmentErrorMessage({code:'23502',message:'Patient sensitive detail'})).toContain('23502');
    expect(appointmentErrorMessage({code:'Patient name',message:'secret'})).not.toMatch(/Patient|secret/);
    expect(appointmentErrorMessage(null)).toContain('SEM-CODIGO');
  });
});
