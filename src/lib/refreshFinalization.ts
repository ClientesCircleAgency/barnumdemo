import {supabase} from '@/integrations/supabase/client';
import type {AppointmentRow} from '@/types/database';
import type {FinalizationRefresh} from '@/components/admin/FinalizationModal';
import {appointmentStatusLabels} from '@/types/clinic';
export async function refreshFinalization(id:string,adopt:(row:AppointmentRow)=>void):Promise<FinalizationRefresh>{
 const {data,error}=await supabase.from('appointments').select('*').eq('id',id).single();if(error)throw error;
 return {description:`Estado: ${appointmentStatusLabels[data.status]??data.status}\nData: ${data.date} · ${data.time.slice(0,5)}\nNotas para o paciente: ${data.final_notes||'Sem notas'}\nAvaliação: ${data.send_review?'autorizada':'desativada'}`,canApply:['confirmed','waiting','in_progress'].includes(data.status),apply:()=>adopt(data)};
}
