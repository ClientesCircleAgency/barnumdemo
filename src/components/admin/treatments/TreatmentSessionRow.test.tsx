// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TreatmentSessionRow } from './TreatmentSessionRow';
vi.mock('@/hooks/useProfessionals',()=>({useProfessionals:()=>({data:[{id:'doctor',name:'Dra. Ana',color:'#123456'}]})}));
vi.mock('./TreatmentComments',()=>({TreatmentComments:({sessionId,canWrite}:{sessionId:string;canWrite:boolean})=><div>Comentários {sessionId} {canWrite?'editar':'ler'}</div>}));
vi.mock('./ClinicalObservations',()=>({ClinicalObservations:()=>null}));
const session={session:{id:'session-one',name:'Avaliação inicial',kind:'consultation',ordinal:1,duration:30,disposition:'planned',primary_professional_id:'doctor'},appointment:null,additional_professional_ids:[],can_write:false};
it('pairs each planned session with its own comments without allowing completion',()=>{
 render(<TreatmentSessionRow session={session as never} manager onBook={()=>{}} onEdit={()=>{}}/>);
 expect(screen.getByText('Avaliação inicial')).toBeTruthy();
 expect(screen.getByText('Comentários session-one ler')).toBeTruthy();
 expect(screen.getByText('Por marcar')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Marcar consulta'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Concluir/})).toBeNull();cleanup();
});
