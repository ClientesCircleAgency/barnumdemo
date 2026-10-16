// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentWizard } from './AppointmentWizard';

const mocks = vi.hoisted(() => ({
  patient: { id: 'patient-1', name: 'Paciente Teste', nif: '123456789', phone: '+351910000000', createdAt: '2026-01-01' },
  addPatient: vi.fn(),
  findPatient: vi.fn(),
  schedule: () => ['09:00', '09:15'],
}));
vi.mock('@/context/ClinicContext', () => ({ useClinic: () => ({
  professionals: [], specialties: [], consultationTypes: [], addAppointment: vi.fn(),
  findPatientByNif: mocks.findPatient,
  getAppointmentsByPatient: () => [], addPatient: mocks.addPatient,
}) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isDoctor: false }) }));
vi.mock('@/hooks/useProfessionalServicePreferences', () => ({ useProfessionalServicePreferences: () => ({ data: [] }) }));
vi.mock('@/hooks/useClinicSchedule', () => ({ useClinicSchedule: () => ({ getTimeSlotsForDate: mocks.schedule }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedule = () => ['09:00', '09:15'];
  mocks.findPatient.mockImplementation((nif: string) => nif === mocks.patient.nif ? mocks.patient : null);
  mocks.addPatient.mockResolvedValue({ ...mocks.patient, id: 'new-patient', name: 'Novo Teste', nif: '999999999' });
});

describe('manual appointment patient flow', () => {
  it('preserves the selected patient and details when schedule data refreshes', async () => {
    const user = userEvent.setup();
    const props = { open: true, onOpenChange: vi.fn(), preselectedPatient: mocks.patient };
    const view = render(<AppointmentWizard {...props} />);
    // Existing versions show a confirmation step for a preselected patient.
    const next = screen.queryByRole('button', { name: 'Continuar' });
    if (next) await user.click(next);
    await user.type(screen.getByPlaceholderText('Notas sobre a marcacao...'), 'Manter estas notas');
    mocks.schedule = () => ['09:00', '09:15', '09:30'];
    view.rerender(<AppointmentWizard {...props} />);
    expect((screen.getByPlaceholderText('Notas sobre a marcacao...') as HTMLTextAreaElement).value).toBe('Manter estas notas');
    expect(screen.getByText('Paciente Teste')).toBeTruthy();
  });

  it('offers both entry paths and advances after selecting an existing patient', async () => {
    const user = userEvent.setup();
    render(<AppointmentWizard open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Criar paciente$/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Paciente existente$/i }));
    await user.type(screen.getByLabelText('NIF do Paciente *'), mocks.patient.nif);
    await user.click(await screen.findByRole('button', { name: 'Selecionar' }));
    expect(screen.getByText('Nova Consulta - Detalhes')).toBeTruthy();
    expect(screen.getByText('Paciente Teste')).toBeTruthy();
    expect(mocks.addPatient).not.toHaveBeenCalled();
  });

  it('creates a patient and carries that patient directly into the appointment', async () => {
    const user = userEvent.setup();
    render(<AppointmentWizard open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Criar paciente$/i }));
    await user.type(screen.getByLabelText('NIF do Paciente *'), '999999999');
    await user.type(screen.getByLabelText('Nome Completo *'), 'Novo Teste');
    await user.type(screen.getByPlaceholderText('912 345 678'), '910000000');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Criar e Continuar' }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Criar e Continuar' }));
    await waitFor(() => expect(screen.getByText('Nova Consulta - Detalhes')).toBeTruthy());
    expect(screen.getByText('Novo Teste')).toBeTruthy();
    expect(mocks.addPatient).toHaveBeenCalledTimes(1);
  });

  it('selects the existing record instead of creating a duplicate in the create path', async () => {
    const user = userEvent.setup();
    render(<AppointmentWizard open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Criar paciente$/i }));
    await user.type(screen.getByLabelText('NIF do Paciente *'), mocks.patient.nif);
    await user.click(await screen.findByRole('button', { name: 'Selecionar' }));
    expect(screen.getByText('Nova Consulta - Detalhes')).toBeTruthy();
    expect(mocks.addPatient).not.toHaveBeenCalled();
  });

  it('keeps the new patient form available when saving fails', async () => {
    mocks.addPatient.mockRejectedValue(new Error('Não foi possível guardar'));
    const user = userEvent.setup();
    render(<AppointmentWizard open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Criar paciente$/i }));
    await user.type(screen.getByLabelText('NIF do Paciente *'), '999999999');
    await user.type(screen.getByLabelText('Nome Completo *'), 'Novo Teste');
    await user.type(screen.getByPlaceholderText('912 345 678'), '910000000');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Criar e Continuar' }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Criar e Continuar' }));
    expect(await screen.findByText('Não foi possível guardar')).toBeTruthy();
    expect(screen.queryByText('Nova Consulta - Detalhes')).toBeNull();
    expect((screen.getByLabelText('Nome Completo *') as HTMLInputElement).value).toBe('Novo Teste');
  });

  it('starts a fresh selection when closed and reopened', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const view = render(<AppointmentWizard open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: /^Paciente existente$/i }));
    await user.type(screen.getByLabelText('NIF do Paciente *'), mocks.patient.nif);
    await user.click(await screen.findByRole('button', { name: 'Selecionar' }));
    view.rerender(<AppointmentWizard open={false} onOpenChange={onOpenChange} />);
    view.rerender(<AppointmentWizard open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('button', { name: /^Paciente existente$/i })).toBeTruthy();
    expect(screen.queryByText('Paciente Teste')).toBeNull();
  });
});
