import { useMemo } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import type { ClinicAppointment, Professional } from '@/types/clinic';
import { cn } from '@/lib/utils';

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
  professionals: Professional[];
  onAppointmentClick: (appointment: ClinicAppointment) => void;
}

const statusConfig: Record<string, { label: string; shortLabel: string; bgClass: string; textClass: string; showDoubleCheck?: boolean }> = {
  confirmed: { label: 'Confirmado', shortLabel: 'Conf.', bgClass: 'bg-primary/5', textClass: 'text-primary', showDoubleCheck: true },
  waiting: { label: 'Em espera', shortLabel: 'Esp.', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
  in_progress: { label: 'Em atendimento', shortLabel: 'At.', bgClass: 'bg-orange-50', textClass: 'text-orange-700' },
  completed: { label: 'Concluida', shortLabel: 'Concl.', bgClass: 'bg-muted/50', textClass: 'text-muted-foreground' },
  cancelled: { label: 'Cancelada', shortLabel: 'Canc.', bgClass: 'bg-destructive/5', textClass: 'text-destructive' },
  no_show: { label: 'Faltou', shortLabel: 'Falt.', bgClass: 'bg-destructive/5', textClass: 'text-destructive' },
};

export function DayView({ appointments, professionals, onAppointmentClick }: DayViewProps) {
  const { getPatientById, getProfessionalById, getConsultationTypeById } = useClinic();

  const normalizeTime = (time: string): string => time.slice(0, 5);

  const getAppointmentTimeSlotIndex = (time: string): number => {
    const normalized = normalizeTime(time);
    return TIME_SLOTS.findIndex((slot) => slot === normalized);
  };

  const getAppointmentSlotSpan = (appointment: ClinicAppointment): number => {
    return Math.ceil(appointment.duration / 30);
  };

  const professionalColumns = useMemo(() => {
    const appointmentProfessionalIds = new Set(appointments.map((appointment) => appointment.professionalId));
    const withAppointments = professionals.filter((professional) => appointmentProfessionalIds.has(professional.id));

    return withAppointments.length > 0 ? withAppointments : professionals;
  }, [appointments, professionals]);

  const gridTemplateColumns = `68px repeat(${Math.max(professionalColumns.length, 1)}, minmax(190px, 1fr))`;
  const gridTemplateRows = `repeat(${TIME_SLOTS.length}, minmax(64px, auto))`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card lg:rounded-2xl">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[720px] border-b border-border/70 bg-secondary/35"
          style={{ gridTemplateColumns }}
        >
          <div className="sticky left-0 z-20 border-r border-border/70 bg-secondary/95 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Hora
          </div>

          {professionalColumns.map((professional) => (
            <div key={professional.id} className="min-w-0 border-r border-border/60 px-3 py-3 last:border-r-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: professional.color || 'hsl(var(--primary))' }}
                />
                <span className="truncate text-sm font-semibold text-foreground">{professional.name}</span>
              </div>
            </div>
          ))}
        </div>

        {professionalColumns.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Nao existem profissionais ativos para apresentar nesta vista.
          </div>
        ) : (
          <div
            className="relative grid min-w-[720px]"
            style={{ gridTemplateColumns, gridTemplateRows }}
          >
            {TIME_SLOTS.map((slot, slotIndex) => (
              <div
                key={`time-${slot}`}
                className="sticky left-0 z-10 flex items-start justify-end border-b border-r border-border/60 bg-card/95 px-3 py-3 text-xs font-medium text-muted-foreground"
                style={{ gridColumn: 1, gridRow: slotIndex + 1 }}
              >
                {slot}
              </div>
            ))}

            {TIME_SLOTS.map((slot, slotIndex) =>
              professionalColumns.map((professional, professionalIndex) => (
                <div
                  key={`${professional.id}-${slot}`}
                  className="border-b border-r border-border/40 bg-card last:border-r-0"
                  style={{ gridColumn: professionalIndex + 2, gridRow: slotIndex + 1 }}
                />
              )),
            )}

            {appointments.map((appointment) => {
              const professionalIndex = professionalColumns.findIndex((professional) => professional.id === appointment.professionalId);
              const startIndex = getAppointmentTimeSlotIndex(appointment.time);

              if (professionalIndex === -1 || startIndex === -1) {
                return null;
              }

              const patient = getPatientById(appointment.patientId);
              const professional = getProfessionalById(appointment.professionalId);
              const type = getConsultationTypeById(appointment.consultationTypeId);
              const slotSpan = Math.max(getAppointmentSlotSpan(appointment), 1);
              const status = statusConfig[appointment.status] || statusConfig.confirmed;

              return (
                <div
                  key={appointment.id}
                  onClick={() => onAppointmentClick(appointment)}
                  className={cn(
                    'z-20 m-1 flex cursor-pointer items-center justify-between rounded-xl border border-border/60 border-l-[4px] px-2.5 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md lg:px-3',
                    status.bgClass,
                  )}
                  style={{
                    gridColumn: professionalIndex + 2,
                    gridRow: `${startIndex + 1} / span ${slotSpan}`,
                    borderLeftColor: professional?.color || 'hsl(var(--primary))',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground lg:text-sm">
                      {patient?.name || 'Paciente'}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground lg:text-xs">
                      {appointment.time.slice(0, 5)} - {type?.name || 'Consulta'}
                    </p>
                  </div>

                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <span className={cn('text-[10px] font-medium lg:text-xs', status.textClass)}>
                      <span className="lg:hidden">{status.shortLabel}</span>
                      <span className="hidden lg:inline">{status.label}</span>
                    </span>
                    {status.showDoubleCheck ? (
                      <CheckCheck className="h-3 w-3 text-primary lg:h-4 lg:w-4" />
                    ) : (
                      <Check className="h-3 w-3 text-muted-foreground lg:h-4 lg:w-4" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
