import { useMemo } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import type { ClinicAppointment } from '@/types/clinic';
import { cn } from '@/lib/utils';

// Generate time slots from 08:00 to 20:00 in 30-minute intervals
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let h = 8; h <= 20; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 20) {
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

interface DayViewProps {
  appointments: ClinicAppointment[];
  onAppointmentClick: (appointment: ClinicAppointment) => void;
}

// Status display configuration
const statusConfig: Record<string, { label: string; shortLabel: string; bgClass: string; textClass: string; showDoubleCheck?: boolean }> = {
  scheduled: { label: 'Enviado', shortLabel: 'Env.', bgClass: 'bg-card', textClass: 'text-muted-foreground' },
  pre_confirmed: { label: 'Pré-confirmado', shortLabel: 'Pré', bgClass: 'bg-amber-50', textClass: 'text-amber-600' },
  confirmed: { label: 'Confirmado', shortLabel: 'Conf.', bgClass: 'bg-primary/5', textClass: 'text-primary', showDoubleCheck: true },
  waiting: { label: 'Em espera', shortLabel: 'Esp.', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
  in_progress: { label: 'Em atendimento', shortLabel: 'At.', bgClass: 'bg-orange-50', textClass: 'text-orange-700' },
  completed: { label: 'Concluída', shortLabel: 'Concl.', bgClass: 'bg-muted/50', textClass: 'text-muted-foreground' },
  cancelled: { label: 'Cancelada', shortLabel: 'Canc.', bgClass: 'bg-destructive/5', textClass: 'text-destructive' },
  no_show: { label: 'Faltou', shortLabel: 'Falt.', bgClass: 'bg-destructive/5', textClass: 'text-destructive' },
};

export function DayView({ appointments, onAppointmentClick }: DayViewProps) {
  const { getPatientById, getProfessionalById, getConsultationTypeById } = useClinic();

  // Normalize time to HH:mm format (strip seconds if present)
  const normalizeTime = (time: string): string => {
    return time.slice(0, 5);
  };

  const getAppointmentTimeSlotIndex = (time: string): number => {
    const normalized = normalizeTime(time);
    return TIME_SLOTS.findIndex((slot) => slot === normalized);
  };

  // Calculate how many slots an appointment spans
  const getAppointmentSlotSpan = (apt: ClinicAppointment): number => {
    return Math.ceil(apt.duration / 30);
  };

  // Build a map of which slots are "taken" and should be skipped
  const slotOccupancy = useMemo(() => {
    const map: Record<string, { appointment: ClinicAppointment; isStart: boolean }> = {};
    
    for (const apt of appointments) {
      const startIdx = getAppointmentTimeSlotIndex(apt.time);
      const span = getAppointmentSlotSpan(apt);
      
      for (let i = 0; i < span && startIdx + i < TIME_SLOTS.length; i++) {
        const slot = TIME_SLOTS[startIdx + i];
        map[slot] = { appointment: apt, isStart: i === 0 };
      }
    }
    
    return map;
  }, [appointments]);

  return (
    <div className="bg-card border border-border rounded-xl lg:rounded-2xl overflow-hidden">
      {TIME_SLOTS.map((slot) => {
        const occupancy = slotOccupancy[slot];
        
        // If this slot is occupied but not the start, skip rendering
        if (occupancy && !occupancy.isStart) {
          return null;
        }
        
        const apt = occupancy?.appointment;
        const patient = apt ? getPatientById(apt.patientId) : null;
        const professional = apt ? getProfessionalById(apt.professionalId) : null;
        const type = apt ? getConsultationTypeById(apt.consultationTypeId) : null;
        const slotSpan = apt ? getAppointmentSlotSpan(apt) : 1;
        const status = apt ? statusConfig[apt.status] || statusConfig.scheduled : null;
        
        // Calculate row height based on span
        const rowHeight = slotSpan > 1 ? `${slotSpan * 48}px` : undefined;
        
        return (
          <div
            key={slot}
            className="flex items-stretch border-b border-border/50 last:border-b-0"
            style={rowHeight ? { minHeight: rowHeight } : { minHeight: '48px' }}
          >
            {/* Time column - compact on mobile */}
            <div className="w-10 lg:w-16 shrink-0 flex items-start justify-end pr-1.5 lg:pr-3 py-2.5 lg:py-3 text-muted-foreground text-[11px] lg:text-sm font-medium">
              {slot}
            </div>

            {/* Appointment area */}
            <div className="flex-1 py-1 lg:py-1.5 pr-2 lg:pr-3">
              {apt && status ? (
                <div
                  onClick={() => onAppointmentClick(apt)}
                  className={cn(
                    'h-full flex items-center justify-between px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg lg:rounded-xl cursor-pointer transition-all hover:shadow-md border-l-[3px]',
                    status.bgClass
                  )}
                  style={{
                    borderLeftColor: professional?.color || 'hsl(var(--primary))',
                  }}
                >
                  {/* Patient info - stacked on mobile */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-xs lg:text-sm truncate">
                      {patient?.name || 'Paciente'}
                    </p>
                    <p className="text-[10px] lg:text-xs text-muted-foreground truncate">
                      <span className="lg:hidden">{type?.name?.split(' ')[0]}</span>
                      <span className="hidden lg:inline">{type?.name} • {professional?.name}</span>
                    </p>
                  </div>
                  
                  {/* Status indicator */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className={cn('text-[10px] lg:text-xs font-medium', status.textClass)}>
                      <span className="lg:hidden">{status.shortLabel}</span>
                      <span className="hidden lg:inline">{status.label}</span>
                    </span>
                    {status.showDoubleCheck && (
                      <CheckCheck className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                    )}
                    {!status.showDoubleCheck && apt.status === 'scheduled' && (
                      <Check className="h-3 w-3 lg:h-4 lg:w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
