import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface GeneralSettings {
  defaultDuration: number;
  bufferTime: number;
  minAdvanceTime: number;
  averageConsultationValue: number;
}

interface EditSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSettings: GeneralSettings;
  onSave: (settings: GeneralSettings) => void;
}

export function EditSettingsModal({
  open,
  onOpenChange,
  initialSettings,
  onSave,
}: EditSettingsModalProps) {
  const [settings, setSettings] = useState<GeneralSettings>(initialSettings);

  const handleSave = () => {
    onSave(settings);
    toast.success('Configurações atualizadas');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configurações Gerais</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Duração padrão */}
          <div className="space-y-2">
            <Label>Duração padrão da consulta</Label>
            <Select
              value={settings.defaultDuration.toString()}
              onValueChange={(v) =>
                setSettings({ ...settings, defaultDuration: parseInt(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="20">20 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">60 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buffer entre consultas */}
          <div className="space-y-2">
            <Label>Buffer entre consultas</Label>
            <Select
              value={settings.bufferTime.toString()}
              onValueChange={(v) =>
                setSettings({ ...settings, bufferTime: parseInt(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem buffer</SelectItem>
                <SelectItem value="5">5 minutos</SelectItem>
                <SelectItem value="10">10 minutos</SelectItem>
                <SelectItem value="15">15 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Antecedência mínima */}
          <div className="space-y-2">
            <Label>Antecedência mínima para agendar</Label>
            <Select
              value={settings.minAdvanceTime.toString()}
              onValueChange={(v) =>
                setSettings({ ...settings, minAdvanceTime: parseInt(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hora</SelectItem>
                <SelectItem value="2">2 horas</SelectItem>
                <SelectItem value="4">4 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor médio por consulta */}
          <div className="space-y-2">
            <Label>Valor médio por consulta (€)</Label>
            <Select
              value={settings.averageConsultationValue.toString()}
              onValueChange={(v) =>
                setSettings({ ...settings, averageConsultationValue: parseInt(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25€</SelectItem>
                <SelectItem value="35">35€</SelectItem>
                <SelectItem value="50">50€</SelectItem>
                <SelectItem value="75">75€</SelectItem>
                <SelectItem value="100">100€</SelectItem>
                <SelectItem value="150">150€</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
