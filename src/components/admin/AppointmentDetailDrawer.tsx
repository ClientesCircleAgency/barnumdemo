import { useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  User,
  Calendar,
  Clock,
  FileText,
  Phone,
  Mail,
  ClipboardCheck,
  Star,
  X,
  CalendarClock,
  UserX,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useClinic } from '@/context/ClinicContext';
import { useUpdateAppointment, useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { SuggestAlternativesModal } from './SuggestAlternativesModal';
import type { SlotSelection } from './SuggestAlternativesModal';
import { StatusBadge } from './StatusBadge';
import { toast } from 'sonner';
import type { ClinicAppointment } from '@/types/clinic';

interface AppointmentDetailDrawerProps {
  appointment: ClinicAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ActionType = 'cancel' | 'no_show' | null;

export function AppointmentDetailDrawer({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailDrawerProps) {
  const {
    getPatientById,
    getProfessionalById,
    getConsultationTypeById,
    getSpecialtyById,
  } = useClinic();

  const updateAppointment = useUpdateAppointment();
  const updateStatus = useUpdateAppointmentStatus();

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [reason, setReason] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);

  if (!appointment) return null;

  const patient = getPatientById(appointment.patientId);
  const professional = getProfessionalById(appointment.professionalId);
  const consultationType = getConsultationTypeById(appointment.consultationTypeId);
  const specialty = getSpecialtyById(appointment.specialtyId);

  const isTerminal = ['cancelled', 'completed', 'no_show'].includes(appointment.status);

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast.error('Por favor indique o motivo do cancelamento');
      return;
    }

    try {
      await updateAppointment.mutateAsync({
        id: appointment.id,
        data: { status: 'cancelled', cancellation_reason: reason.trim() },
      });
      toast.success('Consulta cancelada');
      setActiveAction(null);
      setReason('');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao cancelar consulta');
    }
  };

  const handleNoShow = async () => {
    try {
      await updateStatus.mutateAsync({
        id: appointment.id,
        status: 'no_show',
      });
      toast.success('Consulta marcada como não compareceu');
      setActiveAction(null);
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar consulta');
    }
  };

  const handleReschedule = () => {
    setShowReschedule(true);
  };

  const handleRescheduleSubmit = async (slots: SlotSelection[]) => {
    const slot = slots[0];
    if (!slot) return;

    await updateAppointment.mutateAsync({
      id: appointment.id,
      data: {
        date: slot.date,
        time: slot.time,
        professional_id: slot.professional_id,
        professional_name: slot.professional_name,
        status: 'confirmed',
      },
    });
    toast.success('Consulta reagendada com sucesso');
    setShowReschedule(false);
    onOpenChange(false);
  };

  const closeAction = () => {
    setActiveAction(null);
    setReason('');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <SheetTitle>Detalhes da Consulta</SheetTitle>
              <StatusBadge status={appointment.status} />
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Info do paciente */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Paciente
              </h4>
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <p className="font-semibold text-lg">{patient?.name || 'Desconhecido'}</p>
                <p className="text-sm text-muted-foreground">NIF: {patient?.nif}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {patient?.phone}
                  </span>
                  {patient?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {patient.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Detalhes da consulta */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Marcação
              </h4>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Data</span>
                  <span className="font-medium">
                    {format(new Date(appointment.date), "EEEE, d 'de' MMMM", { locale: pt })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hora</span>
                  <span className="font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {appointment.time} ({appointment.duration} min)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <span className="font-medium">{consultationType?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Profissional</span>
                  <span className="font-medium flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: professional?.color }} />
                    {professional?.name}
                  </span>
                </div>
                {specialty && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Especialidade</span>
                    <span className="font-medium">{specialty.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Motivo da consulta (reason from booking form) */}
            {appointment.reason && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Motivo da Consulta
                  </h4>
                  <p className="text-sm p-3 bg-muted/50 rounded-lg">{appointment.reason}</p>
                </div>
              </>
            )}

            {/* Observações internas */}
            {appointment.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Observações
                  </h4>
                  <p className="text-sm p-3 bg-muted/50 rounded-lg">{appointment.notes}</p>
                </div>
              </>
            )}

            {/* Finalization details */}
            {appointment.finalizedAt && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Finalização
                  </h4>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Finalizada em</span>
                      <span className="font-medium">
                        {format(new Date(appointment.finalizedAt), "d MMM yyyy, HH:mm", { locale: pt })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Review
                      </span>
                      <span className={`text-sm font-medium ${appointment.sendReview ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {appointment.sendReview ? 'Enviado ao paciente' : 'Não enviado'}
                      </span>
                    </div>
                  </div>
                  {appointment.finalNotes && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-muted-foreground">Notas Finais</h5>
                      <p className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">{appointment.finalNotes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Cancellation reason */}
            {appointment.status === 'cancelled' && appointment.cancellationReason && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Motivo do Cancelamento</h4>
                  <p className="text-sm p-3 bg-red-50 rounded-lg text-red-700">{appointment.cancellationReason}</p>
                </div>
              </>
            )}

            {/* Action buttons — only for active appointments */}
            {!isTerminal && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Ações</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
                      onClick={() => setActiveAction('cancel')}
                    >
                      <X className="h-4 w-4" />
                      <span className="text-xs font-medium">Cancelar</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-50 hover:border-amber-500/50"
                      onClick={handleReschedule}
                    >
                      <CalendarClock className="h-4 w-4" />
                      <span className="text-xs font-medium">Reagendar</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 gap-1.5 text-orange-600 border-orange-500/30 hover:bg-orange-50 hover:border-orange-500/50"
                      onClick={() => setActiveAction('no_show')}
                    >
                      <UserX className="h-4 w-4" />
                      <span className="text-xs font-medium">No-Show</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel confirmation dialog */}
      <Dialog open={activeAction === 'cancel'} onOpenChange={() => closeAction()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Cancelar Consulta</DialogTitle>
            <DialogDescription>
              Esta ação irá cancelar a consulta e notificar o paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-reason">
              Motivo do Cancelamento <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Profissional indisponível, paciente pediu cancelamento..."
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!reason.trim() || updateAppointment.isPending}
            >
              {updateAppointment.isPending ? 'A cancelar...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-Show confirmation dialog */}
      <Dialog open={activeAction === 'no_show'} onOpenChange={() => closeAction()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Não Compareceu</DialogTitle>
            <DialogDescription>
              O paciente não compareceu à consulta. Esta ação irá atualizar o estado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>
              Voltar
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleNoShow}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? 'A atualizar...' : 'Confirmar No-Show'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule modal */}
      <SuggestAlternativesModal
        open={showReschedule}
        onOpenChange={setShowReschedule}
        source={appointment ? {
          name: patient?.name || 'Paciente',
          specialty_id: appointment.specialtyId,
          preferred_date: appointment.date,
          preferred_time: appointment.time,
        } : null}
        onSubmit={handleRescheduleSubmit}
        title="Reagendar Consulta"
        submitLabel="Confirmar Reagendamento"
        singleSelect
      />
    </>
  );
}
