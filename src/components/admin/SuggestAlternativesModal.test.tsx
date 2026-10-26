// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuggestAlternativesModal } from './SuggestAlternativesModal';
const mocks=vi.hoisted(()=>({
  professionals:[{id:'a',name:'Ana',specialty_id:'s',color:'#2563eb'},{id:'b',name:'Miguel',specialty_id:'s',color:'#7c3aed'}],
  rpc:vi.fn(async (_name:string,args:{p_time:string})=>({data:[{professional_id:'a',available:true},{professional_id:'b',available:args.p_time==='10:00'}],error:null})),
}));
vi.mock('@/hooks/useProfessionals',()=>({useProfessionals:()=>({data:mocks.professionals})}));
vi.mock('@/hooks/useProfessionalSpecialties',()=>({useProfessionalSpecialties:()=>({data:[]})}));
vi.mock('@/hooks/useProfessionalServicePreferences',()=>({useProfessionalServicePreferences:()=>({data:[]})}));
vi.mock('@/hooks/useClinicSchedule',()=>({useClinicSchedule:()=>({getTimeSlotsForDate:()=>['09:00','10:00']})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc}}));
afterEach(cleanup);
it('offers only shared times, sends one complete team and clears selection when team changes',async()=>{
  const user=userEvent.setup(),submit=vi.fn().mockResolvedValue(undefined);
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><SuggestAlternativesModal open onOpenChange={()=>{}} source={{appointment_id:'request',name:'Patient',specialty_id:'s',professional_id:'a',additional_professional_ids:['b'],preferred_date:'2099-11-10',preferred_time:'09:00',duration_minutes:30}} onSubmit={submit}/></QueryClientProvider>);
  const time=await screen.findByRole('button',{name:'10:00'});
  expect(screen.queryByRole('button',{name:'09:00'})).toBeNull();
  await user.click(time);
  await user.click(screen.getByRole('button',{name:'Enviar Sugestões (1)'}));
  await waitFor(()=>expect(submit).toHaveBeenCalledWith([expect.objectContaining({professional_id:'a',additional_professional_ids:['b'],time:'10:00'})]));
  await user.click(screen.getByRole('button',{name:'10:00'}));
  await user.click(screen.getByRole('button',{name:'Remover'}));
  expect(screen.queryByText('Horários selecionados (1)')).toBeNull();
  expect(await screen.findByRole('button',{name:'09:00'})).toBeTruthy();
  client.clear();
});
