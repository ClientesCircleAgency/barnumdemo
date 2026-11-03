import {useState} from 'react';
import {refreshFinalization} from '@/lib/refreshFinalization';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {useProfessionals} from '@/hooks/useProfessionals';
import {useTreatmentRpc} from '@/hooks/useTreatments';
import type {ClinicAppointment} from '@/types/clinic';
import {Button} from '@/components/ui/button';
import {FinalizationModal} from '../FinalizationModal';
import {ClinicalObservations} from './ClinicalObservations';

export function AppointmentClinicalPanel({appointment}:{appointment:ClinicAppointment}){
 const {user,isAdmin,isSecretary}=useAuth();const {data:professionals=[]}=useProfessionals();const mutation=useTreatmentRpc('finalize_appointment_with_observation');const [finalizing,setFinalizing]=useState<ClinicAppointment|null>(null);
 const ids=[appointment.professionalId,...appointment.additionalProfessionalIds??[]];const canWrite=isAdmin||isSecretary||professionals.some(p=>p.user_id===user?.id&&ids.includes(p.id));
 const relation=useQuery({queryKey:['appointment-treatment',appointment.id],refetchInterval:15000,queryFn:async()=>{const {data,error}=await supabase.from('treatment_sessions').select('id,name,treatments(id,name,patient_id)').eq('appointment_id',appointment.id).maybeSingle();if(error)throw error;return data;}});
 return <section className="space-y-4 border-t pt-4">{relation.isError&&<p role="alert" className="text-sm text-destructive">Não foi possível consultar o tratamento desta consulta.</p>}{relation.data?.treatments&&<Link className="block rounded-lg bg-primary/10 p-3 text-sm" to={`/admin/pacientes/${relation.data.treatments.patient_id}?tab=tratamentos&tratamento=${relation.data.treatments.id}`}>Tratamento: <strong>{relation.data.treatments.name}</strong><span className="mt-1 block">{relation.data.name} →</span></Link>}<ClinicalObservations appointmentId={appointment.id} canWrite={canWrite}/>{canWrite&&['confirmed','waiting','in_progress'].includes(appointment.status)&&<Button onClick={()=>setFinalizing({...appointment})}>Concluir consulta</Button>}{finalizing&&<FinalizationModal includeInternalObservation onRefresh={()=>refreshFinalization(finalizing.id,row=>setFinalizing({...finalizing,version:row.version}))} appointment={{id:finalizing.id,final_notes:finalizing.finalNotes??null,send_review:finalizing.sendReview??true}} patientName={null} open onOpenChange={open=>{if(!open)setFinalizing(null);}} onFinalize={async(finalNotes,sendReview,internal='')=>{await mutation.mutateAsync({p_appointment_id:finalizing.id,p_expected_version:finalizing.version,p_final_notes:finalNotes,p_send_review:sendReview,p_internal_observation:internal});setFinalizing(null);}}/>}</section>;
}
