import { useState, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, Clock, MessageCircle, Send, User } from 'lucide-react';
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
import { useAppointments } from '@/hooks/useAppointments';
import { useProfessionals } from '@/hooks/useProfessionals';
import { useProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';
import { useSpecialties } from '@/hooks/useSpecialties';
import { useAddAppointmentSuggestion } from '@/hooks/useAppointmentSuggestions';
import { toast } from 'sonner';
import type { AppointmentRequest } from '@/hooks/useAppointmentRequests';

interface SuggestAlternativesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AppointmentRequest | null;
}

interface TimeSlot {
  date: Date;
  time: string;
  isAvailable: boolean;
}

const WORKING_HOURS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

export function SuggestAlternativesModal({
  open,
  onOpenChange,
  request,
}: SuggestAlternativesModalProps) {
  const { data: appointments = [] } = useAppointments();
  const { data: professionals = [] } = useProfessionals();
  const { data: profSpecialties = [] } = useProfessionalSpecialties();
  const { data: specialties = [] } = useSpecialties();
  const addSuggestion = useAddAppointmentSuggestion();
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'same-time' | 'same-day'>('same-time');
  const [isSending, setIsSending] = useState(false);

  // Get professional IDs that serve this request's specialty
  const specialtyProfIds = useMemo(() => {
    if (!request) return new Set<string>();
    const ids = new Set<string>();

    for (const p of professionals) {
      const pSpecIds = profSpecialties
        .filter(ps => ps.professional_id === p.id)
        .map(ps => ps.specialty_id);
      const allIds = pSpecIds.length > 0 ? pSpecIds : (p.specialty_id ? [p.specialty_id] : []);
      if (allIds.includes(request.specialty_id)) ids.add(p.id);
    }

    return ids;
  }, [request, professionals, profSpecialties]);

  // Only count appointments from professionals of this specialty as blocking
  const specialtyAppointments = useMemo(() =>
    appointments.filter(apt => specialtyProfIds.has(apt.professional_id)),
    [appointments, specialtyProfIds]
  );

  // A slot is unavailable only if ALL professionals of this specialty are busy
  const isSlotFullyBooked = (dateStr: string, time: string): boolean => {
    if (specialtyProfIds.size === 0) return true;

    for (const profId of specialtyProfIds) {
      const profBusy = specialtyAppointments.some(
        apt => apt.professional_id === profId && apt.date === dateStr && apt.time === time
      );
      if (!profBusy) return false; // At least one professional is free
    }
    return true; // All professionals are busy
  };

  const sameTimeSlots = useMemo(() => {
    if (!request) return [];

    const requestedTime = request.preferred_time;
    const slots: TimeSlot[] = [];

    for (let i = 1; i <= 14; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');

      slots.push({
        date,
        time: requestedTime,
        isAvailable: !isSlotFullyBooked(dateStr, requestedTime),
      });
    }

    return slots.filter(s => s.isAvailable);
  }, [request, specialtyAppointments, specialtyProfIds]);

  const sameDaySlots = useMemo(() => {
    if (!request) return [];

    const requestedDate = parseISO(request.preferred_date);
    const dateStr = format(requestedDate, 'yyyy-MM-dd');

    const slots: TimeSlot[] = WORKING_HOURS.map(time => ({
      date: requestedDate,
      time,
      isAvailable: !isSlotFullyBooked(dateStr, time) && time !== request.preferred_time,
    }));

    return slots.filter(s => s.isAvailable);
  }, [request, specialtyAppointments, specialtyProfIds]);

  const toggleSlot = (slotKey: string) => {
    setSelectedSlots(prev =>
      prev.includes(slotKey)
        ? prev.filter(s => s !== slotKey)
        : [...prev, slotKey]
    );
  };

  const handleSend = async () => {
    if (!request) return;
    setIsSending(true);

    try {
      const slots = selectedSlots.map(slotKey => {
        const [dateStr, time] = slotKey.split('|');
        return { date: dateStr, time };
      });

      const specialtyName = specialties.find(s => s.id === request.specialty_id)?.name ?? null;

      await addSuggestion.mutateAsync({
        appointment_request_id: request.id,
        suggested_slots: slots,
        status: 'pending',
        patient_name: request.name,
        patient_email: request.email,
        patient_phone: request.phone,
        patient_nif: request.nif,
        specialty_id: request.specialty_id,
        specialty_name: specialtyName,
        preferred_date: request.preferred_date,
        preferred_time: request.preferred_time,
        reason: request.reason,
        estimated_duration: request.estimated_duration,
        professional_name: request.professional_name,
      });

      toast.success('Sugestões guardadas com sucesso');
      onOpenChange(false);
      setSelectedSlots([]);
    } catch {
      toast.error('Erro ao guardar sugestões');
    } finally {
      setIsSending(false);
    }
  };

  const currentSlots = activeTab === 'same-time' ? sameTimeSlots : sameDaySlots;

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Sugerir Horários Alternativos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{request.name}</p>
                <p className="text-sm text-muted-foreground">
                  Pediu: {format(parseISO(request.preferred_date), "d MMM", { locale: pt })} às {request.preferred_time}
                </p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'same-time' | 'same-day')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="same-time" className="gap-2">
                <Clock className="h-4 w-4" />
                Mesmo horário
              </TabsTrigger>
              <TabsTrigger value="same-day" className="gap-2">
                <Calendar className="h-4 w-4" />
                Mesmo dia
              </TabsTrigger>
            </TabsList>

            <TabsContent value="same-time" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Próximos dias com disponibilidade às {request.preferred_time}:
              </p>
            </TabsContent>
            <TabsContent value="same-day" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Horários disponíveis em {format(parseISO(request.preferred_date), "d 'de' MMMM", { locale: pt })}:
              </p>
            </TabsContent>
          </Tabs>

          {currentSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Não há horários disponíveis nesta opção
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {currentSlots.map((slot) => {
                const slotKey = `${format(slot.date, 'yyyy-MM-dd')}|${slot.time}`;
                const isSelected = selectedSlots.includes(slotKey);

                return (
                  <Card
                    key={slotKey}
                    className={`p-3 cursor-pointer transition-all ${isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:border-primary/50'
                      }`}
                    onClick={() => toggleSlot(slotKey)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {activeTab === 'same-time'
                            ? format(slot.date, "EEE, d MMM", { locale: pt })
                            : slot.time
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeTab === 'same-time'
                            ? slot.time
                            : format(slot.date, "d MMM", { locale: pt })
                          }
                        </p>
                      </div>
                      {isSelected && (
                        <Badge className="bg-primary text-primary-foreground">✓</Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedSlots.length === 0 || isSending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'A enviar...' : 'Enviar Sugestões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
