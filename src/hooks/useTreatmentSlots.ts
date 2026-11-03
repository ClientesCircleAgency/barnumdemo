import {useQuery} from '@tanstack/react-query';
import {useClinicSchedule} from './useClinicSchedule';
import {supabase} from '@/integrations/supabase/client';
import type {TreatmentSessionView} from './useTreatmentSessions';
export const timeMinutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
export function lisbonToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function useTreatmentSlots(view:TreatmentSessionView|undefined,date:string,enabled=true){
 const {getTimeSlotsForDate}=useClinicSchedule();const s=view?.session;
 const candidates=date?getTimeSlotsForDate(new Date(date+'T12:00:00'),30):[];
 return useQuery({queryKey:['appointment-team-availability','treatment',s?.id,s?.version,date,candidates.join(',')],enabled:enabled&&!!s&&!!date,staleTime:0,queryFn:async()=>{
  const {data:t,error:te}=await supabase.from('treatments').select('specialty_id,patient_id').eq('id',s!.treatment_id).single();if(te)throw te;
  const {data:busy,error:be}=await supabase.from('appointments').select('date,time,duration').eq('patient_id',t.patient_id).eq('date',date).in('status',['confirmed','waiting','in_progress']);if(be)throw be;
  const ids=[s!.primary_professional_id,...view!.additional_professional_ids];
  const nowTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  const available=await Promise.all(candidates.filter(time=>date>lisbonToday()||(date===lisbonToday()&&time>nowTime)).filter(time=>!busy.some(a=>timeMinutes(time)<timeMinutes(a.time)+a.duration&&timeMinutes(time)+s!.duration>timeMinutes(a.time))).map(async time=>{
   const {data,error}=await supabase.rpc('get_appointment_team_availability',{p_specialty_id:t.specialty_id,p_consultation_type_id:s!.consultation_type_id,p_date:date,p_time:time,p_duration:s!.duration,p_exclude_appointment_id:null});if(error)throw error;
   return ids.every(id=>data.some(p=>p.professional_id===id&&p.available))?time:null;
  }));return available.filter((time):time is string=>time!==null);
 }});
}
