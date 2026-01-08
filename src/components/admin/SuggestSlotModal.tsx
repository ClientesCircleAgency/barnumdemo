import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User } from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import { format, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { WaitlistItem } from '@/types/clinic';

interface SuggestSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waitlistItem: WaitlistItem | null;
  onSelectSlot: (date: Date, time: string, professionalId: string) => void;
}

interface SuggestedSlot {
  date: Date;
  time: string;
  professionalId: string;
  professionalName: string;
  professionalColor: string;
}

export function SuggestSlotModal({
  open,
  onOpenChange,
  waitlistItem,
  onSelectSlot,
}: SuggestSlotModalProps) {
  const { appointments, professionals, getPatientById } = useClinic();

  const patient = waitlistItem ? getPatientById(waitlistItem.patientId) : null;

  // Gerar slots sugeridos baseado nas preferências
  const suggestedSlots = useMemo((): SuggestedSlot[] => {
    if (!waitlistItem) return [];

    const slots: SuggestedSlot[] = [];
    const today = new Date();
    const relevantProfessionals = waitlistItem.professionalId
      ? professionals.filter((p) => p.id === waitlistItem.professionalId)
      : professionals;

    // Gerar horários para os próximos 7 dias úteis
    for (let dayOffset = 1; dayOffset <= 14 && slots.length < 6; dayOffset++) {
      const date = addDays(today, dayOffset);
      const dayOfWeek = date.getDay();
      
      // Ignorar domingos
      if (dayOfWeek === 0) continue;

      const dateStr = format(date, 'yyyy-MM-dd');

      // Horários base dependendo da preferência
      let timeSlots: string[] = [];
      if (waitlistItem.timePreference === 'morning') {
        timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
      } else if (waitlistItem.timePreference === 'afternoon') {
        timeSlots = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
      } else {
        timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
      }

      // Sábados só manhã
      if (dayOfWeek === 6) {
        timeSlots = timeSlots.filter((t) => t < '13:00');
      }

      for (const prof of relevantProfessionals) {
        for (const time of timeSlots) {
          // Verificar se slot está livre
          const isOccupied = appointments.some(
            (apt) =>
              apt.date === dateStr &&
              apt.professionalId === prof.id &&
              apt.time === time &&
              apt.status !== 'cancelled'
          );

          if (!isOccupied && slots.length < 6) {
            slots.push({
              date,
              time,
              professionalId: prof.id,
              professionalName: prof.name,
              professionalColor: prof.color,
            });
          }
        }
      }
    }

    return slots;
  }, [waitlistItem, appointments, professionals]);

  if (!waitlistItem || !patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sugerir Encaixe</DialogTitle>
          <DialogDescription>
            Slots disponíveis para {patient.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Info do paciente */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {waitlistItem.timePreference === 'morning'
                ? 'Prefere manhã'
                : waitlistItem.timePreference === 'afternoon'
                ? 'Prefere tarde'
                : 'Horário flexível'}
            </Badge>
          </div>

          {/* Slots sugeridos */}
          {suggestedSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Não foram encontrados slots disponíveis</p>
              <p className="text-sm">Tente ajustar as preferências ou verificar manualmente</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {suggestedSlots.map((slot, idx) => (
                <Card
                  key={idx}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => onSelectSlot(slot.date, slot.time, slot.professionalId)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(slot.date, "EEEE, d 'de' MMMM", { locale: pt })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{slot.time}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: slot.professionalColor }}
                      />
                      <span className="text-muted-foreground">{slot.professionalName}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
