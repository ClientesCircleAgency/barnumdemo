import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Send,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppointments } from '@/hooks/useAppointments';
import { useProfessionals } from '@/hooks/useProfessionals';
import { useProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';
import { toast } from 'sonner';
import type { ProfessionalRow } from '@/types/database';

export interface SlotSelection {
  date: string;
  time: string;
  professional_id: string;
  professional_name: string;
}

export interface SuggestSlotsSource {
  appointment_id: string;
  name: string;
  specialty_id: string;
  preferred_date: string;
  preferred_time: string;
  duration_minutes: number;
}

interface SuggestAlternativesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: SuggestSlotsSource | null;
  onSubmit: (slots: SlotSelection[]) => Promise<void>;
  title?: string;
  submitLabel?: string;
  singleSelect?: boolean;
}

interface DayAvailability {
  totalSlots: number;
  availableSlots: number;
  status: 'past' | 'empty' | 'healthy' | 'busy' | 'full';
}

const WORKING_HOURS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

const WORKING_WINDOWS = [
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '19:00' },
];

const WEEK_DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function normalizeTime(t: string) {
  return t.slice(0, 5);
}

function slotFitsWorkingWindows(time: string, durationMinutes: number) {
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + durationMinutes;

  return WORKING_WINDOWS.some((window) => {
    const windowStart = timeToMinutes(window.start);
    const windowEnd = timeToMinutes(window.end);
    return slotStart >= windowStart && slotEnd <= windowEnd;
  });
}

function buildSlotKey(professionalId: string, dateStr: string, time: string) {
  return `${professionalId}|${dateStr}|${time}`;
}

function getMonthGrid(monthDate: Date) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const offset = (monthStart.getDay() + 6) % 7;
  const firstGridDay = addDays(monthStart, -offset);
  const totalDays = Math.ceil((offset + monthEnd.getDate()) / 7) * 7;

  return Array.from({ length: totalDays }, (_, index) => addDays(firstGridDay, index));
}

function getDayTone(availability: DayAvailability, isSelected: boolean) {
  if (isSelected) {
    return 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20';
  }

  if (availability.status === 'past') {
    return 'border-slate-100 bg-slate-50 text-slate-300';
  }

  if (availability.status === 'full') {
    return 'border-red-200 bg-red-500 text-white shadow-sm shadow-red-500/20 hover:bg-red-600';
  }

  if (availability.status === 'busy') {
    return 'border-orange-200 bg-orange-400 text-white shadow-sm shadow-orange-400/20 hover:bg-orange-500';
  }

  if (availability.status === 'healthy') {
    return 'border-emerald-200 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600';
  }

  return 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50';
}

function getProfessionalInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function SuggestAlternativesModal({
  open,
  onOpenChange,
  source,
  onSubmit,
  title = 'Sugerir Horários Alternativos',
  submitLabel = 'Enviar Sugestões',
  singleSelect = false,
}: SuggestAlternativesModalProps) {
  const { data: appointments = [] } = useAppointments();
  const { data: professionals = [] } = useProfessionals();
  const { data: profSpecialties = [] } = useProfessionalSpecialties();

  const [selectedSlots, setSelectedSlots] = useState<Map<string, true>>(new Map());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const [isSending, setIsSending] = useState(false);

  const durationMinutes =
    source?.duration_minutes && Number.isFinite(source.duration_minutes)
      ? source.duration_minutes
      : 30;

  const specialtyProfessionals = useMemo(() => {
    if (!source) return [];

    return professionals.filter((professional) => {
      const professionalSpecialtyIds = profSpecialties
        .filter((item) => item.professional_id === professional.id)
        .map((item) => item.specialty_id);
      const acceptedSpecialties = professionalSpecialtyIds.length > 0
        ? professionalSpecialtyIds
        : professional.specialty_id
          ? [professional.specialty_id]
          : [];

      return acceptedSpecialties.includes(source.specialty_id);
    });
  }, [source, professionals, profSpecialties]);

  const activeAppointments = useMemo(
    () => appointments.filter((appointment) => !['cancelled', 'completed', 'no_show'].includes(appointment.status)),
    [appointments],
  );

  useEffect(() => {
    if (!open || !source) return;

    const preferredDate = startOfDay(parseISO(source.preferred_date));
    const safeDate = isBefore(preferredDate, startOfDay(new Date()))
      ? startOfDay(new Date())
      : preferredDate;

    setSelectedSlots(new Map());
    setSelectedDate(safeDate);
    setVisibleMonth(startOfMonth(safeDate));
    setSelectedProfessionalId((current) => {
      if (current && specialtyProfessionals.some((professional) => professional.id === current)) {
        return current;
      }

      return specialtyProfessionals[0]?.id ?? '';
    });
  }, [open, source, specialtyProfessionals]);

  const selectedProfessional = useMemo(
    () => specialtyProfessionals.find((professional) => professional.id === selectedProfessionalId) ?? null,
    [selectedProfessionalId, specialtyProfessionals],
  );

  const isProfFree = (professionalId: string, dateStr: string, time: string) => {
    if (!source || !slotFitsWorkingWindows(time, durationMinutes)) {
      return false;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr === todayStr) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (timeToMinutes(time) <= nowMinutes) {
        return false;
      }
    }

    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + durationMinutes;

    return !activeAppointments.some((appointment) => {
      if (appointment.professional_id !== professionalId || appointment.date !== dateStr) return false;
      if (appointment.id === source.appointment_id) return false;

      const appointmentStart = timeToMinutes(appointment.time);
      const appointmentEnd = appointmentStart + appointment.duration;
      return appointmentStart < slotEnd && appointmentEnd > slotStart;
    });
  };

  const getAvailableSlotsForDay = (professionalId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return WORKING_HOURS.filter((time) => isProfFree(professionalId, dateStr, time));
  };

  const getDayAvailability = (professionalId: string, date: Date): DayAvailability => {
    const today = startOfDay(new Date());
    const dateStr = format(date, 'yyyy-MM-dd');

    if (isBefore(date, today)) {
      return { totalSlots: 0, availableSlots: 0, status: 'past' };
    }

    const totalSlots = WORKING_HOURS.filter((time) => {
      if (!slotFitsWorkingWindows(time, durationMinutes)) return false;

      if (dateStr === format(today, 'yyyy-MM-dd')) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return timeToMinutes(time) > nowMinutes;
      }

      return true;
    }).length;
    const availableSlots = getAvailableSlotsForDay(professionalId, date).length;
    const bookedSlots = Math.max(totalSlots - availableSlots, 0);
    const availableRatio = totalSlots === 0 ? 0 : availableSlots / totalSlots;

    if (totalSlots === 0 || availableSlots === 0) {
      return { totalSlots, availableSlots, status: 'full' };
    }

    if (bookedSlots === 0) {
      return { totalSlots, availableSlots, status: 'empty' };
    }

    if (availableRatio >= 0.8) {
      return { totalSlots, availableSlots, status: 'healthy' };
    }

    return { totalSlots, availableSlots, status: 'busy' };
  };

  const calendarDays = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth]);
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const availabilityByDay = useMemo(() => {
    if (!selectedProfessional) return new Map<string, DayAvailability>();

    return new Map(
      calendarDays.map((day) => [
        format(day, 'yyyy-MM-dd'),
        getDayAvailability(selectedProfessional.id, startOfDay(day)),
      ]),
    );
  }, [calendarDays, selectedProfessional, activeAppointments, durationMinutes, source]);

  const availableTimes = useMemo(() => {
    if (!selectedProfessional) return [];
    return getAvailableSlotsForDay(selectedProfessional.id, selectedDate);
  }, [selectedProfessional, selectedDate, activeAppointments, durationMinutes, source]);

  const professionalAvailability = useMemo(() => {
    return specialtyProfessionals.map((professional) => {
      const monthDays = calendarDays.filter((day) => day.getMonth() === visibleMonth.getMonth());
      const freeDays = monthDays.filter((day) => getAvailableSlotsForDay(professional.id, day).length > 0).length;
      const nextSelectedDaySlots = getAvailableSlotsForDay(professional.id, selectedDate).length;

      return {
        professional,
        freeDays,
        selectedDaySlots: nextSelectedDaySlots,
      };
    });
  }, [specialtyProfessionals, calendarDays, visibleMonth, selectedDate, activeAppointments, durationMinutes, source]);

  const toggleSlot = (professional: ProfessionalRow, date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slotKey = buildSlotKey(professional.id, dateStr, time);

    setSelectedSlots((previous) => {
      const next = singleSelect ? new Map<string, true>() : new Map(previous);

      if (previous.has(slotKey)) {
        next.delete(slotKey);
      } else {
        next.set(slotKey, true);
      }

      return next;
    });
  };

  const handleSend = async () => {
    if (!source) return;
    setIsSending(true);

    try {
      const slots = Array.from(selectedSlots.keys()).map((slotKey) => {
        const [professionalId, date, time] = slotKey.split('|');
        const professional = professionals.find((item) => item.id === professionalId);

        return {
          date,
          time,
          professional_id: professionalId,
          professional_name: professional?.name || '',
        };
      });

      await onSubmit(slots);
      onOpenChange(false);
      setSelectedSlots(new Map());
    } catch {
      toast.error('Erro ao processar');
    } finally {
      setIsSending(false);
    }
  };

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden border-slate-200 bg-[#f4f8fb] p-0 shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-200/80 bg-white/80 px-6 py-5 backdrop-blur">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <MessageCircle className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{source.name}</p>
                <p className="text-sm text-slate-500">
                  Pedido atual: {format(parseISO(source.preferred_date), "d 'de' MMMM", { locale: pt })} às {normalizeTime(source.preferred_time)}
                </p>
              </div>
            </div>
          </div>

          {specialtyProfessionals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500">
              Não há profissionais ativos para esta especialidade.
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">1. Profissional</p>
                  <h3 className="text-lg font-semibold text-slate-900">Escolha quem vai atender</h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {professionalAvailability.map(({ professional, freeDays, selectedDaySlots }) => {
                    const isSelected = selectedProfessionalId === professional.id;

                    return (
                      <button
                        key={professional.id}
                        type="button"
                        onClick={() => setSelectedProfessionalId(professional.id)}
                        className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-slate-900 bg-white shadow-lg shadow-slate-900/10'
                            : 'border-white bg-white/65 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: professional.color || '#0f172a' }}
                        >
                          {getProfessionalInitials(professional.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{professional.name}</p>
                          <p className="text-xs text-slate-500">
                            {selectedDaySlots} hora{selectedDaySlots !== 1 ? 's' : ''} neste dia · {freeDays} dia{freeDays !== 1 ? 's' : ''} com vagas no mês
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                <div className="space-y-3 rounded-3xl border border-white bg-white/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">2. Data</p>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {format(visibleMonth, 'MMMM yyyy', { locale: pt })}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full bg-white"
                        onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full bg-white"
                        onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-slate-400">
                    {WEEK_DAYS.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                      const isSelected = isSameDay(day, selectedDate);
                      const availability = availabilityByDay.get(dayStr) ?? { totalSlots: 0, availableSlots: 0, status: 'past' as const };
                      const isDisabled = availability.status === 'past' || !isCurrentMonth;

                      return (
                        <button
                          key={dayStr}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedDate(startOfDay(day))}
                          className={`group relative flex min-h-14 flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                            isCurrentMonth ? getDayTone(availability, isSelected) : 'border-transparent bg-transparent text-slate-200'
                          }`}
                        >
                          <span>{format(day, 'd')}</span>
                          {isCurrentMonth && availability.status !== 'past' && (
                            <span className="mt-0.5 text-[10px] font-medium opacity-80">
                              {availability.availableSlots}/{availability.totalSlots}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <LegendDot className="bg-white" label="Vazio" />
                    <LegendDot className="bg-emerald-500" label="80% ou mais livre" />
                    <LegendDot className="bg-orange-400" label="Mais lotado" />
                    <LegendDot className="bg-red-500" label="Lotado" />
                  </div>
                </div>

                <div className="space-y-3 rounded-3xl border border-white bg-white/75 p-4 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">3. Hora</p>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      <CalendarIcon className="h-4 w-4 text-slate-500" />
                      {format(selectedDate, "d 'de' MMMM", { locale: pt })}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedProfessional?.name ?? 'Selecione um profissional'}
                    </p>
                  </div>

                  {availableTimes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500">
                      Não há horários livres neste dia. Escolha outro dia no calendário.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                      {availableTimes.map((time) => {
                        if (!selectedProfessional) return null;

                        const slotKey = buildSlotKey(selectedProfessional.id, selectedDateStr, time);
                        const isSelected = selectedSlots.has(slotKey);

                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => toggleSlot(selectedProfessional, selectedDate, time)}
                            className={`flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                              isSelected
                                ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-amber-300 hover:bg-amber-50'
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlots.size > 0 && (
                    <div className="rounded-2xl bg-slate-900 p-3 text-white">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Selecionados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(selectedSlots.keys()).map((slotKey) => {
                          const [professionalId, date, time] = slotKey.split('|');
                          const professional = professionals.find((item) => item.id === professionalId);

                          return (
                            <Badge key={slotKey} className="bg-white/12 text-white hover:bg-white/20">
                              {format(parseISO(date), 'dd/MM')} · {time} · {professional?.name ?? 'Profissional'}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedSlots.size === 0 || isSending}
            className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'A processar...' : `${submitLabel}${selectedSlots.size > 0 && !singleSelect ? ` (${selectedSlots.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5">
      <span className={`h-3 w-3 rounded-full border border-slate-200 ${className}`} />
      <span>{label}</span>
    </div>
  );
}
