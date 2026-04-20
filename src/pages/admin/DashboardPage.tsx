import { CalendarDays, Users, TrendingUp, Clock, Inbox, ArrowUpRight, Star, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { useClinic } from '@/context/ClinicContext';
import { useAppointmentRequests } from '@/hooks/useAppointmentRequests';
import { useContactMessages } from '@/hooks/useContactMessages';
import { useSpecialties } from '@/hooks/useSpecialties';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AppointmentsChart } from '@/components/admin/AppointmentsChart';
import { AdminMetricCard, AdminPageShell, AdminSectionCard } from '@/components/admin/AdminSurface';
import type { AppointmentStatus } from '@/types/clinic';

export default function DashboardPage() {
  const { appointments, patients } = useClinic();
  const { data: requests = [] } = useAppointmentRequests();
  const { data: contactMessages = [] } = useContactMessages();
  const { data: specialties = [] } = useSpecialties();

  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(
    (appointment) => appointment.date === todayDate && !['cancelled', 'no_show'].includes(appointment.status),
  );
  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const newMessages = contactMessages.filter((message) => !message.is_read);
  const currentDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });

  const googleRating = 4.8;
  const totalReviews = 127;

  return (
    <AdminPageShell
      title="Dashboard"
      subtitle={`Visão geral da clínica para ${currentDate}.`}
      badge={<span className="text-sm text-primary-dark">Operação em tempo real</span>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <AdminMetricCard icon={CalendarDays} title="Hoje" value={todayAppointments.length} caption="Consultas" accent />
          <MetricLink to="/admin/pedidos">
            <AdminMetricCard icon={Inbox} title="Pedidos" value={pendingRequests.length} caption="Pendentes" />
          </MetricLink>
          <AdminMetricCard icon={Users} title="Pacientes" value={patients.length} caption="Registados" />
          <AdminMetricCard icon={TrendingUp} title="Consultas" value={appointments.length} caption="Total" />
          <AdminMetricCard icon={Star} title="Google" value={googleRating} caption={`${totalReviews} avaliações`} />
          <AdminMetricCard icon={MessageCircle} title="Mensagens" value={newMessages.length} caption="Novas" />
        </div>

        <AppointmentsChart />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <AdminSectionCard className="overflow-hidden">
            <SectionHeader
              icon={Clock}
              title="Consultas de Hoje"
              href="/admin/agenda"
            />
            <div className="space-y-2 p-4 lg:p-5">
              {todayAppointments.slice(0, 5).map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-secondary/45 p-3">
                  <div className="w-14 shrink-0 font-mono text-sm font-semibold text-primary-dark">
                    {appointment.time.slice(0, 5)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">Consulta</p>
                    <p className="text-xs text-muted-foreground">{appointment.duration} min</p>
                  </div>
                  <StatusBadge status={appointment.status as AppointmentStatus} size="sm" className="shrink-0" />
                </div>
              ))}
              {todayAppointments.length === 0 && (
                <EmptyPanel icon={Clock} label="Nenhuma consulta para hoje" />
              )}
            </div>
          </AdminSectionCard>

          <AdminSectionCard className="overflow-hidden">
            <SectionHeader
              icon={Inbox}
              title="Pedidos Recentes"
              href="/admin/pedidos"
            />
            <div className="space-y-2 p-4 lg:p-5">
              {pendingRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-secondary/45 p-3">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{request.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {specialties.find((specialty) => specialty.id === request.specialty_id)?.name || 'Especialidade desconhecida'} · {format(parseISO(request.preferred_date), 'd MMM', { locale: pt })}
                    </p>
                  </div>
                  <Badge className="shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                    Pendente
                  </Badge>
                </div>
              ))}
              {pendingRequests.length === 0 && (
                <EmptyPanel icon={Inbox} label="Nenhum pedido pendente" />
              )}
            </div>
          </AdminSectionCard>
        </div>
      </div>
    </AdminPageShell>
  );
}

function MetricLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  );
}

function SectionHeader({ icon: Icon, title, href }: { icon: typeof Clock; title: string; href: string }) {
  return (
    <div className="flex items-center justify-between border-b border-primary/10 p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <Link to={href} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        Ver
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function EmptyPanel({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-secondary/35 py-10 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-primary/60" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
