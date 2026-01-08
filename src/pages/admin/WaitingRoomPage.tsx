import { useState, forwardRef } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { CheckCircle, Clock, Stethoscope, UserCheck, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/admin/PageHeader';
import { WaitingRoomCard } from '@/components/admin/WaitingRoomCard';
import { useAppointments, useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { useProfessionals } from '@/hooks/useProfessionals';
import { useConsultationTypes } from '@/hooks/useConsultationTypes';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import type { AppointmentRow, AppointmentStatus } from '@/types/database';
import { cn } from '@/lib/utils';

const columns = [
  {
    id: 'confirmed' as AppointmentStatus,
    title: 'Confirmadas',
    dotColor: 'bg-primary',
    bgColor: 'bg-card',
    borderColor: 'border-border',
    emptyIcon: CheckCircle,
    emptyIconColor: 'text-primary',
    emptyIconBg: 'bg-primary/10',
    emptyTitle: 'Sem consultas confirmadas',
    emptyDescription: 'para chegar.',
  },
  {
    id: 'waiting' as AppointmentStatus,
    title: 'Em Sala de Espera',
    dotColor: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    emptyIcon: Clock,
    emptyIconColor: 'text-yellow-600',
    emptyIconBg: 'bg-yellow-100',
    emptyTitle: 'Sala de espera vazia.',
    emptyDescription: 'Excelente fluxo!',
    showDropZone: true,
  },
  {
    id: 'in_progress' as AppointmentStatus,
    title: 'Em Atendimento',
    dotColor: 'bg-orange-500',
    bgColor: 'bg-card',
    borderColor: 'border-border',
    emptyIcon: Stethoscope,
    emptyIconColor: 'text-orange-600',
    emptyIconBg: 'bg-orange-100',
    emptyTitle: 'Nenhum paciente',
    emptyDescription: 'no consultório.',
  },
  {
    id: 'completed' as AppointmentStatus,
    title: 'Concluídas',
    dotColor: 'bg-muted-foreground',
    bgColor: 'bg-card',
    borderColor: 'border-border',
    emptyIcon: UserCheck,
    emptyIconColor: 'text-muted-foreground',
    emptyIconBg: 'bg-muted',
    emptyTitle: 'O histórico do dia',
    emptyDescription: 'aparecerá aqui.',
  },
];

interface DroppableColumnProps {
  column: typeof columns[0];
  children: React.ReactNode;
  count: number;
  isOver: boolean;
}

const DroppableColumnContent = forwardRef<HTMLDivElement, DroppableColumnProps>(
  ({ column, children, count, isOver }, ref) => {
    const EmptyIcon = column.emptyIcon;
    const hasChildren = count > 0;

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col rounded-xl lg:rounded-2xl border transition-all min-h-[200px] sm:min-h-[300px] lg:min-h-[400px]',
          column.bgColor,
          column.borderColor,
          isOver && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        {/* Header */}
        <div className="p-3 lg:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full', column.dotColor)} />
            <span className="font-medium text-foreground text-xs lg:text-sm">{column.title}</span>
          </div>
          <span className={cn(
            'text-xs lg:text-sm font-medium',
            column.id === 'waiting' ? 'text-yellow-600' : 
            column.id === 'in_progress' ? 'text-orange-600' : 
            'text-muted-foreground'
          )}>
            {count}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 px-2 lg:px-3 pb-2 lg:pb-3 space-y-2 lg:space-y-3">
          {!hasChildren ? (
            <div className="flex flex-col items-center justify-center h-full py-6 lg:py-12 text-center">
              <div className={cn('h-10 w-10 lg:h-14 lg:w-14 rounded-full flex items-center justify-center mb-3 lg:mb-4', column.emptyIconBg)}>
                <EmptyIcon className={cn('h-5 w-5 lg:h-7 lg:w-7', column.emptyIconColor)} />
              </div>
              <p className="text-xs lg:text-sm text-muted-foreground">{column.emptyTitle}</p>
              <p className="text-xs lg:text-sm text-muted-foreground">{column.emptyDescription}</p>
              
              {/* Drop zone indicator for waiting column */}
              {column.showDropZone && (
                <div className="mt-4 lg:mt-8 w-full max-w-[150px] lg:max-w-[200px] border-2 border-dashed border-yellow-400 rounded-xl p-4 lg:p-6 text-center">
                  <span className="text-xs lg:text-sm text-yellow-600 font-medium">Arraste para aqui</span>
                </div>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    );
  }
);
DroppableColumnContent.displayName = 'DroppableColumnContent';

function DroppableColumn({ column, children, count }: Omit<DroppableColumnProps, 'isOver'>) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <DroppableColumnContent
      ref={setNodeRef}
      column={column}
      count={count}
      isOver={isOver}
    >
      {children}
    </DroppableColumnContent>
  );
}

export default function WaitingRoomPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const formattedDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt });

  const { data: allAppointments = [], isLoading } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: professionals = [] } = useProfessionals();
  const { data: consultationTypes = [] } = useConsultationTypes();
  const updateAppointmentStatus = useUpdateAppointmentStatus();
  

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Filtrar apenas consultas de hoje com estados relevantes
  const todayAppointments = allAppointments.filter(
    (apt) => apt.date === today && ['confirmed', 'waiting', 'in_progress', 'completed'].includes(apt.status)
  );

  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const getProfessional = (id: string) => professionals.find((p) => p.id === id);
  const getConsultationType = (id: string) => consultationTypes.find((t) => t.id === id);

  const getAppointmentsByStatus = (status: AppointmentStatus) => {
    return todayAppointments
      .filter((apt) => apt.status === status)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const appointment = todayAppointments.find((apt) => apt.id === active.id);
    if (!appointment) return;

    const newStatus = over.id as AppointmentStatus;
    if (appointment.status === newStatus) return;

    // Validar transições (permite avançar e recuar)
    const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      scheduled: ['pre_confirmed', 'confirmed'],
      pre_confirmed: ['confirmed', 'cancelled'],
      confirmed: ['waiting', 'cancelled'],
      waiting: ['confirmed', 'in_progress', 'no_show'],
      in_progress: ['waiting', 'completed'],
      completed: ['in_progress'],
      cancelled: [],
      no_show: ['waiting'],
    };

    if (!validTransitions[appointment.status]?.includes(newStatus)) {
      toast.error('Transição de estado inválida');
      return;
    }

    updateAppointmentStatus.mutate(
      { id: appointment.id, status: newStatus },
      {
        onSuccess: () => {
          const patient = getPatient(appointment.patient_id);
          toast.success(`${patient?.name || 'Paciente'} movido para ${columns.find((c) => c.id === newStatus)?.title}`);
        },
        onError: () => {
          toast.error('Erro ao atualizar estado');
        },
      }
    );
  };

  const activeAppointment = activeId ? todayAppointments.find((apt) => apt.id === activeId) : null;

  // Profissionais ativos hoje
  const activeProfessionalIds = [...new Set(todayAppointments.map((apt) => apt.professional_id))];
  const activeProfessionals = professionals.filter((p) => activeProfessionalIds.includes(p.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4 lg:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif italic text-foreground text-lg lg:text-2xl">Sala de Espera</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">{formattedDate}</span>
            </div>
          </div>
          {activeProfessionals.length > 0 && (
            <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1.5">
              {activeProfessionals.slice(0, 3).map((prof) => (
                <Avatar key={prof.id} className="h-6 w-6 lg:h-7 lg:w-7 border-2 border-background">
                  <AvatarFallback 
                    className="text-[9px] lg:text-[10px] font-medium text-white"
                    style={{ backgroundColor: prof.color }}
                  >
                    {prof.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {activeProfessionals.length > 3 && (
                <span className="text-xs text-muted-foreground">+{activeProfessionals.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Responsivo: 1 coluna em mobile, 2 em tablet, 4 em desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
          {columns.map((column) => {
            const columnAppointments = getAppointmentsByStatus(column.id);

            return (
              <DroppableColumn key={column.id} column={column} count={columnAppointments.length}>
                {columnAppointments.map((apt) => (
                  <WaitingRoomCard
                    key={apt.id}
                    appointment={apt}
                    patient={getPatient(apt.patient_id)}
                    professional={getProfessional(apt.professional_id)}
                    consultationType={getConsultationType(apt.consultation_type_id)}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeAppointment && (
            <div className="bg-card border border-border rounded-xl p-3 lg:p-4 shadow-xl">
              <p className="font-semibold text-foreground text-sm">
                {getPatient(activeAppointment.patient_id)?.name || 'Paciente'}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeAppointment.time} • {getConsultationType(activeAppointment.consultation_type_id)?.name}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
