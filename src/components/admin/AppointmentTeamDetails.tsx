import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClinic } from '@/context/ClinicContext';
import { useUpdateAppointment } from '@/hooks/useAppointments';
import { useAppointmentTeamAvailability } from '@/hooks/useAppointmentTeamAvailability';
import { AppointmentProfessionalsField } from './AppointmentProfessionalsField';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ClinicAppointment } from '@/types/clinic';
import { toast } from 'sonner';

export function AppointmentTeamDetails({ appointment }: { appointment: ClinicAppointment }) {
  const { user,isAdmin,isSecretary } = useAuth();
  const { professionals } = useClinic();
  const client=useQueryClient();
  const update=useUpdateAppointment();
  const [edit,setEdit]=useState<{primary:string;additional:string[];version:number}|null>(null);
  const [note,setNote]=useState('');
  const [saving,setSaving]=useState(false);
  const availability=useAppointmentTeamAvailability({specialtyId:appointment.specialtyId,consultationTypeId:appointment.consultationTypeId,
    date:appointment.date,time:appointment.time,duration:appointment.duration,excludeAppointmentId:appointment.id,enabled:!!edit});
  const ids=(availability.data??[]).filter(p=>p.available).map(p=>p.professional_id);
  const notes=useQuery({queryKey:['appointment-notes',appointment.id],queryFn:async()=>{
    const [{data,error},{data:profiles,error:profileError}]=await Promise.all([
      supabase.from('appointment_notes').select('*').eq('appointment_id',appointment.id).order('created_at'),
      supabase.from('user_profiles').select('user_id,full_name'),
    ]);
    if(error || profileError) throw error || profileError;
    return (data??[]).map(n=>({...n,author:profiles?.find(p=>p.user_id===n.author_user_id)?.full_name ?? 'Profissional'}));
  }});
  useEffect(()=>{
    const channel=supabase.channel(`appointment-notes-${appointment.id}`).on('postgres_changes',{event:'*',schema:'public',table:'appointment_notes',filter:`appointment_id=eq.${appointment.id}`},()=>client.invalidateQueries({queryKey:['appointment-notes',appointment.id]})).subscribe(status=>{
      if(status==='SUBSCRIBED') client.invalidateQueries({queryKey:['appointment-notes',appointment.id]});
    });
    return ()=>{void supabase.removeChannel(channel);};
  },[appointment.id,client]);
  const saveTeam=async()=>{
    if(!edit) return;
    try {
      await update.mutateAsync({id:appointment.id,expectedVersion:edit.version,data:{professional_id:edit.primary},additionalProfessionalIds:edit.additional});
      setEdit(null);toast.success('Profissionais atualizados');
    } catch {toast.error('Não foi possível alterar a equipa. Verifique a disponibilidade e atualize a consulta.');}
  };
  const addNote=async()=>{
    if(!user || !note.trim()) return;
    setSaving(true);
    try {
      const {error}=await supabase.from('appointment_notes').insert({appointment_id:appointment.id,author_user_id:user.id,note:note.trim()});
      if(error) throw error;
      setNote('');await client.invalidateQueries({queryKey:['appointment-notes',appointment.id]});
    } catch {toast.error('Não foi possível guardar a nota.');} finally {setSaving(false);}
  };
  return <section className="space-y-4">
    {(isAdmin||isSecretary) && !['completed','cancelled','no_show'].includes(appointment.status) && !edit &&
      <Button variant="outline" onClick={()=>setEdit({primary:appointment.professionalId,additional:appointment.additionalProfessionalIds??[],version:appointment.version!})}>Alterar profissionais</Button>}
    {edit && <div className="space-y-3 rounded-lg border p-3">
      <label className="text-sm">Médico principal<select aria-label="Médico principal" className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={edit.primary} onChange={e=>setEdit({...edit,primary:e.target.value})}>
        {professionals.filter(p=>ids.includes(p.id)||p.id===edit.primary).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <AppointmentProfessionalsField primaryProfessionalId={edit.primary} value={edit.additional} onChange={additional=>setEdit({...edit,additional})} professionals={professionals} availableIds={ids} />
      <Button onClick={saveTeam} disabled={update.isPending || availability.isFetching || availability.isError || !availability.data || [edit.primary,...edit.additional].some(id=>!ids.includes(id)) || edit.additional.includes(edit.primary)}>Guardar profissionais</Button>
      <Button variant="ghost" onClick={()=>setEdit(null)}>Voltar</Button>
    </div>}
    <h4 className="text-sm font-medium">Notas da consulta</h4>
    {notes.isError && <p role="alert">Não foi possível carregar as notas.</p>}
    {notes.data?.map(n=><article key={n.id} className="rounded-lg border p-3 text-sm"><p className="whitespace-pre-wrap">{n.note}</p><p className="mt-2 text-xs text-muted-foreground">{n.author} · {new Date(n.created_at).toLocaleString('pt-PT',{timeZone:'Europe/Lisbon'})}</p></article>)}
    <Textarea aria-label="Nova nota da consulta" value={note} onChange={e=>setNote(e.target.value)} placeholder="Acrescentar uma nota..." />
    <Button disabled={saving||!note.trim()} onClick={addNote}>Guardar nota</Button>
  </section>;
}
