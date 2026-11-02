import { useClinicalObservations } from '@/hooks/useClinicalObservations';
import { useTreatmentRpc } from '@/hooks/useTreatments';
import { ClinicalTextList } from './TreatmentComments';
export function ClinicalObservations({appointmentId,canWrite}:{appointmentId:string;canWrite:boolean}){
 const query=useClinicalObservations(appointmentId);const mutation=useTreatmentRpc('save_clinical_observation');
 return <ClinicalTextList items={query.data} refresh={async()=>{const result=await query.refetch();if(result.error)throw result.error;return result.data??[];}} errorLoading={query.isError} label="Observações médicas internas" canWrite={canWrite} isPending={mutation.isPending} revisionKind="observation" save={(id,version,body)=>mutation.mutateAsync({p_id:id,p_expected_version:version,p_appointment_id:appointmentId,p_body:body})}/>;
}
