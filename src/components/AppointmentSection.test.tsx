// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentSection } from './AppointmentSection';

vi.mock('@/hooks/useIntersectionObserver', () => ({ useIntersectionObserver: () => ({ ref: null, isVisible: true }) }));
vi.mock('@/hooks/useAppointmentRequests', () => ({ useAddAppointmentRequest: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/hooks/useSpecialties', () => ({ useSpecialties: () => ({ data: [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Medicina Dentária' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Rejuvenescimento Facial' },
] }) }));
afterEach(cleanup);

it('explains specialty selection and exposes the selected option', async () => {
  const user = userEvent.setup();
  render(<AppointmentSection />);
  expect(screen.getByRole('group', { name: /Especialidade/ })).toBeTruthy();
  expect(screen.getByText('Clique numa das opções para selecionar.')).toBeTruthy();
  const dental = screen.getByRole('button', { name: /Medicina Dentária/ });
  const facial = screen.getByRole('button', { name: /Rejuvenescimento Facial/ });
  await user.click(dental);
  expect(dental.getAttribute('aria-pressed')).toBe('true');
  expect(facial.getAttribute('aria-pressed')).toBe('false');
  facial.focus();
  await user.keyboard('{Enter}');
  expect(facial.getAttribute('aria-pressed')).toBe('true');
  expect(dental.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByText('Selecionada')).toBeTruthy();
});
