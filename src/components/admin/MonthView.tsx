import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { useClinic } from '@/context/ClinicContext';
import type { ClinicAppointment } from '@/types/clinic';

interface MonthViewProps {
  currentDate: Date;
  selectedProfessional: string;
  selectedStatus: string;
  searchQuery: string;
  onAppointmentClick: (appointment: ClinicAppointment) => void;
  onDateClick?: (date: Date) => void;
}

export function MonthView({
  currentDate,
  selectedProfessional,
  selectedStatus,
  searchQuery,
  onAppointmentClick,
  onDateClick,
}: MonthViewProps) {
  const { appointments, getPatientById, getProfessionalById } = useClinic();

  // Calcular grid do mês
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Gerar todos os dias do calendário
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Filtrar consultas
  const getAppointmentsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return appointments
      .filter((apt) => {
        if (apt.date !== dateStr) return false;
        if (selectedProfessional !== 'all' && apt.professionalId !== selectedProfessional) return false;
        if (selectedStatus !== 'all' && apt.status !== selectedStatus) return false;
        if (searchQuery) {
          const patient = getPatientById(apt.patientId);
          const searchLower = searchQuery.toLowerCase();
          if (
            !patient?.name.toLowerCase().includes(searchLower) &&
            !patient?.phone.includes(searchQuery) &&
            !patient?.nif.includes(searchQuery)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const weekDaysFull = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

  return (
    <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardContent className="p-0 lg:p-2">
        {/* Header dos dias da semana */}
        <div className="grid grid-cols-7 mb-0.5 lg:mb-1">
          {weekDaysFull.map((d) => (
            <div key={d} className="text-center py-2 text-[10px] lg:text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Grid do calendário */}
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const dayAppointments = getAppointmentsForDay(d);
            const isCurrentMonth = isSameMonth(d, currentDate);
            const isToday = isSameDay(d, new Date());
            const maxVisibleMobile = 1;
            const maxVisibleDesktop = 3;

            return (
              <div
                key={d.toISOString()}
                className={`min-h-16 lg:min-h-24 border border-border/30 lg:border-border p-0.5 lg:p-1 cursor-pointer transition-colors ${
                  isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                } ${isToday ? 'border-primary' : ''} hover:bg-accent/30`}
                onClick={() => onDateClick?.(d)}
              >
                <div className="flex items-center justify-center lg:justify-start mb-0.5 lg:mb-1">
                  <span
                    className={`text-xs lg:text-sm font-medium ${
                      isToday
                        ? 'bg-primary text-primary-foreground w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-[10px] lg:text-sm'
                        : isCurrentMonth
                        ? ''
                        : 'text-muted-foreground'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>
                </div>

                {/* Mobile: show dot indicator only */}
                <div className="lg:hidden flex justify-center gap-0.5 flex-wrap">
                  {dayAppointments.slice(0, 3).map((apt) => {
                    const professional = getProfessionalById(apt.professionalId);
                    return (
                      <div
                        key={apt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(apt);
                        }}
                        className="w-1.5 h-1.5 rounded-full cursor-pointer"
                        style={{ backgroundColor: professional?.color }}
                      />
                    );
                  })}
                  {dayAppointments.length > 3 && (
                    <span className="text-[8px] text-muted-foreground">+{dayAppointments.length - 3}</span>
                  )}
                </div>

                {/* Desktop: show appointment details */}
                <div className="hidden lg:block space-y-0.5">
                  {dayAppointments.slice(0, maxVisibleDesktop).map((apt) => {
                    const professional = getProfessionalById(apt.professionalId);
                    const patient = getPatientById(apt.patientId);
                    return (
                      <div
                        key={apt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(apt);
                        }}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: `${professional?.color}30`,
                          color: professional?.color,
                        }}
                        title={`${apt.time} - ${patient?.name}`}
                      >
                        {apt.time.slice(0, 5)} {patient?.name?.split(' ')[0]}
                      </div>
                    );
                  })}
                  {dayAppointments.length > maxVisibleDesktop && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      +{dayAppointments.length - maxVisibleDesktop} mais
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
