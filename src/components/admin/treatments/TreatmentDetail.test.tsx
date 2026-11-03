// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {TreatmentDetail} from './TreatmentDetail';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({isAdmin:false,isSecretary:false,user:{id:'reader'}})}));
vi.mock('@/context/ClinicContext',()=>({useClinic:()=>({appointments:[]})}));
vi.mock('@/hooks/useTreatments',()=>({useTreatment:()=>({data:{id:'t',name:'Implante',status:'active',objective:'Recuperar função',treatment_professionals:[]}}),useTreatmentRpc:()=>({mutateAsync:vi.fn()})}));
vi.mock('@/hooks/useTreatmentSessions',()=>({useTreatmentSessions:()=>({data:[{session:{id:'s',name:'Primeira etapa',disposition:'planned',ordinal:1,kind:'consultation'},appointment:null,can_write:false}]})}));
vi.mock('@/hooks/useProfessionals',()=>({useProfessionals:()=>({data:[]})}));
vi.mock('@/hooks/useSpecialties',()=>({useSpecialties:()=>({data:[]})}));
vi.mock('./TreatmentSessionRow',()=>({TreatmentSessionRow:()=> <div>Sessão e comentários</div>}));
vi.mock('./TreatmentEditor',()=>({TreatmentEditor:()=>null}));
vi.mock('./TreatmentSessionEditor',()=>({TreatmentSessionEditor:()=>null}));
vi.mock('./TreatmentBookingDialog',()=>({TreatmentBookingDialog:()=>null}));
vi.mock('../AppointmentDetailDrawer',()=>({AppointmentDetailDrawer:()=>null}));
it('lets a nonparticipant read the treatment without exposing planning controls',()=>{
 render(<TreatmentDetail treatmentId="t" onBack={()=>{}}/>);
 expect(screen.getByText('Recuperar função')).toBeTruthy();expect(screen.getByText('Sessão e comentários')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Adicionar etapa'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Concluir tratamento'})).toBeNull();
});
