// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessagesPage from './MessagesPage';

const mocks = vi.hoisted(() => ({ markRead: vi.fn(), isError: false, refetch: vi.fn() }));
vi.mock('@/hooks/useContactMessages', () => ({
  useContactMessages: () => ({ isError: mocks.isError, refetch: mocks.refetch, data: [
    { id: 'new', name: 'Contacto novo', email: 'new@example.test', phone: '910000000', message: 'Preciso de informações', is_read: false, created_at: '2026-10-16T10:00:00Z' },
    { id: 'read', name: 'Contacto lido', email: 'read@example.test', phone: '920000000', message: 'Obrigado', is_read: true, created_at: '2026-10-16T09:00:00Z' },
  ] }),
  useMarkContactMessageAsRead: () => ({ mutateAsync: mocks.markRead }),
}));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.isError = false; mocks.markRead.mockResolvedValue({}); });
describe('messages inbox', () => {
  it('shows actual contact messages, filters unread and opens an email reply', async () => {
    const user = userEvent.setup();
    render(<MessagesPage />);
    await user.click(screen.getByRole('button', { name: 'Por ler' }));
    expect(screen.queryByText('Contacto lido')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Contacto novo/ }));
    expect(mocks.markRead).toHaveBeenCalledWith('new');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Preciso de informações')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: /Responder por email/ }).getAttribute('href')).toBe('mailto:new@example.test');
  });
  it('searches message text and does not mark an already read message again', async () => {
    const user = userEvent.setup();
    render(<MessagesPage />);
    await user.type(screen.getByRole('textbox', { name: 'Pesquisar mensagens' }), 'Obrigado');
    expect(screen.queryByText('Contacto novo')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Contacto lido/ }));
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
  it('reports load failure rather than showing an empty inbox', async () => {
    mocks.isError = true;
    const user = userEvent.setup();
    render(<MessagesPage />);
    expect(screen.getByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.refetch).toHaveBeenCalled();
  });
});
