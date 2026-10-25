// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentWizard } from './AppointmentWizard';

const mocks = vi.hoisted(() => ({
  patient: { id: 'patient-1', name: 'Paciente Teste', nif: '123456789', phone: '+351910000000', createdAt: '2026-01-01' },
  addPatient: vi.fn(),
  addAppointment: vi.fn(),
  toast: vi.fn(),
  isDoctor: false,
  availabilityLoading: false,
  availabilityError: false,
  specialties: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Medicina Dentária' }],
  consultationTypes: [{ id: '22222222-2222-4222-8222-222222222222', specialtyId: '11111111-1111-4111-8111-111111111111', name: 'Implantologia' }],
  findPatient: vi.fn(),
  schedule: () => ['09:00', '09:15'],
  professionals: [] as Array<{ id: string; userId: string; name: string; specialty: string; specialtyIds: string[]; color: string }>,
  availability: [] as Array<{ user_id: string; time_off: []; working_hours: Array<{ day: string; start: string; end: string; enabled: boolean }> }>,
}));
vi.mock('@/context/ClinicContext', () => ({ useClinic: () => ({
  professionals: mocks.professionals, specialties: mocks.specialties, consultationTypes: mocks.consultationTypes, addAppointment: mocks.addAppointment,
  findPatientByNif: mocks.findPatient,
  getAppointmentsByPatient: () => [], addPatient: mocks.addPatient,
}) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, isDoctor: mocks.isDoctor }) }));
vi.mock('@/hooks/useAppointmentTeamAvailability', () => ({ useAppointmentTeamAvailability: () => ({ data: mocks.professionals.map(p => ({ professional_id: p.id, available: true })), isFetching: false, isError: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useProfessionalServicePreferences', () => ({ useProfessionalServicePreferences: () => ({ data: [] }) }));
vi.mock('@/hooks/useClinicSchedule', () => ({ useClinicSchedule: () => ({ getTimeSlotsForDate: mocks.schedule }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mocks.availability, isLoading: mocks.availabilityLoading, isError: mocks.availabilityError }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
// Keep form state/validation real; replace only the portal-based select UI.
vi.mock('@/components/ui/select', () => {
  const text = (node: React.ReactNode): string => React.Children.toArray(node).map(child =>
    React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child),
  ).join('');
  return {
  Select: ({ children, value, onValueChange, disabled }: React.PropsWithChildren<{ value: string; onValueChange: (value: string) => void; disabled?: boolean }>) => <select value={value} onChange={e => onValueChange(e.target.value)} disabled={disabled}><option value="" />{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectItem: ({ value, children }: React.PropsWithChildren<{ value: string }>) => <option value={value}>{text(children)}</option>,
}; });

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedule = () => ['09:00', '09:15'];
  mocks.professionals = [];
  mocks.availability = [];
  mocks.isDoctor = false;
  mocks.availabilityLoading = false;
  mocks.availabilityError = false;
  mocks.addAppointment.mockResolvedValue(undefined);
  mocks.findPatient.mockImplementation((nif: string) => nif === mocks.patient.nif ? mocks.patient : null);
  mocks.addPatient.mockResolvedValue({ ...mocks.patient, id: 'new-patient', name: 'Novo Teste', nif: '999999999' });
});

describe('manual appointment patient flow', () => {
  it.each([['13:00', false], ['16:00', true]])('validates a doctor booking at %s before saving', async (time, allowed) => {
    mocks.isDoctor = true;
    mocks.professionals = [{ id: '33333333-3333-4333-8333-333333333333', userId: 'user-1', name: 'Dr. Nogueira Nunes', specialty: mocks.specialties[0].id, specialtyIds: [mocks.specialties[0].id], color: '#fff' }];
    mocks.availability = [{ user_id: 'user-1', time_off: [], working_hours: [{ day: 'Segunda', start: '16:00', end: '19:00', enabled: true }] }];
    mocks.schedule = () => [time];
    const user = userEvent.setup();
    render(<AppointmentWizard open onOpenChange={vi.fn()} preselectedPatient={mocks.patient} preselectedDate={new Date(2026, 9, 26)} />);
    await user.selectOptions(screen.getByRole('option', { name: 'Medicina Dentária' }).closest('select')!, mocks.specialties[0].id);
    await user.selectOptions(screen.getByRole('option', { name: 'Implantologia' }).closest('select')!, mocks.consultationTypes[0].id);
    await user.click(screen.getByRole('button', { name: 'Criar Consulta' }));
    if (allowed) {
      await waitFor(() => expect(mocks.addAppointment).toHaveBeenCalledWith(expect.objectContaining({ time: '16:00', duration: 30 })));
    } else {
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Profissional indisponível' })));
      expect(mocks.addAppointment).not.toHaveBeenCalled();
    }
  });
  it('updates the doctor dropdown when appointment time or duration changes', async () => {
    mocks.professionals = [{ id: 'doctor-1', userId: 'user-1', name: 'Dr. Nogueira Nunes', specialty: 'dental', specialtyIds: ['dental'], color: '#fff' }];
    mocks.availability = [{ user_id: 'user-1', time_off: [], working_hours: [{ day: 'Segunda', start: '16:00', end: '19:00', enabled: true }] }];
    mocks.schedule = () => ['13:00', '16:00', '18:30'];
    const user = userEvent.setup();
    render(<AppointmentWizard open onOpenChange={vi.fn()} preselectedPatient={mocks.patient} preselectedDate={new Date(2026, 9, 26)} />);
    expect(screen.queryByRole('option', { name: 'Dr. Nogueira Nunes' })).toBeNull();
    const time = screen.getByRole('option', { name: '13:00' }).closest('select')!;
    await user.selectOptions(time, '16:00');
    expect(await screen.findByRole('option', { name: 'Dr. Nogueira Nunes' })).toBeTruthy();
    await user.selectOptions(time, '18:30');
    const duration = screen.getByRole('spinbutton');
    await user.clear(duration);
    await user.type(duration, '60');
    expect(screen.queryByRole('option', { name: 'Dr. Nogueira Nunes' })).toBeNull();
    await user.clear(duration);
    await user.type(duration, '30');
    expect(await screen.findByRole('option', { name: 'Dr. Nogueira Nunes' })).toBeTruthy();
  });
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
