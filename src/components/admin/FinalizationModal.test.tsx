// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  expect(screen.getByLabelText('Notas para o paciente')).toBeTruthy();
  expect(screen.getByText(/2 a 3 horas/)).toBeTruthy();
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Edited note');
  view.rerender(<FinalizationModal {...props} open={false} />);
  view.rerender(<FinalizationModal {...props} appointment={{ id: 'b', final_notes: null, send_review: true }} />);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  view.unmount();
});

it('keeps internal observations separate and preserves drafts after failure or refresh',async()=>{
 const save=vi.fn().mockRejectedValue(new Error('offline'));
 const props={appointment:{id:'a',final_notes:'Patient',send_review:false},patientName:'Test',open:true,onOpenChange:vi.fn(),onFinalize:save,includeInternalObservation:true};
 const view=render(<FinalizationModal {...props}/>);
 fireEvent.change(screen.getByLabelText('Observações médicas internas'),{target:{value:'Private clinical text'}});
 fireEvent.change(screen.getByLabelText('Notas para o paciente'),{target:{value:'Public instructions'}});
 fireEvent.click(screen.getByRole('button',{name:'Finalizar Consulta'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith('Public instructions',false,'Private clinical text'));
 view.rerender(<FinalizationModal {...props} appointment={{...props.appointment,final_notes:'Server refresh'}}/>);
 expect((screen.getByLabelText('Notas para o paciente') as HTMLTextAreaElement).value).toBe('Public instructions');
 expect((screen.getByLabelText('Observações médicas internas') as HTMLTextAreaElement).value).toBe('Private clinical text');
 view.unmount();
});

it('allows reviewing a concurrent change and adopting the current version without losing text',async()=>{
 const apply=vi.fn(),save=vi.fn().mockRejectedValueOnce({code:'40001'}).mockResolvedValueOnce(undefined);
 const view=render(<FinalizationModal appointment={{id:'a',final_notes:null,send_review:false}} patientName="Demo" open onOpenChange={()=>{}} onFinalize={save} includeInternalObservation onRefresh={async()=>({description:'Consulta atualizada às 11:00',canApply:true,apply})}/>);
 fireEvent.change(screen.getByLabelText('Observações médicas internas'),{target:{value:'Draft'}});fireEvent.click(screen.getByRole('button',{name:'Finalizar Consulta'}));await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Rever consulta atualizada'}));await screen.findByText('Consulta atualizada às 11:00');fireEvent.click(screen.getByRole('button',{name:'Usar versão atual e manter os textos'}));expect(apply).toHaveBeenCalled();expect((screen.getByLabelText('Observações médicas internas') as HTMLTextAreaElement).value).toBe('Draft');view.unmount();
});
