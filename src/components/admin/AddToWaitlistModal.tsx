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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useClinic } from '@/context/ClinicContext';
import { PatientLookupByNIF } from './PatientLookupByNIF';
import { toast } from 'sonner';
import type { Patient, TimePreference, WaitlistPriority } from '@/types/clinic';

interface AddToWaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToWaitlistModal({ open, onOpenChange }: AddToWaitlistModalProps) {
  const { specialties, professionals, addToWaitlist } = useClinic();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [specialtyId, setSpecialtyId] = useState<string>('');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [timePreference, setTimePreference] = useState<TimePreference>('any');
  const [priority, setPriority] = useState<WaitlistPriority>('medium');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }

    addToWaitlist({
      patientId: selectedPatient.id,
      specialtyId: specialtyId || undefined,
      professionalId: professionalId || undefined,
      timePreference,
      priority,
      reason: reason || undefined,
    });

    toast.success('Paciente adicionado à lista de espera');
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setSpecialtyId('');
    setProfessionalId('');
    setTimePreference('any');
    setPriority('medium');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar à Lista de Espera</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Paciente */}
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <PatientLookupByNIF
              selectedPatient={selectedPatient}
              onPatientSelect={setSelectedPatient}
              onClear={() => setSelectedPatient(null)}
            />
          </div>

          {/* Especialidade */}
          <div className="space-y-2">
            <Label>Especialidade (opcional)</Label>
            <Select value={specialtyId} onValueChange={setSpecialtyId}>
              <SelectTrigger>
                <SelectValue placeholder="Qualquer especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Qualquer</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profissional */}
          <div className="space-y-2">
            <Label>Profissional (opcional)</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Qualquer profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Qualquer</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preferência de Horário */}
          <div className="space-y-2">
            <Label>Preferência de Horário</Label>
            <RadioGroup
              value={timePreference}
              onValueChange={(v) => setTimePreference(v as TimePreference)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="morning" id="morning" />
                <Label htmlFor="morning" className="font-normal">Manhã</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="afternoon" id="afternoon" />
                <Label htmlFor="afternoon" className="font-normal">Tarde</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="any" id="any" />
                <Label htmlFor="any" className="font-normal">Qualquer</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <RadioGroup
              value={priority}
              onValueChange={(v) => setPriority(v as WaitlistPriority)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="font-normal text-green-600">Baixa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="font-normal text-yellow-600">Média</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="font-normal text-red-600">Alta</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo / Observações</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Aguarda desistência para consulta esta semana..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedPatient}>
            Adicionar à Lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
