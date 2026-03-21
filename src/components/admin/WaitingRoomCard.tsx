import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock, User } from 'lucide-react';
import type { AppointmentRow, PatientRow, ProfessionalRow, ConsultationTypeRow } from '@/types/database';
import { cn } from '@/lib/utils';

interface WaitingRoomCardProps {
  appointment: AppointmentRow;
  patient: PatientRow | undefined;
  professional: ProfessionalRow | undefined;
  consultationType: ConsultationTypeRow | undefined;
}

export function WaitingRoomCard({ 
  appointment, 
  patient, 
  professional, 
  consultationType 
}: WaitingRoomCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: {
      appointment,
      currentStatus: appointment.status,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-card rounded-xl border transition-all duration-200',
        isDragging 
          ? 'shadow-2xl ring-2 ring-primary/50 scale-[1.02] opacity-95' 
          : 'hover:shadow-lg hover:border-primary/30 border-border',
        'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Colored top bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
        style={{ backgroundColor: professional?.color || '#94a3b8' }}
      />
      
      <div className="p-4 pt-3">
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className={cn(
              'mt-0.5 p-1.5 rounded-lg transition-all',
              'text-muted-foreground/50 hover:text-muted-foreground',
              'hover:bg-muted group-hover:text-muted-foreground',
              isDragging && 'text-primary bg-primary/10'
            )}
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Patient name */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground truncate text-sm">
                {patient?.name || 'Paciente desconhecido'}
              </p>
            </div>

            {/* Time and type */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                <Clock className="h-3 w-3" />
                <span className="font-medium">{appointment.time.slice(0, 5)}</span>
              </div>
              <span className="truncate">{consultationType?.name || 'Consulta'}</span>
            </div>

            {/* Professional */}
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: professional?.color || '#94a3b8' }}
              />
              <p className="text-xs text-muted-foreground truncate">
                {professional?.name || 'Profissional'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
