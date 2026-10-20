// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestsBoard } from './RequestsBoard';
import type { AppointmentRequest } from '@/hooks/useAppointmentRequests';

const request = (status: AppointmentRequest['status'], id: string = status): AppointmentRequest => ({
  id, status, name: `Paciente ${id}`, email: `${id}@example.test`, phone: '910000000', nif: '123456789',
  specialty_id: 'specialty', specialty_name: null, reason: 'Consulta', preferred_date: '2026-11-10', preferred_time: '09:00',
  estimated_duration: 30, assigned_professional_id: null, professional_name: null,
  suggested_slots: status === 'suggested' ? [{ date: '2026-11-11', time: '10:00' }] : [],
  accepted_slot: null, suggestion_expires_at: null, rejection_reason: null, cancel_reason: null,
  created_at: '2026-10-16T12:00:00Z', updated_at: '2026-10-16T12:00:00Z',
});
afterEach(cleanup);

describe('requests board', () => {
  it('separates pending, suggested, confirmed and closed with visible labels', () => {
    render(<RequestsBoard requests={['pending', 'suggested', 'converted', 'rejected', 'pre_confirmed'].map(status => request(status as AppointmentRequest['status']))} onSelect={vi.fn()} />);
    expect(within(screen.getByRole('region', { name: 'Pendentes' })).getByText('Paciente pending')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Pendentes' })).getByText('Paciente pre_confirmed')).toBeTruthy();
    const suggested = screen.getByRole('region', { name: 'Horário sugerido' });
    expect(within(suggested).getByText('Paciente suggested')).toBeTruthy();
    const processed = screen.getByRole('region', { name: 'Processados' });
    expect(within(processed).getByText('Paciente converted')).toBeTruthy();
    expect(within(processed).queryByText('Paciente suggested')).toBeNull();
    expect(within(processed).queryByText('Paciente rejected')).toBeNull();
    expect(screen.queryByRole('tab', { name: /Mensagens/ })).toBeNull();
  });
  it('moves a request only when its confirmed conversion arrives', () => {
    const view = render(<RequestsBoard requests={[request('pending', 'one')]} onSelect={vi.fn()} />);
    view.rerender(<RequestsBoard requests={[request('suggested', 'one')]} onSelect={vi.fn()} />);
    expect(within(screen.getByRole('region', { name: 'Horário sugerido' })).getByText('Paciente one')).toBeTruthy();
    view.rerender(<RequestsBoard requests={[request('converted', 'one')]} onSelect={vi.fn()} />);
    expect(within(screen.getByRole('region', { name: 'Processados' })).getByText('Paciente one')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Horário sugerido' })).queryByText('Paciente one')).toBeNull();
  });
  it('searches processed as well as pending requests and opens details', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const converted = request('converted');
    render(<RequestsBoard requests={[request('pending'), converted]} onSelect={onSelect} />);
    await user.type(screen.getByRole('textbox', { name: 'Pesquisar pedidos' }), 'converted');
    expect(screen.queryByText('Paciente pending')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Paciente converted/ }));
    expect(onSelect).toHaveBeenCalledWith(converted);
  });
});
