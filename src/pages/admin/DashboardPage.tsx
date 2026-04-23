import { CalendarDays, Clock3, Inbox, MessageCircle, Sparkles, Star, TrendingUp, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useClinic } from '@/context/ClinicContext';
import { useAppointmentRequests } from '@/hooks/useAppointmentRequests';
import { useContactMessages } from '@/hooks/useContactMessages';
import { useSpecialties } from '@/hooks/useSpecialties';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AppointmentsChart } from '@/components/admin/AppointmentsChart';
import { AdminMetricCard, AdminPageShell, AdminSectionCard } from '@/components/admin/AdminSurface';
import type { AppointmentStatus } from '@/types/clinic';

const ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'waiting', 'in_progress'] as const;

export default function DashboardPage() {
  const { appointments, patients, professionals, getPatientById, getProfessionalById } = useClinic();
  const { userRole } = useAuth();
  const { data: requests = [] } = useAppointmentRequests();
  const { data: contactMessages = [] } = useContactMessages();
  const { data: specialties = [] } = useSpecialties();

  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const currentDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });

  const todayAppointments = appointments
    .filter((appointment) => appointment.date === todayDate)
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));

  const activeTodayAppointments = todayAppointments.filter((appointment) =>
    ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status as (typeof ACTIVE_APPOINTMENT_STATUSES)[number]),
  );
  const completedTodayAppointments = todayAppointments.filter((appointment) => appointment.status === 'completed');
  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const unreadMessages = contactMessages.filter((message) => !message.is_read);
  const utilisationRate = todayAppointments.length === 0
    ? 0
    : Math.round((completedTodayAppointments.length / todayAppointments.length) * 100);

  const nextAppointments = activeTodayAppointments.slice(0, 5);
  const recentRequests = pendingRequests.slice(0, 5);
  const quickActions = [
    { to: '/admin/agenda', label: 'Abrir agenda', helper: 'Gerir o dia em tempo real' },
    { to: '/admin/pacientes', label: 'Ver pacientes', helper: 'Consultar ficha e histórico' },
    { to: '/admin/pedidos', label: 'Triage de pedidos', helper: 'Responder a novas entradas', roles: ['admin', 'secretary'] },
    { to: '/admin/profissionais', label: 'Equipa clínica', helper: 'Cores, especialidades e acessos', roles: ['admin', 'secretary'] },
  ].filter((action) => !action.roles || (userRole && action.roles.includes(userRole)));

  return (
    <AdminPageShell
      eyebrow="Tela Med Command Center"
      title="Dashboard"
      subtitle={`Resumo operacional da clínica para ${currentDate}.`}
      badge={<span className="text-sm text-primary-dark">Operação em tempo real</span>}
    >
      <div className="space-y-4 lg:space-y-6">
        <AdminSectionCard className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(255,251,245,0.98),rgba(255,246,231,0.92))]">
          <div className="grid gap-5 p-4 lg:grid-cols-[1.3fr_0.9fr] lg:p-6">
            <div className="space-y-4 lg:space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  Vista central
                </Badge>
                <Badge variant="outline" className="rounded-full border-primary/15 bg-background/80 text-muted-foreground">
                  {professionals.length} profissionais ativos
                </Badge>
              </div>

              <div className="space-y-3">
                <h2 className="max-w-2xl font-display text-[1.6rem] font-semibold tracking-tight text-foreground lg:text-4xl">
                  Uma dashboard mais clínica, mais operacional e mais fácil de decidir.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                  Prioridades do dia, acessos rápidos e visibilidade imediata sobre agenda, pedidos e atendimento.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {quickActions.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group rounded-[1.25rem] border border-primary/10 bg-background/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md lg:rounded-[1.35rem]"
                  >
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary">{action.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.helper}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HighlightCard
                icon={Clock3}
                label="A decorrer hoje"
                value={todayAppointments.length}
                helper={`${activeTodayAppointments.length} ainda por concluir`}
              />
              <HighlightCard
                icon={TrendingUp}
                label="Ritmo do dia"
                value={`${utilisationRate}%`}
                helper="consultas concluídas"
              />
              <HighlightCard
                icon={Sparkles}
                label="Pedidos e contactos"
                value={pendingRequests.length + unreadMessages.length}
                helper="itens à espera de resposta"
              />
            </div>
          </div>
        </AdminSectionCard>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <AdminMetricCard icon={CalendarDays} title="Hoje" value={todayAppointments.length} caption="Consultas" accent />
          <MetricLink to="/admin/pedidos">
            <AdminMetricCard icon={Inbox} title="Pedidos" value={pendingRequests.length} caption="Pendentes" />
          </MetricLink>
          <AdminMetricCard icon={Users} title="Pacientes" value={patients.length} caption="Registados" />
          <AdminMetricCard icon={TrendingUp} title="Concluídas" value={completedTodayAppointments.length} caption="Hoje" />
          <AdminMetricCard icon={Star} title="Google" value={4.8} caption="127 avaliações" />
          <AdminMetricCard icon={MessageCircle} title="Mensagens" value={unreadMessages.length} caption="Por ler" />
        </div>

        <AppointmentsChart />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:gap-5">
          <AdminSectionCard className="overflow-hidden">
            <SectionHeader
              icon={Clock3}
              title="Agenda operacional de hoje"
              href="/admin/agenda"
            />
            <div className="space-y-2 p-3.5 lg:p-5">
              {nextAppointments.map((appointment) => {
                const patient = getPatientById(appointment.patientId);
                const professional = getProfessionalById(appointment.professionalId);

                return (
                  <div
                    key={appointment.id}
                    className="grid gap-3 rounded-[1.2rem] border border-primary/10 bg-secondary/35 p-3.5 transition-colors hover:border-primary/20 hover:bg-secondary/55 lg:grid-cols-[88px_1fr_auto] lg:rounded-2xl lg:p-4"
                  >
                    <div className="rounded-[1rem] bg-background px-3 py-3 text-center shadow-sm lg:rounded-2xl">
                      <p className="font-mono text-sm font-semibold text-primary-dark">{appointment.time.slice(0, 5)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{appointment.duration} min</p>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {patient?.name || 'Paciente por identificar'}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {professional?.name || 'Profissional não atribuído'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {appointment.reason || 'Consulta sem motivo registado'}
                      </p>
                    </div>

                    <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-end">
                      <StatusBadge status={appointment.status as AppointmentStatus} size="sm" className="shrink-0" />
                      <Button asChild variant="ghost" size="sm" className="h-auto rounded-xl px-3 py-2 text-primary">
                        <Link to="/admin/agenda">Abrir</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}

              {nextAppointments.length === 0 && (
                <EmptyPanel icon={Clock3} label="Nenhuma consulta ativa para hoje" />
              )}
            </div>
          </AdminSectionCard>

          <div className="grid gap-5">
            <AdminSectionCard className="overflow-hidden">
              <SectionHeader
                icon={Inbox}
                title="Pedidos pendentes"
                href="/admin/pedidos"
              />
              <div className="space-y-2 p-3.5 lg:p-5">
                {recentRequests.map((request) => (
                  <div key={request.id} className="rounded-[1.2rem] border border-primary/10 bg-background/80 p-3.5 shadow-sm lg:rounded-2xl lg:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{request.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {specialties.find((specialty) => specialty.id === request.specialty_id)?.name || 'Especialidade desconhecida'}
                        </p>
                      </div>
                      <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                        Pendente
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Preferência: {format(parseISO(request.preferred_date), 'd MMM', { locale: pt })} às {request.preferred_time?.slice(0, 5)}
                    </p>
                  </div>
                ))}

                {recentRequests.length === 0 && (
                  <EmptyPanel icon={Inbox} label="Nenhum pedido pendente neste momento" />
                )}
              </div>
            </AdminSectionCard>

            <AdminSectionCard className="overflow-hidden">
              <SectionHeader
                icon={Users}
                title="Resumo da base clínica"
                href="/admin/pacientes"
              />
              <div className="grid gap-3 p-3.5 lg:p-5 sm:grid-cols-2">
                <SummaryCard label="Pacientes registados" value={patients.length} />
                <SummaryCard label="Profissionais ativos" value={professionals.length} />
                <SummaryCard label="Mensagens novas" value={unreadMessages.length} />
                <SummaryCard label="Consultas totais" value={appointments.length} />
              </div>
            </AdminSectionCard>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}

function MetricLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  href,
}: {
  icon: typeof Clock3;
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-primary/10 p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <Button asChild variant="ghost" size="sm" className="rounded-xl text-primary">
        <Link to={href}>Ver tudo</Link>
      </Button>
    </div>
  );
}

function EmptyPanel({ icon: Icon, label }: { icon: typeof Clock3; label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-secondary/30 py-10 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-primary/60" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Clock3;
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.15rem] border border-primary/10 bg-background/80 p-4 shadow-sm lg:rounded-[1.4rem]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[1rem] bg-primary/10 text-primary lg:rounded-2xl">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:text-xs lg:tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-[1.6rem] font-semibold tracking-tight text-foreground lg:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground lg:text-sm">{helper}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[1.15rem] border border-primary/10 bg-secondary/35 p-4 lg:rounded-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:text-xs">{label}</p>
      <p className="mt-2 text-[1.6rem] font-semibold tracking-tight text-foreground lg:text-2xl">{value}</p>
    </div>
  );
}
