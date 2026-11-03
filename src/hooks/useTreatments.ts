import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
type Functions = Database['public']['Functions'];
export function useTreatmentRpc<K extends keyof Functions>(name: K) {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (args: Functions[K]['Args']) => {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  }, onSuccess: () => {
    for (const key of ['treatments','treatment','treatment-sessions','session-comments','clinical-observations','treatment-directory','appointment-treatment']) client.invalidateQueries({queryKey:[key]});
    if (['book_treatment_sessions','link_treatment_appointment','finalize_appointment_with_observation'].includes(name)) {
      client.invalidateQueries({queryKey:['appointments']});client.invalidateQueries({queryKey:['appointment-team-availability']});
    }
  }});
}
export function useTreatments(patientId?:string) {
  return useQuery({queryKey:['treatments',patientId],enabled:!!patientId,refetchInterval:15000,queryFn:async()=>{
    const {data,error}=await supabase.from('treatments').select('*, treatment_professionals(professional_id)').eq('patient_id',patientId!).order('created_at',{ascending:false});if(error)throw error;return data;
  }});
}
export function useTreatment(id:string) {
  return useQuery({queryKey:['treatment',id],refetchInterval:15000,queryFn:async()=>{
    const {data,error}=await supabase.from('treatments').select('*, treatment_professionals(professional_id)').eq('id',id).single();if(error)throw error;return data;
  }});
}
export function useTreatmentDirectory(query='') {
  return useQuery({queryKey:['treatment-directory',query],queryFn:async()=>{const {data,error}=await supabase.rpc('list_treatment_patient_directory',{p_query:query});if(error)throw error;return data;}});
}
