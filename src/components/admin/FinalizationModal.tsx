import { useState } from 'react';
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
import type { ClinicAppointment } from '@/types/clinic';

interface FinalizationModalProps {
  appointment: ClinicAppointment | null;
  patientName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalize: (finalNotes: string, sendReview: boolean) => void;
}

export function FinalizationModal({
  appointment,
  patientName,
  open,
  onOpenChange,
  onFinalize,
}: FinalizationModalProps) {
  const [finalNotes, setFinalNotes] = useState('');
  const [sendReview, setSendReview] = useState(true);

  const handleFinalize = () => {
    onFinalize(finalNotes, sendReview);
    setFinalNotes('');
    setSendReview(true);
  };

  const handleClose = () => {
    setFinalNotes('');
    setSendReview(true);
    onOpenChange(false);
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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
          {/* Final Notes */}
          <div className="space-y-2">
            <Label htmlFor="final-notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notas da Consulta
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
              Estas notas ficarão no histórico da consulta (opcional)
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
                O paciente receberá mensagem WhatsApp 2h depois pedindo review da consulta
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleFinalize} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Finalizar Consulta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
