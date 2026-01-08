import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  X,
  User,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Phone,
  Mail,
  Edit,
  Trash2,
  Bell,
  UserX,
  CheckCircle,
  PlayCircle,
  Pause,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClinic } from '@/context/ClinicContext';
import { StatusBadge } from './StatusBadge';
import { useToast } from '@/hooks/use-toast';
import type { ClinicAppointment, AppointmentStatus } from '@/types/clinic';
import { appointmentStatusLabels } from '@/types/clinic';

interface AppointmentDetailDrawerProps {
  appointment: ClinicAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (appointment: ClinicAppointment) => void;
}

export function AppointmentDetailDrawer({
  appointment,
  open,
  onOpenChange,
  onEdit,
}: AppointmentDetailDrawerProps) {
  const { toast } = useToast();
  const {
    getPatientById,
    getProfessionalById,
    getConsultationTypeById,
    getSpecialtyById,
    updateAppointmentStatus,
    deleteAppointment,
    rooms,
  } = useClinic();

  if (!appointment) return null;

  const patient = getPatientById(appointment.patientId);
  const professional = getProfessionalById(appointment.professionalId);
  const consultationType = getConsultationTypeById(appointment.consultationTypeId);
  const specialty = getSpecialtyById(appointment.specialtyId);
  const room = rooms.find((r) => r.id === appointment.roomId);

  const handleStatusChange = (newStatus: AppointmentStatus) => {
    updateAppointmentStatus(appointment.id, newStatus);
    toast({
      title: 'Estado atualizado',
      description: `Consulta marcada como "${appointmentStatusLabels[newStatus]}"`,
    });
  };

  const handleQuickAction = (action: 'cancel' | 'no_show' | 'complete' | 'start' | 'waiting') => {
    const statusMap: Record<string, AppointmentStatus> = {
      cancel: 'cancelled',
      no_show: 'no_show',
      complete: 'completed',
      start: 'in_progress',
      waiting: 'waiting',
    };
    handleStatusChange(statusMap[action]);
  };

  const handleDelete = () => {
    deleteAppointment(appointment.id);
    onOpenChange(false);
    toast({
      title: 'Consulta eliminada',
      description: 'A consulta foi removida do sistema.',
    });
  };

  const handleSendReminder = () => {
    toast({
      title: 'Lembrete enviado',
      description: 'O paciente foi notificado por SMS/Email.',
    });
  };

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
              {room && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sala</span>
                  <span className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {room.name}
                  </span>
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

          <Separator />

          {/* Alterar estado */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Alterar Estado</h4>
            <Select value={appointment.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {Object.entries(appointmentStatusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ações rápidas */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Ações Rápidas</h4>
            <div className="grid grid-cols-2 gap-2">
              {appointment.status === 'scheduled' && (
                <Button variant="outline" size="sm" onClick={() => handleQuickAction('waiting')} className="gap-1">
                  <Pause className="h-3 w-3" />
                  Check-in
                </Button>
              )}
              {appointment.status === 'confirmed' && (
                <Button variant="outline" size="sm" onClick={() => handleQuickAction('waiting')} className="gap-1">
                  <Pause className="h-3 w-3" />
                  Check-in
                </Button>
              )}
              {appointment.status === 'waiting' && (
                <Button variant="outline" size="sm" onClick={() => handleQuickAction('start')} className="gap-1">
                  <PlayCircle className="h-3 w-3" />
                  Iniciar
                </Button>
              )}
              {appointment.status === 'in_progress' && (
                <Button variant="outline" size="sm" onClick={() => handleQuickAction('complete')} className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Concluir
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSendReminder} className="gap-1">
                <Bell className="h-3 w-3" />
                Lembrete
              </Button>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(appointment)} className="gap-1">
                  <Edit className="h-3 w-3" />
                  Editar
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Ações destrutivas */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
              onClick={() => handleQuickAction('no_show')}
            >
              <UserX className="h-4 w-4 mr-2" />
              Marcar como Não Compareceu
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => handleQuickAction('cancel')}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar Consulta
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar Definitivamente
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
