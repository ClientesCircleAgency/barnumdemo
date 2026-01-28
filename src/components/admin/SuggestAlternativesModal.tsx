import { useState, useMemo } from 'react';
import { format, addDays, parse, isSameDay } from 'date-fns';
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
import type { AppointmentRequest } from '@/hooks/useAppointmentRequests';

interface SuggestAlternativesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AppointmentRequest | null;
  onSendWhatsApp: (message: string, phone: string) => void;
}

interface TimeSlot {
  date: Date;
  time: string;
  isAvailable: boolean;
}

const WORKING_HOURS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00'
];

export function SuggestAlternativesModal({
  open,
  onOpenChange,
  request,
  onSendWhatsApp,
}: SuggestAlternativesModalProps) {
  const { data: appointments = [] } = useAppointments();
  const { data: professionals = [] } = useProfessionals();
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'same-time' | 'same-day'>('same-time');

  // Find available slots at the same time on different days
  const sameTimeSlots = useMemo(() => {
    if (!request) return [];

    const requestedTime = request.preferred_time;
    const slots: TimeSlot[] = [];

    for (let i = 1; i <= 14; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Check if this time slot is available
      const hasAppointment = appointments.some(
        apt => apt.date === dateStr && apt.time === requestedTime
      );

      slots.push({
        date,
        time: requestedTime,
        isAvailable: !hasAppointment,
      });
    }

    return slots.filter(s => s.isAvailable).slice(0, 6);
  }, [request, appointments]);

  // Find available slots on the same day at different times
  const sameDaySlots = useMemo(() => {
    if (!request) return [];

    const requestedDate = new Date(request.preferred_date);
    const dateStr = format(requestedDate, 'yyyy-MM-dd');

    const slots: TimeSlot[] = WORKING_HOURS.map(time => {
      const hasAppointment = appointments.some(
        apt => apt.date === dateStr && apt.time === time
      );

      return {
        date: requestedDate,
        time,
        isAvailable: !hasAppointment && time !== request.preferred_time,
      };
    });

    return slots.filter(s => s.isAvailable).slice(0, 8);
  }, [request, appointments]);

  const toggleSlot = (slotKey: string) => {
    setSelectedSlots(prev =>
      prev.includes(slotKey)
        ? prev.filter(s => s !== slotKey)
        : [...prev, slotKey]
    );
  };

  const generateWhatsAppMessage = () => {
    if (!request || selectedSlots.length === 0) return '';

    const slotsText = selectedSlots.map(slotKey => {
      const [dateStr, time] = slotKey.split('|');
      const date = new Date(dateStr);
      return `• ${format(date, "EEEE, d 'de' MMMM", { locale: pt })} às ${time}`;
    }).join('\n');

    return `Olá ${request.name.split(' ')[0]}! 👋

Obrigado pelo seu pedido de marcação.

Infelizmente, o horário que solicitou (${format(new Date(request.preferred_date), "d 'de' MMMM", { locale: pt })} às ${request.preferred_time}) não está disponível.

Temos disponibilidade nos seguintes horários:
${slotsText}

Para confirmar, responda com o número da opção pretendida ou contacte-nos.

Clínica Barnun`;
  };

  const handleSend = () => {
    if (!request) return;
    const message = generateWhatsAppMessage();
    onSendWhatsApp(message, request.phone);
    onOpenChange(false);
    setSelectedSlots([]);
  };

  const currentSlots = activeTab === 'same-time' ? sameTimeSlots : sameDaySlots;

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Sugerir Horários Alternativos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{request.name}</p>
                <p className="text-sm text-muted-foreground">
                  Pediu: {format(new Date(request.preferred_date), "d MMM", { locale: pt })} às {request.preferred_time}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs for different suggestion types */}
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
                Horários disponíveis em {format(new Date(request.preferred_date), "d 'de' MMMM", { locale: pt })}:
              </p>
            </TabsContent>
          </Tabs>

          {/* Available Slots */}
          {currentSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Não há horários disponíveis nesta opção
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
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

          {/* Message Preview */}
          {selectedSlots.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-medium text-green-800 mb-2">Pré-visualização da mensagem:</p>
              <p className="text-xs text-green-700 whitespace-pre-line line-clamp-4">
                {generateWhatsAppMessage()}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedSlots.length === 0}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Send className="h-4 w-4" />
            Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
