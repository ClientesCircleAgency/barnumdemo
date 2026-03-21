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
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useClinic } from '@/context/ClinicContext';
import { StatusBadge } from './StatusBadge';
import type { ClinicAppointment } from '@/types/clinic';

interface AppointmentDetailDrawerProps {
  appointment: ClinicAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

  if (!appointment) return null;

  const patient = getPatientById(appointment.patientId);
  const professional = getProfessionalById(appointment.professionalId);
  const consultationType = getConsultationTypeById(appointment.consultationTypeId);
  const specialty = getSpecialtyById(appointment.specialtyId);

  return (
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

          {/* Notas */}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
