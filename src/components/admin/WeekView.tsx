import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { useClinic } from '@/context/ClinicContext';
import type { ClinicAppointment } from '@/types/clinic';

interface WeekViewProps {
  currentDate: Date;
  selectedProfessional: string;
  selectedStatus: string;
  searchQuery: string;
  onAppointmentClick: (appointment: ClinicAppointment) => void;
}

export function WeekView({
  currentDate,
  selectedProfessional,
  selectedStatus,
  searchQuery,
  onAppointmentClick,
}: WeekViewProps) {
  const { appointments, getPatientById, getProfessionalById } = useClinic();

  // Calcular dias da semana (segunda a domingo)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filtrar consultas por semana
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

  return (
    <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardContent className="p-0 lg:p-2">
        <div className="grid grid-cols-7">
          {/* Header dos dias */}
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`text-center py-2 px-0.5 lg:p-2 lg:rounded-t-md ${
                isSameDay(day, new Date()) ? 'bg-primary/10' : 'bg-muted/50'
              }`}
            >
              <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase">
                {format(day, 'EEE', { locale: pt })}
              </p>
              <p
                className={`text-base lg:text-lg font-bold ${
                  isSameDay(day, new Date()) ? 'text-primary' : ''
                }`}
              >
                {format(day, 'd')}
              </p>
            </div>
          ))}

          {/* Conteúdo dos dias */}
          {weekDays.map((day) => {
            const dayAppointments = getAppointmentsForDay(day);
            return (
              <div
                key={`content-${day.toISOString()}`}
                className="min-h-32 lg:min-h-48 border border-border/50 lg:border-border lg:rounded-b-md p-0.5 lg:p-1 space-y-0.5 lg:space-y-1"
              >
                {dayAppointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">-</p>
                ) : (
                  dayAppointments.map((apt) => {
                    const patient = getPatientById(apt.patientId);
                    const professional = getProfessionalById(apt.professionalId);
                    return (
                      <div
                        key={apt.id}
                        onClick={() => onAppointmentClick(apt)}
                        className="p-1 lg:p-1.5 rounded text-[10px] lg:text-xs cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        style={{
                          backgroundColor: `${professional?.color}20`,
                          borderLeft: `2px solid ${professional?.color}`,
                        }}
                      >
                        <p className="font-medium">{apt.time.slice(0, 5)}</p>
                        <p className="truncate hidden lg:block">{patient?.name}</p>
                        <p className="truncate lg:hidden">{patient?.name?.split(' ')[0]?.charAt(0)}.</p>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
