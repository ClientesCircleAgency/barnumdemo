// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {TreatmentSessionEditor} from './TreatmentSessionEditor';
const m=vi.hoisted(()=>({save:vi.fn().mockResolvedValue('session')}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/hooks/useTreatments',()=>({useTreatmentRpc:()=>({mutateAsync:m.save})}));
vi.mock('@/hooks/useConsultationTypes',()=>({useConsultationTypes:()=>({data:[{id:'type',name:'Revisão',specialty_id:'spec'}]})}));
vi.mock('@/hooks/useProfessionals',()=>({useProfessionals:()=>({data:[{id:'doc',name:'Ana',specialty_id:'spec',is_active:true}]})}));
vi.mock('@/hooks/useProfessionalSpecialties',()=>({useProfessionalSpecialties:()=>({data:[]})}));
vi.mock('@/hooks/useProfessionalServicePreferences',()=>({useProfessionalServicePreferences:()=>({data:[]})}));
it('plans a session without creating dates or appointments',async()=>{
 const done=vi.fn();render(<TreatmentSessionEditor treatment={{id:'t',specialty_id:'spec',primary_professional_id:'doc'} as never} ordinal={2} onSaved={done} onCancel={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Nome da etapa'),{target:{value:'Revisão do implante'}});
 fireEvent.change(screen.getByLabelText('Tipo de consulta'),{target:{value:'type'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar etapa'}));
 await waitFor(()=>expect(done).toHaveBeenCalled());
 expect(m.save).toHaveBeenCalledWith(expect.objectContaining({p_treatment_id:'t',p_fields:expect.objectContaining({name:'Revisão do implante',ordinal:2,primary_professional_id:'doc'})}));
 expect(m.save.mock.calls[0][0].p_fields).not.toHaveProperty('date');
});
