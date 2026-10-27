// @vitest-environment jsdom
import { expect,it,vi } from 'vitest';
import { render,screen,fireEvent } from '@testing-library/react';
import { TreatmentComments } from './TreatmentComments';
const mock=vi.hoisted(()=>({save:vi.fn().mockRejectedValue(new Error('offline'))}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:vi.fn()}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'mine'},isAdmin:false})}));
vi.mock('@/hooks/useTreatmentComments',()=>({useTreatmentComments:()=>({data:[{id:'c',session_id:'s',author_user_id:'other',author_name:'Other',body:'Only this session',version:1,created_at:'2026-10-27T10:00:00Z'}]})}));
vi.mock('@/hooks/useTreatments',()=>({useTreatmentRpc:()=>({mutateAsync:mock.save,isPending:false})}));
it('allows reading but not commenting for nonparticipants',()=>{const view=render(<TreatmentComments sessionId="s" canWrite={false}/>);expect(screen.getByText('Only this session')).toBeTruthy();expect(screen.queryByRole('button',{name:'Editar'})).toBeNull();expect(screen.queryByRole('button',{name:'Enviar'})).toBeNull();view.unmount();});
it('preserves comment draft on failure and does not edit other authors',async()=>{const view=render(<TreatmentComments sessionId="s" canWrite/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'My private draft'}});fireEvent.click(screen.getByRole('button',{name:'Enviar'}));expect(await screen.findByRole('alert')).toBeTruthy();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('My private draft');expect(screen.queryByRole('button',{name:'Editar'})).toBeNull();view.unmount();});
