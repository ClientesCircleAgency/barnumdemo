// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {TreatmentBookingDialog} from './TreatmentBookingDialog';
const m=vi.hoisted(()=>({save:vi.fn().mockRejectedValue({message:'session_unavailable: s'}),refetch:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/hooks/useTreatments',()=>({useTreatmentRpc:()=>({mutateAsync:m.save,isPending:false})}));
vi.mock('@/hooks/useProfessionals',()=>({useProfessionals:()=>({data:[{id:'a',name:'Ana'},{id:'b',name:'Miguel'}]})}));
vi.mock('@/hooks/useTreatmentSlots',()=>({lisbonToday:()=> '2026-11-10',timeMinutes:(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5)),useTreatmentSlots:()=>({data:['10:00','11:00'],refetch:m.refetch})}));
it('reviews a complete team slot and preserves choices when atomic booking fails',async()=>{
 const session={session:{id:'s',version:1,name:'Cirurgia',duration:60,primary_professional_id:'a'},additional_professional_ids:['b']};
 render(<TreatmentBookingDialog treatmentId="t" sessions={[session as never]} open onOpenChange={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'10:00'}));
 fireEvent.click(screen.getByRole('button',{name:'Rever marcações'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirmar 1 consulta'}));
 await waitFor(()=>expect(m.save).toHaveBeenCalled());
 expect(m.save.mock.calls[0][0].p_slots[0]).toEqual(expect.objectContaining({session_id:'s',expected_version:1,time:'10:00'}));
 expect((await screen.findByRole('alert')).textContent).toContain('Cirurgia');expect(screen.getByText(/10:00/)).toBeTruthy();
});
