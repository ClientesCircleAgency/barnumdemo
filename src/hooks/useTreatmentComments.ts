import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useTreatmentComments(sessionId:string) {
 return useQuery({queryKey:['session-comments',sessionId],refetchInterval:15000,queryFn:async()=>{const {data,error}=await supabase.from('treatment_session_comments').select('*').eq('session_id',sessionId).order('created_at');if(error)throw error;return data;}});
}
