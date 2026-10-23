// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestsPage from './RequestsPage';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const mocks = vi.hoisted(() => ({
  request: { id: 'request-1', status: 'pending', name: 'Paciente Teste', email: 'test@example.com', phone: '910000000', nif: '123456789', specialty_id: 'dental', reason: 'Consulta de avaliação', preferred_date: '2026-11-10', preferred_time: '09:00', created_at: '2026-10-23T10:00:00Z', accepted_slot: null, rejection_reason: null as string | null },
  specialties: [{ id: 'dental', name: 'Medicina Dentária' }],
  types: [{ id: 'checkup', specialty_id: 'dental', name: 'Check-Up' }],
  professionals: [{ id: 'doctor-1', specialty_id: 'dental', name: 'Médico Teste' }],
  empty: [],
  convert: vi.fn(), updateStatus: vi.fn(), suggest: vi.fn(),
}));
vi.mock('@/hooks/useAppointmentRequests', () => ({
  useAppointmentRequests: () => ({ data: [mocks.request] }),
  useUpdateAppointmentRequestStatus: () => ({ mutateAsync: mocks.updateStatus }),
  useConvertRequestToAppointment: () => ({ mutateAsync: mocks.convert }),
  useUpdateAppointmentRequestSuggestions: () => ({ mutateAsync: mocks.suggest }),
}));
vi.mock('@/hooks/useAppointments', () => ({ useAppointments: () => ({ data: mocks.empty }) }));
vi.mock('@/hooks/useSpecialties', () => ({ useSpecialties: () => ({ data: mocks.specialties }) }));
vi.mock('@/hooks/useConsultationTypes', () => ({ useConsultationTypes: () => ({ data: mocks.types }) }));
vi.mock('@/hooks/useProfessionals', () => ({ useProfessionals: () => ({ data: mocks.professionals }) }));
vi.mock('@/hooks/useProfessionalSpecialties', () => ({ useProfessionalSpecialties: () => ({ data: mocks.empty }) }));
vi.mock('@/hooks/useProfessionalServicePreferences', () => ({ useProfessionalServicePreferences: () => ({ data: mocks.empty }) }));
vi.mock('@/components/admin/SuggestAlternativesModal', () => ({ SuggestAlternativesModal: ({ open, onSubmit }: { open: boolean; onSubmit: (slots: { date: string; time: string }[]) => void }) => <Dialog open={open}><DialogContent><DialogTitle>Alternativas</DialogTitle><DialogDescription>Escolher horários</DialogDescription><button onClick={() => onSubmit([{ date: '2026-11-11', time: '10:00' }])}>Enviar alternativas de teste</button></DialogContent></Dialog> }));
vi.mock('@/components/ui/select', () => {
  const text = (node: React.ReactNode): string => React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child)).join('');
  return {
    Select: ({ children, value, onValueChange }: React.PropsWithChildren<{ value: string; onValueChange: (v: string) => void }>) => <select value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{children}</select>,
    SelectTrigger: () => null, SelectValue: () => null,
    SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectItem: ({ value, children }: React.PropsWithChildren<{ value: string }>) => <option value={value}>{text(children)}</option>,
  };
});
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.request.status = 'pending'; mocks.request.rejection_reason = null; mocks.convert.mockResolvedValue(undefined); mocks.suggest.mockResolvedValue(undefined); });

async function openRequest() {
  const user = userEvent.setup();
  render(<RequestsPage />);
  await user.click(screen.getByRole('button', { name: /Paciente Teste/ }));
  return user;
}

it('removes rejection while preserving confirmation', async () => {
  const user = await openRequest();
  await user.type(screen.getByRole('spinbutton'), '30');
  expect(screen.queryByRole('button', { name: /Rejeitar/ })).toBeNull();
  await user.selectOptions(screen.getByRole('option', { name: 'Check-Up' }).closest('select')!, 'checkup');
  await user.click(screen.getByRole('button', { name: 'Confirmar e agendar consulta' }));
  await waitFor(() => expect(mocks.convert).toHaveBeenCalledWith({ request_id: 'request-1', professional_id: 'doctor-1', consultation_type_id: 'checkup', duration: 30 }));
  expect(mocks.updateStatus).not.toHaveBeenCalled();
});

it('preserves sending alternative times without rejecting the request', async () => {
  const user = await openRequest();
  await user.type(screen.getByRole('spinbutton'), '30');
  await user.click(screen.getByRole('button', { name: 'Sugerir Alternativas' }));
  await user.click(screen.getByRole('button', { name: 'Enviar alternativas de teste', hidden: true }));
  await waitFor(() => expect(mocks.suggest).toHaveBeenCalledWith(expect.objectContaining({ id: 'request-1', suggested_slots: [{ date: '2026-11-11', time: '10:00' }] })));
  expect(mocks.updateStatus).not.toHaveBeenCalled();
});

it('retains the reason on historical rejected requests', async () => {
  mocks.request.status = 'rejected'; mocks.request.rejection_reason = 'Motivo histórico';
  await openRequest();
  expect(screen.getByText('Motivo: Motivo histórico')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Rejeitar/ })).toBeNull();
});
