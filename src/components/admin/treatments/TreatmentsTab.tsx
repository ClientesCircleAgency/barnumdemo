import {useState} from 'react';
import {Plus,ArrowUpRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {useAuth} from '@/hooks/useAuth';
import {useTreatments} from '@/hooks/useTreatments';
import {useProfessionals} from '@/hooks/useProfessionals';
import {AppointmentTeamList} from '../AppointmentTeamList';
import {TreatmentEditor} from './TreatmentEditor';
import {TreatmentDetail,treatmentLabels} from './TreatmentDetail';
export function TreatmentsTab({patientId,initialTreatmentId}:{patientId:string;initialTreatmentId?:string|null}){
 const query=useTreatments(patientId),{isAdmin,isSecretary}=useAuth(),{data:professionals=[]}=useProfessionals();const [selected,setSelected]=useState<string|null>(initialTreatmentId??null),[creating,setCreating]=useState(false);
 if(selected)return <TreatmentDetail key={selected} treatmentId={selected} onBack={()=>setSelected(null)}/>;
 return <section className="space-y-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Tratamentos</h2><p className="text-sm text-muted-foreground">Planeamento, consultas e evolução clínica.</p></div>{(isAdmin||isSecretary)&&<Button className="gap-2" onClick={()=>setCreating(true)}><Plus size={16}/>Novo tratamento</Button>}</div>{query.isLoading?<p>A carregar tratamentos…</p>:query.isError?<div role="alert">Não foi possível carregar os tratamentos. <Button variant="link" onClick={()=>query.refetch()}>Tentar novamente</Button></div>:!query.data?.length?<p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Este paciente ainda não tem tratamentos.</p>:<div className="grid gap-4 md:grid-cols-2">{query.data.map(t=><button key={t.id} onClick={()=>setSelected(t.id)} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline focus-visible:outline-primary"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold">{t.name}</h3><ArrowUpRight size={18}/></div><Badge className="my-3" variant="secondary">{treatmentLabels[t.status]}</Badge>{t.objective&&<p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{t.objective}</p>}<AppointmentTeamList appointment={{professionalId:t.primary_professional_id,additionalProfessionalIds:t.treatment_professionals.map(p=>p.professional_id).filter(id=>id!==t.primary_professional_id)}} getProfessional={id=>professionals.find(p=>p.id===id)}/></button>)}</div>}<Dialog open={creating} onOpenChange={setCreating}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Novo tratamento</DialogTitle><DialogDescription>Organize o objetivo e a equipa. As consultas são planeadas no passo seguinte.</DialogDescription></DialogHeader><TreatmentEditor patientId={patientId} onSaved={id=>{setCreating(false);setSelected(id);}} onCancel={()=>setCreating(false)}/></DialogContent></Dialog></section>;
}
