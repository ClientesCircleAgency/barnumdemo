// @vitest-environment jsdom
import { expect,it,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { TreatmentComments,ClinicalTextList } from './TreatmentComments';
const mock=vi.hoisted(()=>({save:vi.fn().mockRejectedValue(new Error('offline'))}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:vi.fn()}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'mine'},isAdmin:false})}));
vi.mock('@/hooks/useTreatmentComments',()=>({useTreatmentComments:()=>({data:[{id:'c',session_id:'s',author_user_id:'other',author_name:'Other',body:'Only this session',version:1,created_at:'2026-10-27T10:00:00Z'}]})}));
vi.mock('@/hooks/useTreatments',()=>({useTreatmentRpc:()=>({mutateAsync:mock.save,isPending:false})}));
it('allows reading but not commenting for nonparticipants',()=>{const view=render(<TreatmentComments sessionId="s" canWrite={false}/>);expect(screen.getByText('Only this session')).toBeTruthy();expect(screen.queryByRole('button',{name:'Editar'})).toBeNull();expect(screen.queryByRole('button',{name:'Enviar'})).toBeNull();view.unmount();});
it('preserves comment draft on failure and does not edit other authors',async()=>{const view=render(<TreatmentComments sessionId="s" canWrite/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'My private draft'}});fireEvent.click(screen.getByRole('button',{name:'Enviar'}));expect(await screen.findByRole('alert')).toBeTruthy();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('My private draft');expect(screen.queryByRole('button',{name:'Editar'})).toBeNull();view.unmount();});
it('reviews a newer version and retries with that version while keeping the draft',async()=>{
 const item={id:'c',author_user_id:'mine',author_name:'Me',body:'Original',version:1,created_at:'2026-11-02T10:00:00Z'};
 const save=vi.fn().mockRejectedValueOnce({code:'40001'}).mockResolvedValueOnce('c');
 const view=render(<ClinicalTextList items={[item]} canWrite save={save} isPending={false} label="Comentários" refresh={async()=>[{...item,version:2,body:'Remote edit'}]}/>);
 fireEvent.click(screen.getByRole('button',{name:'Editar'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'My preserved draft'}});fireEvent.click(screen.getByRole('button',{name:'Guardar alteração'}));
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Comparar com versão atual'}));
 await screen.findByText('Remote edit');fireEvent.click(screen.getByRole('button',{name:'Usar esta versão e manter o meu texto'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar alteração'}));await waitFor(()=>expect(save).toHaveBeenLastCalledWith('c',2,'My preserved draft'));view.unmount();
});
