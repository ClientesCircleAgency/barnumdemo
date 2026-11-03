import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle } from 'lucide-react';
import type { AppointmentRow } from '@/types/database';

export type FinalizationRefresh = {description:string;canApply:boolean;apply:()=>void};
interface FinalizationModalProps {
  appointment: Pick<AppointmentRow, 'id' | 'final_notes' | 'send_review'> | null;
  patientName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalize: (finalNotes: string, sendReview: boolean, internalObservation?: string) => void | Promise<void>;
  includeInternalObservation?: boolean;
  onRefresh?:()=>Promise<FinalizationRefresh>;
}

export function FinalizationModal({
  appointment,
  patientName,
  open,
  onOpenChange,
  onFinalize,
  includeInternalObservation = false,
  onRefresh,
}: FinalizationModalProps) {
  const [finalNotes, setFinalNotes] = useState('');
  const [sendReview, setSendReview] = useState(true);
  const [internalObservation,setInternalObservation]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const initialized=useRef<string|null>(null);
  const [latest,setLatest]=useState<FinalizationRefresh|null>(null);
  const [refreshing,setRefreshing]=useState(false);
  const reviewLatest=async()=>{if(!onRefresh)return;setRefreshing(true);try{setLatest(await onRefresh());}catch{setError('Não foi possível consultar a versão atual. Os textos foram conservados.');}finally{setRefreshing(false);}};

  useEffect(() => {
    if (!open) { initialized.current=null; return; }
    if (appointment && initialized.current!==appointment.id) {
      initialized.current=appointment.id;
      setFinalNotes(appointment?.final_notes ?? '');
      setSendReview(appointment?.send_review ?? true);
      setInternalObservation('');setError('');setLatest(null);
    }
  }, [open, appointment?.id, appointment?.final_notes, appointment?.send_review]);

  const handleFinalize = async () => {
    if(saving)return;setSaving(true);setError('');
    try { if(includeInternalObservation) await onFinalize(finalNotes,sendReview,internalObservation); else await onFinalize(finalNotes,sendReview); }
    catch {setError('Não foi possível concluir. O texto foi conservado; atualize a consulta se foi alterada por outra pessoa.');}
    finally {setSaving(false);}
  };

  const handleClose = () => {
    if(saving)return;
    setFinalNotes('');
    setSendReview(true);
    onOpenChange(false);
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Finalizar Consulta
          </DialogTitle>
          <DialogDescription>
            Consulta com <span className="font-medium">{patientName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {includeInternalObservation&&<div className="space-y-2 rounded-xl border bg-secondary/30 p-3"><Label htmlFor="internal-observation">Observações médicas internas</Label><Textarea id="internal-observation" maxLength={20000} value={internalObservation} onChange={e=>setInternalObservation(e.target.value)} rows={4}/><p className="text-xs text-muted-foreground">Registo clínico interno. Nunca é enviado ao paciente.</p></div>}
          {/* Final Notes */}
          <div className="space-y-2">
            <Label htmlFor="final-notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notas para o paciente
            </Label>
            <Textarea
              id="final-notes"
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
              placeholder="Resumo da consulta, observações, prescrição, próximos passos, etc."
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Texto destinado ao WhatsApp do paciente. Estas notas são incluídas na mensagem de conclusão, mesmo sem pedido de avaliação. Não inclua observações clínicas internas.
            </p>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
            <Checkbox
              id="send-review"
              checked={sendReview}
              onCheckedChange={(checked) => setSendReview(checked === true)}
            />
            <div className="space-y-1">
              <Label
                htmlFor="send-review"
                className="text-sm font-medium cursor-pointer"
              >
                Enviar link de review
              </Label>
              <p className="text-xs text-muted-foreground">
                Pedido de avaliação previsto por WhatsApp 2 a 3 horas após a primeira conclusão. Esta opção não confirma a entrega.
              </p>
            </div>
          </div>
        </div>

        {error&&<div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p>{onRefresh&&<Button variant="outline" disabled={refreshing||saving} onClick={reviewLatest}>Rever consulta atualizada</Button>}</div>}
        {latest&&<div className="space-y-3 rounded-lg border p-3"><p className="whitespace-pre-wrap text-sm">{latest.description}</p>{latest.canApply?<Button variant="outline" onClick={()=>{latest.apply();setLatest(null);setError('');}}>Usar versão atual e manter os textos</Button>:<p className="text-sm text-muted-foreground">A consulta já não pode ser concluída neste estado. Os textos mantêm-se disponíveis para copiar.</p>}</div>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={handleClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={handleFinalize} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Finalizar Consulta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
