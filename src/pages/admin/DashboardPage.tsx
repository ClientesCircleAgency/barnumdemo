import { CalendarDays, Users, TrendingUp, Clock, Inbox, ArrowUpRight, Star, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useClinic } from '@/context/ClinicContext';
import { useAppointmentRequests } from '@/hooks/useAppointmentRequests';
import { useContactMessages } from '@/hooks/useContactMessages';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AppointmentsChart } from '@/components/admin/AppointmentsChart';
import { PageHeader } from '@/components/admin/PageHeader';
import type { AppointmentStatus } from '@/types/clinic';

export default function DashboardPage() {
  const { appointments, patients } = useClinic();
  const { data: requests = [] } = useAppointmentRequests();
  const { data: contactMessages = [] } = useContactMessages();

  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(
    (a) => a.date === todayDate && !['cancelled', 'no_show'].includes(a.status)
  );
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const newMessages = contactMessages.filter(m => !m.is_read);

  const currentDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });

  // Mock data for Google rating (would come from API)
  const googleRating = 4.8;
  const totalReviews = 127;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da clínica"
      />

      {/* KPI Cards Grid - Aligned with content below */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Consultas Hoje */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold text-primary leading-none">
            {todayAppointments.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Consultas hoje
          </p>
        </div>

        {/* Pedidos Pendentes */}
        <Link to="/admin/pedidos" className="block group">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm h-full hover:border-primary/50 hover:shadow-md transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Inbox className="h-4 w-4 text-primary" />
              </div>
              {pendingRequests.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
            </div>
            <p className="font-mono text-2xl font-bold text-primary leading-none">
              {pendingRequests.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos pendentes
            </p>
          </div>
        </Link>

        {/* Pacientes Registados */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold text-foreground leading-none">
            {patients.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pacientes registados
          </p>
        </div>

        {/* Total Consultas */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold text-foreground leading-none">
            {appointments.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total consultas
          </p>
        </div>

        {/* Google Rating */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-0.5">
            <p className="font-mono text-2xl font-bold text-foreground leading-none">
              {googleRating}
            </p>
            <span className="text-xs text-muted-foreground">/5</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Avaliação Google
          </p>
        </div>

        {/* Mensagens Novas */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold text-primary leading-none">
            {newMessages.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Mensagens novas
          </p>
        </div>
      </div>

      {/* Appointments Chart */}
      <AppointmentsChart />

      {/* Bottom Cards Grid */}
      <div className="grid grid-cols-1 gap-4 lg:gap-6">
        {/* Consultas de Hoje */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              </div>
              <h3 className="font-medium text-sm lg:text-base text-foreground">
                Consultas de Hoje
              </h3>
            </div>
            <Link to="/admin/agenda" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {todayAppointments.slice(0, 4).map((apt) => (
              <div key={apt.id} className="flex items-center gap-3 p-2.5 lg:p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="font-mono text-xs lg:text-sm font-medium text-primary shrink-0 w-10 lg:w-12">
                  {apt.time.slice(0, 5)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-xs lg:text-sm truncate">
                    Consulta
                  </p>
                  <p className="font-mono text-[10px] lg:text-xs text-muted-foreground">
                    {apt.duration} min
                  </p>
                </div>
                <StatusBadge status={apt.status as AppointmentStatus} size="sm" className="shrink-0" />
              </div>
            ))}
            {todayAppointments.length === 0 && (
              <div className="py-6 lg:py-8 text-center bg-muted/30 rounded-lg border border-border/50">
                <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-xs lg:text-sm">
                  Nenhuma consulta para hoje
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pedidos Recentes */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-lg bg-accent flex items-center justify-center">
                <Inbox className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              </div>
              <h3 className="font-medium text-sm lg:text-base text-foreground">
                Pedidos Recentes
              </h3>
            </div>
            <Link to="/admin/pedidos" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 4).map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-2.5 lg:p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-foreground truncate">
                    {req.name}
                  </p>
                  <p className="font-mono text-[10px] lg:text-xs text-muted-foreground">
                    {req.service_type === 'rejuvenescimento' ? 'Rejuvenescimento' : 'Dentária'} • {format(new Date(req.preferred_date), "d MMM", { locale: pt })}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px] lg:text-xs px-1.5">
                  Pendente
                </Badge>
              </div>
            ))}
            {pendingRequests.length === 0 && (
              <div className="py-6 lg:py-8 text-center bg-muted/30 rounded-lg border border-border/50">
                <Inbox className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-xs lg:text-sm">
                  Nenhum pedido pendente
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}