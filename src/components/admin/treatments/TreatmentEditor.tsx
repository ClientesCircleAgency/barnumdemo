import {useId,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {useSpecialties} from '@/hooks/useSpecialties';
import {useProfessionals} from '@/hooks/useProfessionals';
import {useProfessionalSpecialties} from '@/hooks/useProfessionalSpecialties';
import {useTreatmentRpc} from '@/hooks/useTreatments';
import type {Treatment} from '@/types/treatments';
import {AppointmentProfessionalsField} from '../AppointmentProfessionalsField';
import {treatmentError} from './TreatmentComments';
export const fieldClass='h-11 w-full rounded-lg border bg-background px-3 text-sm';
export function TreatmentEditor({patientId,treatment,professionalIds=[],onSaved,onCancel}:{patientId:string;treatment?:Treatment;professionalIds?:string[];onSaved:(id:string)=>void;onCancel:()=>void}) {
 const prefix=useId();const {data:specialties=[]}=useSpecialties();const {data:professionals=[]}=useProfessionals();const {data:links=[]}=useProfessionalSpecialties();
 const mutation=useTreatmentRpc('save_treatment');
 const [name,setName]=useState(treatment?.name??'');const [objective,setObjective]=useState(treatment?.objective??'');const [specialty,setSpecialty]=useState(treatment?.specialty_id??'');const [primary,setPrimary]=useState(treatment?.primary_professional_id??'');const [extras,setExtras]=useState(professionalIds.filter(id=>id!==treatment?.primary_professional_id));const [error,setError]=useState('');
 const eligible=professionals.filter(p=>p.is_active!==false&&(p.specialty_id===specialty||links.some(l=>l.professional_id===p.id&&l.specialty_id===specialty)));
 const valid=[primary,...extras].every(id=>eligible.some(p=>p.id===id));
 async function submit(e:React.FormEvent){e.preventDefault();setError('');try{const id=await mutation.mutateAsync({p_id:treatment?.id??null,p_expected_version:treatment?.version??null,p_fields:{name:name.trim(),objective:objective.trim(),patient_id:patientId,specialty_id:specialty},p_primary_professional_id:primary,p_professional_ids:[primary,...extras]});onSaved(id);}catch(e){setError(treatmentError(e));}}
 return <form onSubmit={submit} className="space-y-4"><label className="block space-y-2" htmlFor={prefix+'name'}><span>Nome do tratamento</span><Input id={prefix+'name'} required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><label className="block space-y-2" htmlFor={prefix+'objective'}><span>Objetivo</span><Textarea id={prefix+'objective'} maxLength={20000} value={objective} onChange={e=>setObjective(e.target.value)}/></label><label className="block space-y-2" htmlFor={prefix+'specialty'}><span>Especialidade</span><select id={prefix+'specialty'} className={fieldClass} required value={specialty} onChange={e=>{setSpecialty(e.target.value);setPrimary('');setExtras([]);}}><option value="">Selecionar especialidade</option>{specialties.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="block space-y-2" htmlFor={prefix+'primary'}><span>Profissional principal</span><select id={prefix+'primary'} className={fieldClass} required value={primary} onChange={e=>{setPrimary(e.target.value);setExtras(extras.filter(id=>id!==e.target.value));}}><option value="">Selecionar profissional</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><AppointmentProfessionalsField primaryProfessionalId={primary} value={extras} onChange={setExtras} professionals={professionals} availableIds={eligible.map(p=>p.id)}/>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>Cancelar</Button><Button disabled={mutation.isPending||!valid||!name.trim()}>Guardar tratamento</Button></div></form>;
}
