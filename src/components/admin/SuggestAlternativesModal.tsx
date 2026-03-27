import { useState, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, Clock, MessageCircle, Send, User, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  name: string;
  specialty_id: string;
  preferred_date: string;
  preferred_time: string;
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

interface ProfessionalSlot {
  date: Date;
  time: string;
  professional: ProfessionalRow;
}

const WORKING_HOURS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

const SLOT_DURATION = 30;

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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

  // slotKey = "yyyy-MM-dd|HH:mm", value = professional id
  const [selectedSlots, setSelectedSlots] = useState<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState<'by-professional' | 'same-day'>('by-professional');
  const [isSending, setIsSending] = useState(false);

  // Professionals that serve this source's specialty
  const specialtyProfessionals = useMemo(() => {
    if (!source) return [];
    return professionals.filter(p => {
      const pSpecIds = profSpecialties
        .filter(ps => ps.professional_id === p.id)
        .map(ps => ps.specialty_id);
      const allIds = pSpecIds.length > 0 ? pSpecIds : (p.specialty_id ? [p.specialty_id] : []);
      return allIds.includes(source.specialty_id);
    });
  }, [source, professionals, profSpecialties]);

  // Active appointments (exclude cancelled/completed/no_show)
  const activeAppointments = useMemo(() =>
    appointments.filter(apt =>
      !['cancelled', 'completed', 'no_show'].includes(apt.status)
    ),
    [appointments]
  );

  // Check if a specific professional is free at a given date/time
  const isProfFree = (profId: string, dateStr: string, time: string): boolean => {
    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + SLOT_DURATION;

    return !activeAppointments.some(apt => {
      if (apt.professional_id !== profId || apt.date !== dateStr) return false;
      const aptStart = timeToMinutes(apt.time);
      const aptEnd = aptStart + apt.duration;
      return aptStart < slotEnd && aptEnd > slotStart;
    });
  };

  // TAB 1: By professional — next 14 days, grouped by professional
  const byProfessionalData = useMemo(() => {
    if (!source) return [];

    return specialtyProfessionals.map(prof => {
      const slots: ProfessionalSlot[] = [];

      for (let i = 0; i <= 14; i++) {
        const date = addDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');

        for (const time of WORKING_HOURS) {
          if (isProfFree(prof.id, dateStr, time)) {
            slots.push({ date, time, professional: prof });
          }
        }
      }

      return { professional: prof, slots };
    });
  }, [source, specialtyProfessionals, activeAppointments]);

  // TAB 2: Same day — all professionals' availability on the requested date
  const sameDayData = useMemo(() => {
    if (!source) return [];

    const requestedDate = parseISO(source.preferred_date);
    const dateStr = format(requestedDate, 'yyyy-MM-dd');

    return specialtyProfessionals.map(prof => {
      const slots: ProfessionalSlot[] = [];

      for (const time of WORKING_HOURS) {
        if (time !== source.preferred_time && isProfFree(prof.id, dateStr, time)) {
          slots.push({ date: requestedDate, time, professional: prof });
        }
      }

      return { professional: prof, slots };
    });
  }, [source, specialtyProfessionals, activeAppointments]);

  const currentData = activeTab === 'by-professional' ? byProfessionalData : sameDayData;

  const toggleSlot = (slotKey: string, profId: string) => {
    setSelectedSlots(prev => {
      const next = singleSelect ? new Map<string, string>() : new Map(prev);
      if (prev.get(slotKey) === profId) {
        next.delete(slotKey);
      } else {
        next.set(slotKey, profId);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (!source) return;
    setIsSending(true);

    try {
      const slots = Array.from(selectedSlots.entries()).map(([slotKey, profId]) => {
        const [dateStr, time] = slotKey.split('|');
        const prof = professionals.find(p => p.id === profId);
        return { date: dateStr, time, professional_id: profId, professional_name: prof?.name || '' };
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

  const totalAvailable = currentData.reduce((sum, d) => sum + d.slots.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden flex flex-col min-h-0">
          {/* Patient info */}
          <div className="p-3 bg-muted/50 rounded-lg shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-muted-foreground">
                  Atual: {format(parseISO(source.preferred_date), "d MMM", { locale: pt })} às {source.preferred_time}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'by-professional' | 'same-day')}
            className="flex flex-col min-h-0 overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-2 shrink-0">
              <TabsTrigger value="by-professional" className="gap-2">
                <User className="h-4 w-4" />
                Por Profissional
              </TabsTrigger>
              <TabsTrigger value="same-day" className="gap-2">
                <Calendar className="h-4 w-4" />
                Mesmo Dia
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 overflow-y-auto min-h-0 pr-1">
              <TabsContent value="by-professional" className="mt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Disponibilidade dos próximos 14 dias por profissional:
                </p>
              </TabsContent>
              <TabsContent value="same-day" className="mt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Disponibilidade em {format(parseISO(source.preferred_date), "d 'de' MMMM", { locale: pt })} por profissional:
                </p>
              </TabsContent>

              {totalAvailable === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Não há horários disponíveis nesta opção
                </div>
              ) : (
                <div className="space-y-4">
                  {currentData.map(({ professional, slots }) => (
                    <ProfessionalSlotsSection
                      key={professional.id}
                      professional={professional}
                      slots={slots}
                      selectedSlots={selectedSlots}
                      onToggleSlot={toggleSlot}
                      activeTab={activeTab}
                    />
                  ))}
                </div>
              )}
            </div>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedSlots.size === 0 || isSending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'A processar...' : `${submitLabel}${selectedSlots.size > 0 && !singleSelect ? ` (${selectedSlots.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfessionalSlotsSection({
  professional,
  slots,
  selectedSlots,
  onToggleSlot,
  activeTab,
}: {
  professional: ProfessionalRow;
  slots: ProfessionalSlot[];
  selectedSlots: Map<string, string>;
  onToggleSlot: (slotKey: string, profId: string) => void;
  activeTab: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (slots.length === 0) return null;

  // Group slots by date for the "by-professional" tab
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, ProfessionalSlot[]>();
    for (const slot of slots) {
      const dateStr = format(slot.date, 'yyyy-MM-dd');
      const existing = grouped.get(dateStr) || [];
      existing.push(slot);
      grouped.set(dateStr, existing);
    }
    return grouped;
  }, [slots]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Professional header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: professional.color || '#6366f1' }}
          >
            {professional.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-medium text-sm">{professional.name}</p>
            <p className="text-xs text-muted-foreground">
              {slots.length} horário{slots.length !== 1 ? 's' : ''} disponíve{slots.length !== 1 ? 'is' : 'l'}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Slots */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {activeTab === 'by-professional' ? (
            // Group by date
            Array.from(slotsByDate.entries()).map(([dateStr, dateSlots]) => (
              <div key={dateStr}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {format(parseISO(dateStr), "EEE, d MMM", { locale: pt })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dateSlots.map((slot) => {
                    const slotKey = `${dateStr}|${slot.time}`;
                    const isSelected = selectedSlots.get(slotKey) === professional.id;

                    return (
                      <button
                        key={slotKey}
                        onClick={() => onToggleSlot(slotKey, professional.id)}
                        className={`px-2.5 py-1 rounded-md text-sm font-medium transition-all ${
                          isSelected
                            ? 'text-white shadow-sm'
                            : 'bg-muted/50 text-foreground hover:bg-muted'
                        }`}
                        style={isSelected ? { backgroundColor: professional.color || '#6366f1' } : undefined}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            // Same day — flat list
            <div className="flex flex-wrap gap-1.5">
              {slots.map((slot) => {
                const slotKey = `${format(slot.date, 'yyyy-MM-dd')}|${slot.time}`;
                const isSelected = selectedSlots.get(slotKey) === professional.id;

                return (
                  <button
                    key={slotKey}
                    onClick={() => onToggleSlot(slotKey, professional.id)}
                    className={`px-2.5 py-1 rounded-md text-sm font-medium transition-all ${
                      isSelected
                        ? 'text-white shadow-sm'
                        : 'bg-muted/50 text-foreground hover:bg-muted'
                    }`}
                    style={isSelected ? { backgroundColor: professional.color || '#6366f1' } : undefined}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
