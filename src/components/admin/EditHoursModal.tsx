import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface WorkingDay {
  day: string;
  start: string;
  end: string;
  enabled: boolean;
}

interface EditHoursModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHours: WorkingDay[];
  onSave: (hours: WorkingDay[]) => void;
}

export function EditHoursModal({
  open,
  onOpenChange,
  initialHours,
  onSave,
}: EditHoursModalProps) {
  const [hours, setHours] = useState<WorkingDay[]>(initialHours);

  const handleToggle = (index: number) => {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, enabled: !h.enabled } : h))
    );
  };

  const handleTimeChange = (index: number, field: 'start' | 'end', value: string) => {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  };

  const handleSave = () => {
    // Validar horários
    for (const h of hours) {
      if (h.enabled && h.start >= h.end) {
        toast.error(`Horário inválido para ${h.day}: início deve ser antes do fim`);
        return;
      }
    }
    onSave(hours);
    toast.success('Horários atualizados');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Horários de Funcionamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {hours.map((schedule, index) => (
            <div
              key={schedule.day}
              className={`flex items-center gap-4 p-3 rounded-lg border ${
                schedule.enabled ? 'border-border' : 'border-border/50 bg-muted/30'
              }`}
            >
              <Switch
                checked={schedule.enabled}
                onCheckedChange={() => handleToggle(index)}
              />
              <span className={`w-20 font-medium ${!schedule.enabled && 'text-muted-foreground'}`}>
                {schedule.day}
              </span>
              {schedule.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={schedule.start}
                    onChange={(e) => handleTimeChange(index, 'start', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={schedule.end}
                    onChange={(e) => handleTimeChange(index, 'end', e.target.value)}
                    className="w-28"
                  />
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Fechado</span>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
