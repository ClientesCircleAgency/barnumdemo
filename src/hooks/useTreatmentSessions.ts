import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TreatmentSession } from '@/types/treatments';
export type TreatmentSessionView = {
 session:TreatmentSession;can_write:boolean;additional_professional_ids:string[];
 appointment:null|{id:string;date:string;time:string;duration:number;status:string;version:number;professional_id:string;consultation_type_id:string;professional_names:string[];additional_professional_ids:string[]};
};
export function useTreatmentSessions(id:string) {
 return useQuery({queryKey:['treatment-sessions',id],refetchInterval:15000,queryFn:async()=>{const {data,error}=await supabase.rpc('get_treatment_session_context',{p_treatment_id:id});if(error)throw error;return data as unknown as TreatmentSessionView[];}});
}
export { useTreatmentRpc } from './useTreatments';
