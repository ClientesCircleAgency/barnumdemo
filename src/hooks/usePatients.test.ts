import { expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({insert:vi.fn(),upsert:vi.fn(),single:vi.fn(),invalidate:vi.fn()}));
vi.mock('@tanstack/react-query',()=>({useQuery:vi.fn(),useQueryClient:()=>({invalidateQueries:mocks.invalidate}),useMutation:(options:unknown)=>options}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({insert:mocks.insert,upsert:mocks.upsert})}}));
import {useAddPatient} from './usePatients';
it('never overwrites an existing patient when creating a record',async()=>{
 const chain={select:()=>({single:mocks.single})};mocks.insert.mockReturnValue(chain);mocks.upsert.mockReturnValue(chain);
 mocks.single.mockResolvedValue({data:null,error:{code:'23505',message:'duplicate key'}});
 const mutation=useAddPatient() as unknown as {mutationFn:(p:unknown)=>Promise<unknown>};
 await expect(mutation.mutationFn({name:'Test',nif:'123456789',phone:'912345678'})).rejects.toThrow(/NIF já registado/);
 expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({phone:'+351912345678'}));expect(mocks.upsert).not.toHaveBeenCalled();
});
