import { useMemo, useState } from 'react';
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
  month: 'Mes',
  year: 'Ano',
};

const funnelLabels: Record<FunnelView, string> = {
  requests: 'Pedidos',
  confirmed: 'Confirmadas',
  completed: 'Concluidas',
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
  completed: 'Concluida',
  cancelled: 'Cancelada',
  no_show: 'Nao compareceu',
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
    [appointments]
  );

  const periodAppointments = useMemo(
    () => activeAppointments.filter((appointment) => isDateInInterval(appointment.date, periodInterval)),
    [activeAppointments, periodInterval]
  );

  const periodRequests = useMemo(
    () => allRequests.filter((request) => isDateInInterval(request.preferred_date, periodInterval)),
    [allRequests, periodInterval]
  );

  const periodPendingRequests = useMemo(
    () => periodRequests.filter((request) => request.status === 'pending'),
    [periodRequests]
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
          (appointment) => appointment.date === dateStr && appointment.time?.startsWith(hour)
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
          isDateInInterval(appointment.date, { start: monthStart, end: monthEnd })
        );
        const requestsInMonth = periodRequests.filter((request) =>
          isDateInInterval(request.preferred_date, { start: monthStart, end: monthEnd })
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
          (appointment) => appointment.professionalId === professional.id
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
    <div className="space-y-4 pb-24 lg:space-y-6 lg:pb-6">
      <section className="overflow-hidden rounded-[2rem] border border-primary/10 bg-[radial-gradient(circle_at_top_left,rgba(191,145,54,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.84))] p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-primary-gradient text-primary-foreground shadow-lg shadow-primary/20">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-0 bg-foreground text-[11px] font-semibold text-background shadow-sm">
                  Mobile analytics
                </Badge>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-white/70 text-[11px] text-primary">
                  Tempo real
                </Badge>
              </div>
              <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Estatisticas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Leitura rapida do funil, da equipa e do movimento clinico, pensada para consulta no telemovel.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeroMetric title="Fluxo" value={kpis.total} caption="Pedidos + consultas" />
            <HeroMetric title="Conversao" value={`${kpis.conversion}%`} caption="Do pedido ao agendamento" />
            <HeroMetric title="Pendentes" value={kpis.pending} caption="A aguardar resposta" />
            <HeroMetric title="Pacientes" value={patients.length} caption="Base atual" />
          </div>

          <div className="flex flex-col gap-3">
            <div className="inline-flex w-full items-center gap-2 rounded-[1.4rem] border border-primary/10 bg-white/80 px-4 py-3 text-sm font-medium text-foreground shadow-sm sm:w-fit">
              <CalendarDays className="h-4 w-4 text-primary" />
              {periodLabel}
            </div>
            <Tabs value={activePeriod} onValueChange={(value) => setActivePeriod(value as Period)}>
              <TabsList className="grid h-auto w-full grid-cols-4 rounded-[1.4rem] bg-secondary p-1">
                {(Object.keys(periodLabels) as Period[]).map((period) => (
                  <TabsTrigger
                    key={period}
                    value={period}
                    className="rounded-[1rem] px-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary-gradient data-[state=active]:text-primary-foreground"
                  >
                    {periodLabels[period]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <Card className="rounded-[2rem] border-primary/10 bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Funil de marcacoes</h2>
                <p className="mt-1 text-sm text-muted-foreground">Leitura do periodo selecionado sem sair do contexto mobile.</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(Object.keys(funnelLabels) as FunnelView[]).map((view) => (
                <Button
                  key={view}
                  type="button"
                  variant="ghost"
                  onClick={() => setFunnelView(view)}
                  className={`h-11 rounded-2xl ${
                    funnelView === view
                      ? 'bg-primary-gradient text-primary-foreground hover:opacity-90 hover:text-primary-foreground'
                      : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {funnelLabels[view]}
                </Button>
              ))}
            </div>

            <div className="h-[300px] rounded-[1.6rem] border border-primary/10 bg-gradient-to-b from-card to-secondary/40 p-3 sm:h-[340px] sm:p-4">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <LineChart data={chartData} margin={{ left: 0, right: 8, top: 20, bottom: 6 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    minTickGap={16}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(value) => `${value}`}
                    width={30}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent indicator="line" />}
                    formatter={(value: number) => [value, funnelLabels[funnelView]]}
                  />
                  <Line
                    type="monotone"
                    dataKey={funnelView}
                    stroke="hsl(var(--primary-dark))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'hsl(var(--primary-dark))', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--primary-dark))', strokeWidth: 2 }}
                  />
                </LineChart>
              </ChartContainer>
            </div>
          </Card>

          <Card className="rounded-[2rem] border-primary/10 bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Movimentos recentes</h2>
                <p className="mt-1 text-sm text-muted-foreground">Consultas recentes em formato de feed, mais natural para mobile.</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Clock3 className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-3">
              {recentMovements.map((appointment) => (
                <MovementCard
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
            </div>

            {recentMovements.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-primary/20 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
                Sem movimentos para este periodo.
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-[2rem] border-primary/10 bg-gradient-to-b from-primary/8 via-secondary/60 to-card p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Resumo rapido</h2>
                <p className="mt-1 text-sm text-muted-foreground">Estado operacional da clinica neste periodo.</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-3">
              <InsightPill icon={BarChart3} label="Pedidos registados" value={kpis.requests} accent />
              <InsightPill icon={Users} label="Consultas confirmadas" value={kpis.confirmed} />
              <InsightPill icon={Clock3} label="Em espera" value={kpis.waiting + kpis.inProgress} />
              <InsightPill icon={TrendingUp} label="Concluidas" value={kpis.completed} />
            </div>
          </Card>

          <Card className="rounded-[2rem] border-primary/10 bg-gradient-to-b from-primary/8 via-secondary/60 to-card p-4 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Equipa</h2>
                <p className="mt-1 text-sm text-muted-foreground">Volume por profissional</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-3">
              {professionalMovements.map(({ professional, total, completed, progress }) => (
                <div key={professional.id} className="rounded-[1.5rem] border border-primary/10 bg-card/90 p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: professional.color || 'hsl(var(--primary))' }}
                    >
                      {getInitials(professional.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{professional.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {total} consulta{total !== 1 ? 's' : ''} · {completed} concluida{completed !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-dark">
                      {progress}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary-gradient"
                      style={{ width: `${Math.max(progress, 6)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {professionalMovements.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-primary/20 bg-card/70 p-6 text-center text-sm text-muted-foreground">
                Sem consultas por profissional neste periodo.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ title, value, caption }: { title: string; value: number | string; caption: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function InsightPill({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[1.4rem] px-4 py-3 ${
        accent
          ? 'bg-primary-gradient text-primary-foreground shadow-md shadow-primary/20'
          : 'border border-primary/10 bg-card/85 text-foreground'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent ? 'bg-white/15' : 'bg-primary/10 text-primary'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs uppercase tracking-[0.18em] ${accent ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function MovementCard({
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
    <div className="rounded-[1.5rem] border border-primary/10 bg-secondary/30 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary-dark">
          {getInitials(patientName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{patientName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(parseISO(appointment.date), 'dd MMM', { locale: pt })} · {appointment.time.slice(0, 5)}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-dark">
              {progress}%
            </span>
          </div>

          <div className="mt-3 grid gap-2">
            <div className="rounded-2xl bg-background/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Consulta</p>
              <p className="mt-1 text-sm font-medium text-foreground">{consultationName}</p>
            </div>
            <div className="rounded-2xl bg-background/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Profissional</p>
              <p className="mt-1 text-sm font-medium text-foreground">{professionalName}</p>
            </div>
            <div className="rounded-2xl bg-background/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Estado</p>
              <p className="mt-1 text-sm font-medium text-foreground">{statusLabels[appointment.status] ?? appointment.status}</p>
            </div>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary-gradient" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
