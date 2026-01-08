import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Euro } from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import { useSettings } from '@/hooks/useSettings';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachHourOfInterval,
  setHours,
  setMinutes,
  setSeconds,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

type Period = 'day' | 'week' | 'month' | 'year';

const periodLabels: Record<Period, string> = {
  day: 'Hoje',
  week: 'Semana',
  month: 'Mês',
  year: 'Ano',
};

export function RevenueChart() {
  const { appointments } = useClinic();
  const { data: settings } = useSettings();
  const [activePeriod, setActivePeriod] = useState<Period>('month');

  const averageValue = (settings?.averageConsultationValue as number) || 50;

  const completedAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'completed');
  }, [appointments]);

  // Map por data
  const completedCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const apt of completedAppointments) {
      map.set(apt.date, (map.get(apt.date) ?? 0) + 1);
    }
    return map;
  }, [completedAppointments]);

  // Map por data+hora (para gráfico diário)
  const completedCountByHour = useMemo(() => {
    const map = new Map<string, number>();
    const today = format(new Date(), 'yyyy-MM-dd');
    for (const apt of completedAppointments) {
      if (apt.date === today && apt.time) {
        const hour = apt.time.substring(0, 2); // "09:30" -> "09"
        const key = `${apt.date}-${hour}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [completedAppointments]);

  // Horário de funcionamento da clínica (defaults: 09:00 - 19:00)
  const clinicOpenHour = useMemo(() => {
    const openingHours = settings?.openingHours as { start?: string; end?: string } | undefined;
    const startStr = openingHours?.start || '09:00';
    const endStr = openingHours?.end || '19:00';
    return {
      start: parseInt(startStr.split(':')[0], 10),
      end: parseInt(endStr.split(':')[0], 10),
    };
  }, [settings]);

  const revenueData = useMemo(() => {
    const today = new Date();
    
    const getCompletedInPeriod = (start: Date, end: Date) => {
      return completedAppointments.filter(apt => {
        const aptDate = parseISO(apt.date);
        return isWithinInterval(aptDate, { start, end });
      }).length;
    };

    // Today
    const dayCount = completedAppointments.filter(apt => apt.date === format(today, 'yyyy-MM-dd')).length;
    
    // This week
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const weekCount = getCompletedInPeriod(weekStart, weekEnd);
    
    // This month
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const monthCount = getCompletedInPeriod(monthStart, monthEnd);
    
    // This year
    const yearStart = startOfYear(today);
    const yearEnd = endOfYear(today);
    const yearCount = getCompletedInPeriod(yearStart, yearEnd);

    return {
      day: { count: dayCount, revenue: dayCount * averageValue },
      week: { count: weekCount, revenue: weekCount * averageValue },
      month: { count: monthCount, revenue: monthCount * averageValue },
      year: { count: yearCount, revenue: yearCount * averageValue },
    };
  }, [completedAppointments, averageValue]);

  const chartData = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Para o período DIÁRIO: usar horas de funcionamento da clínica
    if (activePeriod === 'day') {
      const dayStart = setSeconds(setMinutes(setHours(startOfDay(now), clinicOpenHour.start), 0), 0);
      const dayEnd = setSeconds(setMinutes(setHours(startOfDay(now), clinicOpenHour.end), 0), 0);

      const points: Array<{ t: number; value: number }> = [
        { t: dayStart.getTime(), value: 0 },
      ];

      let cumulative = 0;
      const hours = eachHourOfInterval({ start: dayStart, end: dayEnd });

      for (const hourDate of hours) {
        const hour = format(hourDate, 'HH');
        const key = `${todayStr}-${hour}`;
        const count = completedCountByHour.get(key) ?? 0;
        cumulative += count * averageValue;
        points.push({ t: hourDate.getTime(), value: cumulative });
      }

      return points;
    }

    const interval = (() => {
      switch (activePeriod) {
        case 'week': {
          const start = startOfDay(startOfWeek(now, { weekStartsOn: 1 }));
          const end = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
          return { start, end };
        }
        case 'month': {
          const start = startOfDay(startOfMonth(now));
          const end = endOfDay(endOfMonth(now));
          return { start, end };
        }
        case 'year': {
          const start = startOfDay(startOfYear(now));
          const end = endOfDay(endOfYear(now));
          return { start, end };
        }
        default:
          return { start: startOfDay(now), end: endOfDay(now) };
      }
    })();

    const points: Array<{ t: number; value: number }> = [
      { t: interval.start.getTime(), value: 0 },
    ];

    const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');
    let cumulative = 0;

    if (activePeriod === 'year') {
      const months = eachMonthOfInterval(interval);
      for (const monthStart of months) {
        const mStart = startOfMonth(monthStart);
        const mEnd = endOfMonth(monthStart);
        const days = eachDayOfInterval({ start: mStart, end: mEnd });

        let monthCount = 0;
        for (const d of days) {
          monthCount += completedCountByDate.get(dateKey(d)) ?? 0;
        }

        cumulative += monthCount * averageValue;
        points.push({ t: mEnd.getTime(), value: cumulative });
      }

      return points;
    }

    // Semana / Mês: pontos diários
    const days = eachDayOfInterval(interval);
    for (const d of days) {
      const count = completedCountByDate.get(dateKey(d)) ?? 0;
      cumulative += count * averageValue;
      points.push({ t: endOfDay(d).getTime(), value: cumulative });
    }

    return points;
  }, [activePeriod, completedCountByDate, completedCountByHour, averageValue, clinicOpenHour]);

  const chartConfig = {
    value: {
      label: 'Faturação',
      color: 'hsl(var(--chart-1))',
    },
  };

  const activeData = revenueData[activePeriod];

  // Calculate percentage change (mock for now)
  const percentageChange = 12.5;

  return (
    <Card className="p-6 bg-card border border-border shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
            <Euro className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-foreground text-lg">
              Faturação Estimada
            </h3>
            <p className="font-mono text-xs text-muted-foreground">
              Baseado em {averageValue}€/consulta
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono text-sm px-3 py-1 flex items-center gap-1 w-fit">
          <TrendingUp className="h-3 w-3 text-primary" />
          +{percentageChange}%
        </Badge>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
        {(Object.keys(periodLabels) as Period[]).map((period) => (
          <Button
            key={period}
            variant="ghost"
            size="sm"
            onClick={() => setActivePeriod(period)}
            className={`flex-1 font-sans text-sm ${
              activePeriod === period
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {periodLabels[period]}
          </Button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="font-mono text-3xl lg:text-4xl font-semibold text-primary">
            {activeData.revenue.toLocaleString('pt-PT')}€
          </p>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            {periodLabels[activePeriod]}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="font-mono text-3xl lg:text-4xl font-semibold text-foreground">
            {activeData.count}
          </p>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Consultas concluídas
          </p>
        </div>
      </div>

      {/* Futuristic Chart */}
      <div className="h-48 bg-muted/30 rounded-lg p-4 border border-border/50">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
              interval="preserveStartEnd"
              tickCount={activePeriod === 'day' ? 5 : activePeriod === 'week' ? 7 : activePeriod === 'month' ? 6 : 6}
              tick={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fill: 'hsl(var(--muted-foreground))',
              }}
              tickFormatter={(value: number) => {
                const d = new Date(value);
                if (activePeriod === 'day') return format(d, 'HH\'h\'', { locale: pt });
                if (activePeriod === 'week') return format(d, 'EEE', { locale: pt });
                if (activePeriod === 'month') return format(d, 'd', { locale: pt });
                return format(d, 'MMM', { locale: pt });
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
              tick={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fill: 'hsl(var(--muted-foreground))',
              }}
              tickFormatter={(value) => `${value}€`}
              width={50}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              labelFormatter={(label) => {
                const timestamp = Number(label);
                if (Number.isNaN(timestamp)) return '';
                const d = new Date(timestamp);
                if (Number.isNaN(d.getTime())) return '';
                if (activePeriod === 'year') return format(d, 'MMM yyyy', { locale: pt });
                return format(d, 'PPP', { locale: pt });
              }}
              formatter={(value: number) => [`${value.toLocaleString('pt-PT')}€`, 'Faturação']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#chartGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </Card>
  );
}