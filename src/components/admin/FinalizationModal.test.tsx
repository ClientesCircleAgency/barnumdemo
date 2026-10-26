// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinalizationModal } from './FinalizationModal';

it('restores existing notes and review choice and retains the draft after a failed submission', () => {
  const onFinalize = vi.fn();
  const props = { appointment: { id: 'a', final_notes: 'Existing note', send_review: false }, patientName: 'Test', open: true, onOpenChange: vi.fn(), onFinalize };
  const view = render(<FinalizationModal {...props} />);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Existing note');
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar Consulta' }));
  expect(onFinalize).toHaveBeenCalledWith('Edited note', false);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Edited note');
  view.rerender(<FinalizationModal {...props} open={false} />);
  view.rerender(<FinalizationModal {...props} appointment={{ id: 'b', final_notes: null, send_review: true }} />);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  view.unmount();
});
