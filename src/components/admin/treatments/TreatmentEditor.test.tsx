// @vitest-environment jsdom
import { it,expect,vi } from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {TreatmentEditor} from './TreatmentEditor';
const mocks=vi.hoisted(()=>({save:vi.fn().mockResolvedValue('new-treatment')}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/hooks/useTreatments',()=>({useTreatmentRpc:()=>({mutateAsync:mocks.save})}));
vi.mock('@/hooks/useSpecialties',()=>({useSpecialties:()=>({data:[{id:'spec',name:'Dentária'}]})}));
vi.mock('@/hooks/useProfessionals',()=>({useProfessionals:()=>({data:[{id:'doc',name:'Ana',specialty_id:'spec',is_active:true}]})}));
vi.mock('@/hooks/useProfessionalSpecialties',()=>({useProfessionalSpecialties:()=>({data:[]})}));
it('saves a treatment for this patient with its full team and closes only after success',async()=>{
 const done=vi.fn();render(<TreatmentEditor patientId="patient" onSaved={done} onCancel={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Nome do tratamento'),{target:{value:'Implante'}});
 fireEvent.change(screen.getByLabelText('Especialidade'),{target:{value:'spec'}});
 fireEvent.change(screen.getByLabelText('Profissional principal'),{target:{value:'doc'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar tratamento'}));
 await waitFor(()=>expect(done).toHaveBeenCalledWith('new-treatment'));
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({p_fields:expect.objectContaining({patient_id:'patient',name:'Implante',specialty_id:'spec'}),p_professional_ids:['doc'],p_primary_professional_id:'doc'}));
});
