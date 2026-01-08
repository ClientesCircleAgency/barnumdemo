import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Clock, CalendarCheck, AlertCircle, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useClinic } from '@/context/ClinicContext';
import { StatusBadge } from './StatusBadge';
import type { ClinicAppointment } from '@/types/clinic';
import { Link } from 'react-router-dom';

interface DaySummaryPanelProps {
  currentDate: Date;
  onAppointmentClick: (appointment: ClinicAppointment) => void;
}

export function DaySummaryPanel({ currentDate, onAppointmentClick }: DaySummaryPanelProps) {
  const { appointments, getPatientById, getProfessionalById, waitlist } = useClinic();

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const todayAppointments = appointments.filter((a) => a.date === dateStr);

  // Contadores por estado
  const statusCounts = {
    scheduled: todayAppointments.filter((a) => a.status === 'scheduled').length,
    confirmed: todayAppointments.filter((a) => a.status === 'confirmed').length,
    waiting: todayAppointments.filter((a) => a.status === 'waiting').length,
    in_progress: todayAppointments.filter((a) => a.status === 'in_progress').length,
    completed: todayAppointments.filter((a) => a.status === 'completed').length,
    cancelled: todayAppointments.filter((a) => a.status === 'cancelled').length,
    no_show: todayAppointments.filter((a) => a.status === 'no_show').length,
  };

  // Próximas consultas (não concluídas, ordenadas por hora)
  const upcomingAppointments = todayAppointments
    .filter((a) => !['completed', 'cancelled', 'no_show'].includes(a.status))
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 5);

  // Slots livres (simplificado - apenas conta horários sem consulta)
  const occupiedTimes = todayAppointments.map((a) => a.time);
  const allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
  const freeSlots = allSlots.filter((slot) => !occupiedTimes.includes(slot));

  return (
    <div className="space-y-4">
      {/* Resumo do dia */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Resumo do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <span className="text-blue-700">Marcadas</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {statusCounts.scheduled}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <span className="text-green-700">Confirmadas</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {statusCounts.confirmed}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
              <span className="text-yellow-700">Em espera</span>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {statusCounts.waiting}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
              <span className="text-orange-700">Atendimento</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {statusCounts.in_progress}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">Total do dia</span>
            <span className="font-semibold">{todayAppointments.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Próximas consultas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Próximas Consultas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sem consultas pendentes
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map((apt) => {
                const patient = getPatientById(apt.patientId);
                const professional = getProfessionalById(apt.professionalId);
                return (
                  <div
                    key={apt.id}
                    onClick={() => onAppointmentClick(apt)}
                    className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: professional?.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{patient?.name}</p>
                      <p className="text-xs text-muted-foreground">{apt.time}</p>
                    </div>
                    <StatusBadge status={apt.status} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vagas livres */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Vagas Livres
          </CardTitle>
        </CardHeader>
        <CardContent>
          {freeSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Agenda completa
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {freeSlots.slice(0, 8).map((slot) => (
                <Badge key={slot} variant="outline" className="text-xs">
                  {slot}
                </Badge>
              ))}
              {freeSlots.length > 8 && (
                <Badge variant="secondary" className="text-xs">
                  +{freeSlots.length - 8}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link para lista de espera */}
      <Card>
        <CardContent className="p-3">
          <Link to="/admin/lista-espera">
            <Button variant="outline" className="w-full justify-start gap-2">
              <List className="h-4 w-4" />
              Lista de Espera
              {waitlist.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {waitlist.length}
                </Badge>
              )}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
