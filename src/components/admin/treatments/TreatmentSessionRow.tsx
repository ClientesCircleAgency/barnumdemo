import { CalendarDays, Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProfessionals } from '@/hooks/useProfessionals';
import type { TreatmentSessionView } from '@/hooks/useTreatmentSessions';
import { AppointmentTeamList } from '../AppointmentTeamList';
import { TreatmentComments } from './TreatmentComments';
import { ClinicalObservations } from './ClinicalObservations';

const labels:Record<string,string>={confirmed:'Marcada',waiting:'Na sala de espera',in_progress:'Em atendimento',completed:'Concluída',cancelled:'Cancelada',no_show:'Falta'};
export function TreatmentSessionRow({session,manager,onBook,onEdit,onOpen,onOmit,onLink}:{session:TreatmentSessionView;manager:boolean;onBook:()=>void;onEdit:()=>void;onOpen?:()=>void;onOmit?:()=>void;onLink?:()=>void}) {
 const {data:professionals=[]}=useProfessionals();
 const {session:s,appointment:a}=session;
 const omitted=s.disposition==='omitted';
 const complete=a?.status==='completed';
 return <article aria-label={s.name} className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-2">
  <section className="space-y-4 p-5 lg:p-6">
   <div className="flex items-start justify-between gap-3">
    <div className="flex gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${complete?'bg-emerald-50 text-emerald-700':'bg-primary/10 text-primary'}`}>{complete?<Check size={18}/>:s.ordinal}</span><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{s.kind==='surgery'?'Cirurgia':'Consulta'} · {a?.duration??s.duration} min</p><h3 className="mt-1 text-lg font-semibold">{s.name}</h3></div></div>
    <Badge variant="secondary">{omitted?'Omitida':a?labels[a.status]??a.status:'Por marcar'}</Badge>
   </div>
   {a?<p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays size={16}/>{new Date(a.date+'T12:00:00').toLocaleDateString('pt-PT',{day:'numeric',month:'long',year:'numeric'})} · {a.time.slice(0,5)}</p>:<p className="flex items-center gap-2 text-sm text-muted-foreground"><Circle size={14}/>{omitted?s.omission_reason:'A data será escolhida com base na disponibilidade da equipa.'}</p>}
   <AppointmentTeamList appointment={{professionalId:a?.professional_id??s.primary_professional_id,additionalProfessionalIds:a?.additional_professional_ids??session.additional_professional_ids}} getProfessional={id=>professionals.find(p=>p.id===id)} className="text-sm"/>
   <div className="flex flex-wrap gap-2">{a&&onOpen&&<Button variant="outline" onClick={onOpen}>Abrir consulta</Button>}{manager&&!a&&!omitted&&<><Button onClick={onBook}>Marcar consulta</Button><Button variant="outline" onClick={onEdit}>Editar etapa</Button>{onLink&&<Button variant="ghost" onClick={onLink}>Ligar consulta existente</Button>}{onOmit&&<Button variant="ghost" onClick={onOmit}>Omitir etapa</Button>}</>}</div>
   {a&&<details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Observações médicas internas</summary><div className="pt-4"><ClinicalObservations appointmentId={a.id} canWrite={session.can_write}/></div></details>}
  </section>
  <section className="border-t bg-secondary/20 p-5 lg:border-l lg:border-t-0 lg:p-6"><TreatmentComments sessionId={s.id} canWrite={session.can_write}/></section>
 </article>;
}
