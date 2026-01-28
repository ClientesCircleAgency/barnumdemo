import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClinic } from '@/context/ClinicContext';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  eachDayOfInterval,
  getDay,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart3, CheckCircle2, Clock, ListChecks } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year';

const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'completed'] as const;

export default function StatisticsPage() {
  const { appointments } = useClinic();
  const [activePeriod, setActivePeriod] = useState<Period>('month');

  // Filter to only active statuses (MediFranco logic)
  const activeAppointments = useMemo(() => {
    return appointments.filter(apt =>
      (ACTIVE_STATUSES as readonly string[]).includes(apt.status)
    );
  }, [appointments]);

  // Get period boundaries
  const periodBounds = useMemo(() => {
    const now = new Date();

    switch (activePeriod) {
      case 'today':
        return {
          start: now,
          end: now,
          compareStr: format(now, 'yyyy-MM-dd')
        };
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
          compareStr: null
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
          compareStr: null
        };
      case 'year':
        return {
          start: startOfYear(now),
          end: endOfYear(now),
          compareStr: null
        };
    }
  }, [activePeriod]);

  // Filter appointments by period
  const periodAppointments = useMemo(() => {
    if (activePeriod === 'today') {
      return activeAppointments.filter(apt => apt.date === periodBounds.compareStr);
    }

    return activeAppointments.filter(apt => {
      const aptDate = parseISO(apt.date);
      return isWithinInterval(aptDate, { start: periodBounds.start, end: periodBounds.end });
    });
  }, [activeAppointments, activePeriod, periodBounds]);

  // KPI Calculations (MediFranco logic)
  const kpis = useMemo(() => {
    return {
      total: periodAppointments.length,
      pending: periodAppointments.filter(apt => apt.status === 'scheduled').length,
      confirmed: periodAppointments.filter(apt => apt.status === 'confirmed').length,
      completed: periodAppointments.filter(apt => apt.status === 'completed').length,
    };
  }, [periodAppointments]);

  // Chart 1: Tendência (Últimos 7 Dias)
  const trendData = useMemo(() => {
    const now = new Date();
    const last7Days = eachDayOfInterval({
      start: subDays(now, 6),
      end: now
    });

    return last7Days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = activeAppointments.filter(apt => apt.date === dateStr).length;

      return {
        label: format(day, 'EEE', { locale: pt }),
        value: count,
        fullDate: format(day, 'dd/MM', { locale: pt })
      };
    });
  }, [activeAppointments]);

  // Chart 2: Por Estado
  const statusData = useMemo(() => {
    const completed = periodAppointments.filter(apt => apt.status === 'completed').length;
    const confirmed = periodAppointments.filter(apt => apt.status === 'confirmed').length;
    const scheduled = periodAppointments.filter(apt => apt.status === 'scheduled').length;

    return [
      { label: 'Concluídas', value: completed, color: 'hsl(var(--chart-1))' },
      { label: 'Confirmadas', value: confirmed, color: 'hsl(var(--chart-2))' },
      { label: 'Agendadas', value: scheduled, color: 'hsl(var(--chart-3))' },
    ];
  }, [periodAppointments]);

  // Chart 3: Por Dia da Semana
  const weekdayData = useMemo(() => {
    const counts: Record<string, number> = {};

    periodAppointments.forEach(apt => {
      const dayName = format(parseISO(apt.date), 'EEEE', { locale: pt });
      counts[dayName] = (counts[dayName] || 0) + 1;
    });

    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [periodAppointments]);

  // Chart 4: Horários Mais Populares
  const hourData = useMemo(() => {
    const hourCounts = new Map<string, number>();

    periodAppointments.forEach(apt => {
      if (apt.time) {
        const hour = apt.time.substring(0, 2); // "09:30" -> "09"
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    });

    // Convert to array and sort by hour
    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({
        label: `${hour}:00`,
        value: count,
        hour: parseInt(hour, 10)
      }))
      .sort((a, b) => a.hour - b.hour);
  }, [periodAppointments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estatísticas"
        subtitle="Análise de consultas e desempenho da clínica"
      />

      {/* Period Filter */}
      <Card className="p-1.5 w-fit bg-muted border-0">
        <Tabs value={activePeriod} onValueChange={(v) => setActivePeriod(v as Period)}>
          <TabsList className="bg-transparent gap-1">
            <TabsTrigger
              value="today"
              className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Hoje
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Semana
            </TabsTrigger>
            <TabsTrigger
              value="month"
              className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Mês
            </TabsTrigger>
            <TabsTrigger
              value="year"
              className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Ano
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={BarChart3}
          label="Total"
          value={kpis.total}
          color="text-foreground"
        />
        <KPICard
          icon={Clock}
          label="Pendentes"
          value={kpis.pending}
          color="text-amber-500"
        />
        <KPICard
          icon={ListChecks}
          label="Confirmadas"
          value={kpis.confirmed}
          color="text-blue-500"
        />
        <KPICard
          icon={CheckCircle2}
          label="Concluídas"
          value={kpis.completed}
          color="text-emerald-500"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendência (Últimos 7 Dias) */}
        <ModernBarChart
          title="Tendência (Últimos 7 Dias)"
          subtitle="Consultas ativas por dia"
          data={trendData}
          color="hsl(var(--chart-1))"
        />

        {/* Por Estado */}
        <ModernBarChart
          title="Por Estado"
          subtitle="Distribuição por status"
          data={statusData}
          useCustomColors
        />

        {/* Por Dia da Semana */}
        <ModernBarChart
          title="Por Dia da Semana"
          subtitle="Consultas por dia útil"
          data={weekdayData}
          color="hsl(var(--chart-2))"
        />

        {/* Horários Mais Populares */}
        <ModernBarChart
          title="Horários Mais Populares"
          subtitle="Distribuição por hora"
          data={hourData}
          color="hsl(var(--chart-3))"
        />
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="p-6 bg-card border border-border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-lg bg-accent flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="font-mono text-3xl font-bold text-foreground mb-1">
        {value}
      </p>
      <p className="text-sm text-muted-foreground">
        {label}
      </p>
    </Card>
  );
}

// Modern Bar Chart Component
function ModernBarChart({
  title,
  subtitle,
  data,
  color = 'hsl(var(--chart-1))',
  useCustomColors = false
}: {
  title: string;
  subtitle: string;
  data: Array<{ label: string; value: number; color?: string; fullDate?: string }>;
  color?: string;
  useCustomColors?: boolean;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <Card className="p-6 bg-card border border-border">
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const barColor = useCustomColors ? item.color : color;

          return (
            <div key={index} className="group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {item.fullDate ? (
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground/60">{item.fullDate}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {item.value}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}

        {data.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Sem dados para este período</p>
          </div>
        )}
      </div>
    </Card>
  );
}
