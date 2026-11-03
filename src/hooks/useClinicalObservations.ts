import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useClinicalObservations(id:string) {
 return useQuery({queryKey:['clinical-observations',id],enabled:!!id,refetchInterval:15000,queryFn:async()=>{const {data,error}=await supabase.from('appointment_clinical_observations').select('*').eq('appointment_id',id).order('created_at');if(error)throw error;return data;}});
}
