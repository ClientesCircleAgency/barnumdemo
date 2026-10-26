import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, addMonths, endOfMonth, format, isBefore, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppointmentProfessionalsField } from './AppointmentProfessionalsField';
import { AppointmentTeamList } from './AppointmentTeamList';
import { useProfessionals } from '@/hooks/useProfessionals';
import { useProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';
import { useProfessionalServicePreferences } from '@/hooks/useProfessionalServicePreferences';
import { useClinicSchedule } from '@/hooks/useClinicSchedule';
import { professionalSupportsService } from '@/utils/professionalServicePreferences';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class SlotSubmitError extends Error {}
export interface SlotSelection {
  date: string; time: string; professional_id: string; professional_name: string;
  additional_professional_ids: string[]; consultation_type_id?: string; duration?: number;
}
export interface SuggestSlotsSource {
  appointment_id: string; name: string; specialty_id: string; consultation_type_id?: string;
  preferred_date: string; preferred_time: string; duration_minutes: number;
  professional_id?: string; additional_professional_ids?: string[];
}
interface Props {
  open: boolean; onOpenChange: (open: boolean) => void; source: SuggestSlotsSource | null;
  onSubmit: (slots: SlotSelection[]) => Promise<void>; title?: string; submitLabel?: string; singleSelect?: boolean;
}
const minutes = (time: string) => { const [h,m]=time.split(':').map(Number); return h*60+m; };

export function SuggestAlternativesModal({open,onOpenChange,source,onSubmit,title='Sugerir Horários Alternativos',submitLabel='Enviar Sugestões',singleSelect=false}: Props) {
  const {data:professionals=[]}=useProfessionals();
  const {data:links=[]}=useProfessionalSpecialties();
  const {data:preferences=[]}=useProfessionalServicePreferences();
  const {getTimeSlotsForDate}=useClinicSchedule();
  const [primary,setPrimary]=useState('');
  const [additional,setAdditional]=useState<string[]>([]);
  const [date,setDate]=useState(startOfDay(new Date()));
  const [month,setMonth]=useState(startOfMonth(new Date()));
  const [slots,setSlots]=useState<SlotSelection[]>([]);
  const [sending,setSending]=useState(false);
  const initialized=useRef<string|null>(null);
  const eligible=professionals.filter(p=>p.is_active!==false && !!source &&
    (p.specialty_id===source.specialty_id || links.some(l=>l.professional_id===p.id && l.specialty_id===source.specialty_id)) &&
    professionalSupportsService(p,preferences,source.specialty_id,source.consultation_type_id));
  useEffect(()=>{
    if(!open){initialized.current=null;return;}
    if(!source || initialized.current===source.appointment_id || !professionals.length) return;
    initialized.current=source.appointment_id;
    const preferred=startOfDay(parseISO(source.preferred_date));
    const next=isBefore(preferred,startOfDay(new Date()))?startOfDay(new Date()):preferred;
    setPrimary(source.professional_id || eligible.find(p=>!source.additional_professional_ids?.includes(p.id))?.id || '');
    setAdditional(source.additional_professional_ids??[]);setSlots([]);setDate(next);setMonth(startOfMonth(next));
  },[open,source,professionals,eligible]);
  const duration=source?.duration_minutes || 30;
  const dateKey=format(date,'yyyy-MM-dd');
  const team={professionalId:primary,additionalProfessionalIds:additional};
  const ids=[primary,...additional];
  const validTeam=ids.every(id=>eligible.some(p=>p.id===id)) && new Set(ids).size===ids.length;
  const lookup=(id:string)=>professionals.find(p=>p.id===id);
  const configured=getTimeSlotsForDate(date,30);
  const end=minutes(configured.at(-1) || '00:00')+30;
  const candidates=configured.filter(time=>minutes(time)+duration<=end &&
    (dateKey!==format(new Date(),'yyyy-MM-dd') || minutes(time)>new Date().getHours()*60+new Date().getMinutes()));
  const availability=useQuery({
    queryKey:['appointment-team-availability','suggestions',source?.appointment_id,source?.specialty_id,source?.consultation_type_id,dateKey,duration,candidates.join(',')],
    enabled:open && !!source && validTeam,
    queryFn:async()=>Promise.all(candidates.map(async time=>{
      const {data,error}=await supabase.rpc('get_appointment_team_availability',{
        p_specialty_id:source!.specialty_id,p_consultation_type_id:source!.consultation_type_id??null,
        p_date:dateKey,p_time:time,p_duration:duration,p_exclude_appointment_id:source!.appointment_id,
      });
      if(error) throw error;
      return {time,ids:data.filter(p=>p.available).map(p=>p.professional_id)};
    })),
  });
  const times=validTeam && !availability.isFetching && !availability.isError
    ? (availability.data??[]).filter(slot=>ids.every(id=>slot.ids.includes(id))).map(slot=>slot.time) : [];
  function changeTeam(next:string,extras:string[]) {setPrimary(next);setAdditional(extras);setSlots([]);}
  function toggle(time:string) {
    if(!times.includes(time)) return;
    const exists=slots.some(s=>s.date===dateKey && s.time===time);
    const slot:SlotSelection={date:dateKey,time,professional_id:primary,professional_name:lookup(primary)?.name??'',additional_professional_ids:[...additional],consultation_type_id:source?.consultation_type_id,duration};
    setSlots(exists?slots.filter(s=>s.date!==dateKey || s.time!==time):singleSelect?[slot]:[...slots,slot]);
  }
  async function send() {
    if(!source || !validTeam || !slots.length) return;
    setSending(true);
    try {
      for(const slot of slots){
        const {data,error}=await supabase.rpc('get_appointment_team_availability',{
          p_specialty_id:source.specialty_id,p_consultation_type_id:source.consultation_type_id??null,
          p_date:slot.date,p_time:slot.time,p_duration:duration,p_exclude_appointment_id:source.appointment_id,
        });
        if(error || [slot.professional_id,...slot.additional_professional_ids].some(id=>!data?.some(p=>p.professional_id===id && p.available)))
          throw new SlotSubmitError('A disponibilidade da equipa mudou. Reveja os horários selecionados.');
      }
      await onSubmit(slots);onOpenChange(false);setSlots([]);
    }catch(error){toast.error(error instanceof SlotSubmitError?error.message:'Não foi possível verificar os horários. Tente novamente.');}
    finally{setSending(false);}
  }
  const first=startOfMonth(month), offset=(first.getDay()+6)%7;
  const days=Array.from({length:Math.ceil((offset+endOfMonth(month).getDate())/7)*7},(_,i)=>addDays(first,i-offset));
  if(!source) return null;
  return <Dialog open={open} onOpenChange={value=>{if(!sending)onOpenChange(value);}}>
    <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden bg-[#f4f8fb] p-0">
      <DialogHeader className="border-b bg-white px-6 py-5">
        <DialogTitle className="flex items-center gap-2 text-xl"><Users className="h-5 w-5 text-primary"/>{title}</DialogTitle>
        <DialogDescription>{source.name} · Consulta de {duration} minutos</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <section className="space-y-3">
          <h3 className="font-semibold">1. Equipa da consulta</h3>
          <div className="grid gap-5 rounded-2xl border bg-white p-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label htmlFor="team-primary" className="text-sm font-medium">Profissional principal</label>
              <select id="team-primary" value={primary} disabled={sending} className="h-11 w-full rounded-xl border bg-background px-3" onChange={e=>changeTeam(e.target.value,additional.filter(id=>id!==e.target.value))}>
                <option value="">Selecionar profissional</option>
                {professionals.filter(p=>eligible.includes(p)||p.id===primary).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <AppointmentProfessionalsField showSummary={false} primaryProfessionalId={primary} value={additional} onChange={extra=>changeTeam(primary,extra)} professionals={professionals} availableIds={eligible.map(p=>p.id)} disabled={sending}/>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Participam durante toda a consulta</p>
              <AppointmentTeamList appointment={team} getProfessional={lookup} className="text-sm font-medium"/>
              <p className="mt-4 text-xs text-muted-foreground">Os horários apresentados são comuns a todos. Alterar a equipa limpa as seleções anteriores.</p>
            </div>
          </div>
          {!validTeam && <p role="alert" className="text-sm text-destructive">Selecione profissionais elegíveis, sem repetir membros da equipa.</p>}
        </section>
        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between"><div><h3 className="font-semibold">2. Data</h3><p className="capitalize">{format(month,'MMMM yyyy',{locale:pt})}</p></div><div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={()=>setMonth(addMonths(month,-1))}><ChevronLeft className="h-4 w-4"/></Button>
              <Button variant="ghost" size="icon" aria-label="Mês seguinte" onClick={()=>setMonth(addMonths(month,1))}><ChevronRight className="h-4 w-4"/></Button>
            </div></div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(d=><span key={d} className="py-2 text-[10px] text-muted-foreground">{d}</span>)}
              {days.map(day=>{const key=format(day,'yyyy-MM-dd');return <button key={key} type="button" aria-label={format(day,'d MMMM yyyy',{locale:pt})} aria-pressed={key===dateKey} disabled={sending || day.getMonth()!==month.getMonth() || isBefore(day,startOfDay(new Date()))}
                onClick={()=>setDate(day)} className={`aspect-square rounded-xl border text-sm disabled:opacity-25 ${key===dateKey?'border-primary bg-primary text-primary-foreground':'hover:bg-secondary'}`}>{day.getDate()}</button>;})}
            </div>
            <p className="text-xs text-muted-foreground">Escolha um dia para consultar a disponibilidade conjunta.</p>
          </div>
          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <div><h3 className="font-semibold">3. Horários da equipa</h3><p className="text-sm text-muted-foreground">{format(date,"d 'de' MMMM",{locale:pt})} · {duration} min</p></div>
            {availability.isFetching ? <p role="status" className="py-6 text-sm text-muted-foreground">A verificar todos os profissionais…</p> : availability.isError ? <div role="alert"><p>Não foi possível consultar a disponibilidade.</p><Button variant="outline" onClick={()=>availability.refetch()}>Tentar novamente</Button></div> : times.length===0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Sem disponibilidade conjunta. Escolha outra data ou ajuste a equipa.</p> : <div className="grid grid-cols-3 gap-2">{times.map(time=><button key={time} type="button" disabled={sending} aria-pressed={slots.some(s=>s.date===dateKey&&s.time===time)} onClick={()=>toggle(time)} className={`flex items-center justify-center gap-1 rounded-xl border py-3 text-sm font-medium ${slots.some(s=>s.date===dateKey&&s.time===time)?'border-primary bg-primary text-primary-foreground':'hover:border-primary'}`}><Clock className="h-3.5 w-3.5"/>{time}</button>)}</div>}
          </div>
        </section>
        {slots.length>0 && <section className="space-y-3 rounded-2xl border bg-white p-4"><h3 className="font-semibold">Horários selecionados ({slots.length})</h3><div className="grid gap-3 sm:grid-cols-2">{slots.map(slot=><div key={`${slot.date}-${slot.time}`} className="rounded-xl border bg-secondary/30 p-3"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm font-semibold">{format(parseISO(slot.date),'dd/MM')} · {slot.time}</span><Button variant="ghost" size="sm" disabled={sending} aria-label={`Remover ${slot.date} ${slot.time}`} onClick={()=>setSlots(slots.filter(s=>s!==slot))}>Remover</Button></div><AppointmentTeamList appointment={slot} getProfessional={lookup} className="text-sm"/></div>)}</div></section>}
      </div>
      <DialogFooter className="border-t bg-white px-6 py-4"><Button variant="outline" disabled={sending} onClick={()=>onOpenChange(false)}>Cancelar</Button><Button disabled={!validTeam||!slots.length||sending||availability.isFetching||availability.isError} onClick={send}>{sending?'A verificar…':`${submitLabel}${slots.length?` (${slots.length})`:''}`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
