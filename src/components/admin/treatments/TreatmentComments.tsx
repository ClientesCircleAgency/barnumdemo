import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTreatmentComments } from '@/hooks/useTreatmentComments';
import { useTreatmentRpc } from '@/hooks/useTreatments';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
export type ClinicalText = {id:string;body:string;version:number;author_user_id:string;author_name:string;created_at:string};
export const treatmentError=(error:unknown)=>{
 const e=error as {code?:string;message?:string};
 if(e.code==='40001')return 'Este registo foi alterado. Atualize os dados antes de voltar a guardar. O seu texto foi conservado.';
 if(e.code==='42501')return 'Não tem permissão para esta alteração.';
 if(e.message?.includes('pending_sessions'))return 'Resolva as sessões pendentes antes de encerrar: conclua, cancele ou omita as etapas por marcar.';
 if(e.message?.includes('session_unavailable'))return 'Um horário deixou de estar disponível. Reveja as escolhas; nenhuma marcação deste lote foi criada.';
 return 'Não foi possível guardar. Verifique os dados e tente novamente.';
};
export function ClinicalTextList({items=[],canWrite,save,isPending,label,revisionKind='comment',errorLoading=false}:{items?:ClinicalText[];canWrite:boolean;save:(id:string|null,version:number|null,body:string)=>Promise<unknown>;isPending:boolean;label:string;revisionKind?:'comment'|'observation';errorLoading?:boolean}){
 const {user,isAdmin}=useAuth();const [draft,setDraft]=useState('');const [editing,setEditing]=useState<ClinicalText|null>(null);const [error,setError]=useState('');
 const [history,setHistory]=useState<{body:string;editor_name:string;created_at:string;version:number}[]|null>(null);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');try{await save(editing?.id??null,editing?.version??null,draft);setDraft('');setEditing(null);}catch(e){setError(treatmentError(e));}};
 const revisions=async(id:string)=>{setError('');const response=revisionKind==='comment'?await supabase.rpc('get_treatment_comment_revisions',{p_comment_id:id}):await supabase.rpc('get_clinical_observation_revisions',{p_observation_id:id});if(response.error){setError('Não foi possível obter o histórico.');return}setHistory(response.data);};
 return <div className="space-y-4"><h4 className="font-semibold text-sm">{label} <span className="font-normal text-muted-foreground">({items.length})</span></h4>
 {errorLoading&&<p role="alert" className="text-destructive text-sm">Não foi possível carregar os registos.</p>}
 <div className="max-h-96 overflow-auto space-y-4">{items.map(item=><article key={item.id} className="text-sm"><div className="flex flex-wrap justify-between gap-2 mb-2"><strong>{item.author_name}</strong><time className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-PT')}</time></div><p className="rounded-xl bg-secondary/50 p-3 whitespace-pre-wrap break-words">{item.body}</p><div className="flex justify-end gap-2 mt-1">{item.version>1&&<Button size="sm" variant="ghost" onClick={()=>revisions(item.id)}>Histórico · v{item.version}</Button>}{canWrite&&(isAdmin||item.author_user_id===user?.id)&&<Button size="sm" variant="ghost" onClick={()=>{setEditing({...item});setDraft(item.body);}}>Editar</Button>}</div></article>)}</div>
 {!items.length&&!errorLoading&&<p className="text-sm text-muted-foreground">Ainda não existem registos nesta consulta.</p>}
 {canWrite?<form onSubmit={submit} className="border-t pt-3 space-y-2"><Textarea aria-label={label} maxLength={20000} required value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Escrever nesta consulta…"/><div className="flex justify-between items-center"><small className="text-muted-foreground">Interno · Nunca enviado ao paciente</small><div>{editing&&<Button type="button" variant="ghost" onClick={()=>{setEditing(null);setDraft('');}}>Cancelar edição</Button>}<Button disabled={isPending||!draft.trim()}>{editing?'Guardar alteração':'Enviar'}</Button></div></div></form>:<p className="text-xs text-muted-foreground">Apenas leitura. A equipa desta consulta e o secretariado podem escrever.</p>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 <Dialog open={history!==null} onOpenChange={open=>{if(!open)setHistory(null)}}><DialogContent><DialogHeader><DialogTitle>Histórico de alterações</DialogTitle><DialogDescription>Autor original preservado. Estas são as versões anteriores e quem as substituiu.</DialogDescription></DialogHeader><div className="max-h-96 overflow-auto space-y-3">{history?.map(h=><div key={h.version} className="border rounded-lg p-3"><small>Versão {h.version} · alterada por {h.editor_name} · {new Date(h.created_at).toLocaleString('pt-PT')}</small><p className="whitespace-pre-wrap break-words">{h.body}</p></div>)}</div></DialogContent></Dialog>
 </div>;
}
export function TreatmentComments({sessionId,canWrite}:{sessionId:string;canWrite:boolean}){
 const query=useTreatmentComments(sessionId);const mutation=useTreatmentRpc('save_treatment_comment');
 return <ClinicalTextList items={query.data} errorLoading={query.isError} label="Comentários da consulta" canWrite={canWrite} isPending={mutation.isPending} save={(id,version,body)=>mutation.mutateAsync({p_id:id,p_expected_version:version,p_session_id:sessionId,p_body:body})}/>;
}
