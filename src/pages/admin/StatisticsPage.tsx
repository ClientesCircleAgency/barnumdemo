import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useClinic } from '@/context/ClinicContext';
import { useAppointmentRequests } from '@/hooks/useAppointmentRequests';
import {
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { ClinicAppointment } from '@/types/clinic';

type Period = 'today' | 'week' | 'month' | 'year';
type FunnelView = 'requests' | 'confirmed' | 'completed' | 'pending';

const ACTIVE_STATUSES = ['confirmed', 'waiting', 'in_progress', 'completed'] as const;

const periodLabels: Record<Period, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
  year: 'Ano',
};

const funnelLabels: Record<FunnelView, string> = {
  requests: 'Pedidos',
  confirmed: 'Confirmadas',
  completed: 'Concluídas',
  pending: 'Pendentes',
};

const statusProgress: Record<string, number> = {
  confirmed: 45,
  waiting: 60,
  in_progress: 82,
  completed: 100,
  cancelled: 0,
  no_show: 12,
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmada',
  waiting: 'Em espera',
  in_progress: 'Em atendimento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
};

function getPeriodInterval(period: Period) {
  const now = new Date();

  if (period === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (period === 'week') {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }

  if (period === 'month') {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }

  return { start: startOfYear(now), end: endOfYear(now) };
}

function isDateInInterval(dateString: string | null | undefined, interval: { start: Date; end: Date }) {
  if (!dateString) return false;

  return isWithinInterval(parseISO(dateString), interval);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function StatisticsPage() {
  const {
    appointments,
    patients,
    professionals,
    consultationTypes,
    getPatientById,
    getProfessionalById,
    getConsultationTypeById,
  } = useClinic();
  const { data: allRequests = [] } = useAppointmentRequests();
  const [activePeriod, setActivePeriod] = useState<Period>('month');
  const [funnelView, setFunnelView] = useState<FunnelView>('requests');

  const periodInterval = useMemo(() => getPeriodInterval(activePeriod), [activePeriod]);

  const activeAppointments = useMemo(
    () => appointments.filter((appointment) => (ACTIVE_STATUSES as readonly string[]).includes(appointment.status)),
    [appointments],
  );

  const periodAppointments = useMemo(
    () => activeAppointments.filter((appointment) => isDateInInterval(appointment.date, periodInterval)),
    [activeAppointments, periodInterval],
  );

  const periodRequests = useMemo(
    () => allRequests.filter((request) => isDateInInterval(request.preferred_date, periodInterval)),
    [allRequests, periodInterval],
  );

  const periodPendingRequests = useMemo(
    () => periodRequests.filter((request) => request.status === 'pending'),
    [periodRequests],
  );

  const periodLabel = useMemo(() => {
    if (activePeriod === 'today') {
      return format(periodInterval.start, "d 'de' MMMM yyyy", { locale: pt });
    }

    if (activePeriod === 'year') {
      return format(periodInterval.start, 'yyyy', { locale: pt });
    }

    return `${format(periodInterval.start, 'd MMM', { locale: pt })} - ${format(periodInterval.end, 'd MMM yyyy', { locale: pt })}`;
  }, [activePeriod, periodInterval]);

  const kpis = useMemo(() => {
    const completed = periodAppointments.filter((appointment) => appointment.status === 'completed').length;
    const confirmed = periodAppointments.filter((appointment) => appointment.status === 'confirmed').length;
    const waiting = periodAppointments.filter((appointment) => appointment.status === 'waiting').length;
    const inProgress = periodAppointments.filter((appointment) => appointment.status === 'in_progress').length;
    const totalFlow = periodRequests.length + periodAppointments.length;
    const conversion = periodRequests.length > 0 ? Math.round((periodAppointments.length / periodRequests.length) * 100) : 0;

    return {
      total: totalFlow,
      requests: periodRequests.length,
      pending: periodPendingRequests.length,
      confirmed,
      waiting,
      inProgress,
      completed,
      conversion,
    };
  }, [periodAppointments, periodPendingRequests, periodRequests]);

  const chartData = useMemo(() => {
    if (activePeriod === 'today') {
      const start = setSeconds(setMinutes(setHours(periodInterval.start, 9), 0), 0);
      const end = setSeconds(setMinutes(setHours(periodInterval.start, 19), 0), 0);

      return eachHourOfInterval({ start, end }).map((hourDate) => {
        const hour = format(hourDate, 'HH');
        const dateStr = format(hourDate, 'yyyy-MM-dd');
        const appointmentsAtHour = periodAppointments.filter(
          (appointment) => appointment.date === dateStr && appointment.time?.startsWith(hour),
        );
        const requestsAtHour = periodRequests.filter((request) => request.preferred_time?.startsWith(hour));

        return {
          label: `${hour}h`,
          requests: requestsAtHour.length,
          confirmed: appointmentsAtHour.filter((appointment) => appointment.status === 'confirmed').length,
          completed: appointmentsAtHour.filter((appointment) => appointment.status === 'completed').length,
          pending: periodPendingRequests.filter((request) => request.preferred_time?.startsWith(hour)).length,
        };
      });
    }

    if (activePeriod === 'year') {
      return eachMonthOfInterval(periodInterval).map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const appointmentsInMonth = periodAppointments.filter((appointment) =>
          isDateInInterval(appointment.date, { start: monthStart, end: monthEnd }),
        );
        const requestsInMonth = periodRequests.filter((request) =>
          isDateInInterval(request.preferred_date, { start: monthStart, end: monthEnd }),
        );

        return {
          label: format(monthDate, 'MMM', { locale: pt }),
          requests: requestsInMonth.length,
          confirmed: appointmentsInMonth.filter((appointment) => appointment.status === 'confirmed').length,
          completed: appointmentsInMonth.filter((appointment) => appointment.status === 'completed').length,
          pending: requestsInMonth.filter((request) => request.status === 'pending').length,
        };
      });
    }

    return eachDayOfInterval(periodInterval).map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const appointmentsOnDay = periodAppointments.filter((appointment) => appointment.date === dateStr);
      const requestsOnDay = periodRequests.filter((request) => request.preferred_date === dateStr);

      return {
        label: activePeriod === 'week' ? format(day, 'EEE', { locale: pt }) : format(day, 'd'),
        requests: requestsOnDay.length,
        confirmed: appointmentsOnDay.filter((appointment) => appointment.status === 'confirmed').length,
        completed: appointmentsOnDay.filter((appointment) => appointment.status === 'completed').length,
        pending: requestsOnDay.filter((request) => request.status === 'pending').length,
      };
    });
  }, [activePeriod, periodAppointments, periodInterval, periodPendingRequests, periodRequests]);

  const professionalMovements = useMemo(() => {
    return professionals
      .map((professional) => {
        const professionalAppointments = periodAppointments.filter(
          (appointment) => appointment.professionalId === professional.id,
        );
        const completed = professionalAppointments.filter((appointment) => appointment.status === 'completed').length;
        const progress = professionalAppointments.length > 0
          ? Math.round((completed / professionalAppointments.length) * 100)
          : 0;

        return {
          professional,
          total: professionalAppointments.length,
          completed,
          progress,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [periodAppointments, professionals]);

  const recentMovements = useMemo(() => {
    return [...periodAppointments]
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 8);
  }, [periodAppointments]);

  const chartConfig = {
    [funnelView]: {
      label: funnelLabels[funnelView],
      color: '#0f172a',
    },
  };

  return (
    <div className="min-h-screen bg-[#f7f8f5] pb-10">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-3 sm:px-6">
        <PageHeader
          title="Estatísticas"
          subtitle="Dados operacionais da clínica, pedidos e consultas registadas."
        />

        <section className="overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-lime-300 px-3 py-1 text-slate-950 hover:bg-lime-300">
                  Barnun Analytics
                </Badge>
                <span className="text-sm text-emerald-700">Dados em tempo real</span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Statistics
              </h2>
              <p className="mt-1 text-slate-500">
                Consumer data that has been registered.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 shadow-inner">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                {periodLabel}
              </div>
              <Tabs value={activePeriod} onValueChange={(value) => setActivePeriod(value as Period)}>
                <TabsList className="rounded-full bg-slate-100 p-1">
                  {(Object.keys(periodLabels) as Period[]).map((period) => (
                    <TabsTrigger
                      key={period}
                      value={period}
                      className="rounded-full px-4 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
                    >
                      {periodLabels[period]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="border-b border-slate-100 bg-gradient-to-b from-lime-50/80 to-white p-5 lg:border-b-0 lg:border-r">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300 text-slate-950">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-950">CRMBarnun</p>
                  <p className="text-xs text-slate-500">Clinical edge</p>
                </div>
              </div>

              <nav className="space-y-2">
                <SidebarPill active icon={BarChart3} label="Statistics" />
                <SidebarPill icon={Users} label={`${patients.length} pacientes`} />
                <SidebarPill icon={Clock3} label={`${kpis.pending} pendentes`} />
              </nav>
            </aside>

            <main className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Total no fluxo" value={kpis.total} caption="Pedidos + consultas" />
                <MetricCard title="Pedidos" value={kpis.requests} caption="Entradas no período" />
                <MetricCard title="Confirmadas" value={kpis.confirmed} caption="Consultas marcadas" />
                <MetricCard title="Conversão" value={`${kpis.conversion}%`} caption="Pedidos para consultas" />
              </div>

              <Card className="rounded-[1.75rem] border-slate-100 bg-white p-5 shadow-none">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Sales Funnel</h3>
                    <p className="text-sm text-slate-500">Funil de marcações e movimento clínico.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(funnelLabels) as FunnelView[]).map((view) => (
                      <Button
                        key={view}
                        type="button"
                        variant="ghost"
                        onClick={() => setFunnelView(view)}
                        className={`rounded-full px-4 ${
                          funnelView === view
                            ? 'bg-slate-950 text-white hover:bg-slate-900 hover:text-white'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {funnelLabels[view]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="h-[320px] rounded-[1.4rem] border border-slate-100 bg-gradient-to-b from-white to-slate-50/70 p-4">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <LineChart data={chartData} margin={{ left: 8, right: 18, top: 20, bottom: 8 }}>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        minTickGap={18}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(value) => `${value}`}
                        width={34}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent indicator="line" />}
                        formatter={(value: number) => [value, funnelLabels[funnelView]]}
                      />
                      <Line
                        type="monotone"
                        dataKey={funnelView}
                        stroke="#111827"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#111827', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#bef264', stroke: '#111827', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card className="overflow-hidden rounded-[1.75rem] border-slate-100 bg-white shadow-none">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Customer Movements</h3>
                    <p className="text-sm text-slate-500">Últimas consultas do período selecionado.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <th className="px-5 py-4">Overview</th>
                          <th className="px-5 py-4">Consulta</th>
                          <th className="px-5 py-4">Profissional</th>
                          <th className="px-5 py-4">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentMovements.map((appointment) => (
                          <MovementRow
                            key={appointment.id}
                            appointment={appointment}
                            patientName={getPatientById(appointment.patientId)?.name ?? 'Paciente'}
                            professionalName={getProfessionalById(appointment.professionalId)?.name ?? 'Profissional'}
                            consultationName={
                              appointment.consultationTypeName
                              || getConsultationTypeById(appointment.consultationTypeId)?.name
                              || 'Consulta'
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {recentMovements.length === 0 && (
                    <div className="px-5 py-12 text-center text-sm text-slate-500">
                      Sem movimentos para este período.
                    </div>
                  )}
                </Card>

                <Card className="rounded-[1.75rem] border-slate-100 bg-slate-950 p-5 text-white shadow-none">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Equipa</h3>
                      <p className="text-sm text-white/50">Volume por profissional</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-lime-300" />
                  </div>

                  <div className="space-y-4">
                    {professionalMovements.map(({ professional, total, completed, progress }) => (
                      <div key={professional.id} className="rounded-2xl bg-white/7 p-4">
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ backgroundColor: professional.color || '#84cc16' }}
                          >
                            {getInitials(professional.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{professional.name}</p>
                            <p className="text-xs text-white/45">
                              {total} consulta{total !== 1 ? 's' : ''} · {completed} concluída{completed !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className="rounded-full bg-lime-300 px-2 py-1 text-xs font-bold text-slate-950">
                            {progress}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-lime-300"
                            style={{ width: `${Math.max(progress, 6)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {professionalMovements.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
                      Sem consultas por profissional neste período.
                    </div>
                  )}
                </Card>
              </div>
            </main>
          </div>
        </section>
      </div>
    </div>
  );
}

function SidebarPill({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
        active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-white/70'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function MetricCard({ title, value, caption }: { title: string; value: number | string; caption: string }) {
  return (
    <div className="rounded-[1.35rem] border border-slate-100 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{caption}</p>
    </div>
  );
}

function MovementRow({
  appointment,
  patientName,
  professionalName,
  consultationName,
}: {
  appointment: ClinicAppointment;
  patientName: string;
  professionalName: string;
  consultationName: string;
}) {
  const progress = statusProgress[appointment.status] ?? 30;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-200 text-sm font-bold text-slate-950">
            {getInitials(patientName)}
          </div>
          <div>
            <p className="font-semibold text-slate-950">{patientName}</p>
            <p className="text-xs text-slate-500">
              {format(parseISO(appointment.date), 'dd MMM', { locale: pt })} · {appointment.time.slice(0, 5)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <p className="font-semibold text-slate-900">{consultationName}</p>
        <p className="text-xs text-slate-500">{statusLabels[appointment.status] ?? appointment.status}</p>
      </td>
      <td className="px-5 py-4 text-sm font-medium text-slate-700">{professionalName}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-lime-400" style={{ width: `${progress}%` }} />
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {progress}%
          </span>
        </div>
      </td>
    </tr>
  );
}
