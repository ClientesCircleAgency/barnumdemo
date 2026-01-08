import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon, User, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useClinic } from '@/context/ClinicContext';
import { PatientLookupByNIF } from './PatientLookupByNIF';
import { useToast } from '@/hooks/use-toast';
import type { Patient, AppointmentStatus } from '@/types/clinic';
import { appointmentFormSchema, type AppointmentFormData } from '@/lib/validations/appointment';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface AppointmentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPatient?: Patient | null;
  preselectedDate?: Date | null;
}

export function AppointmentWizard({
  open,
  onOpenChange,
  preselectedPatient,
  preselectedDate,
}: AppointmentWizardProps) {
  const { toast } = useToast();
  const {
    professionals,
    specialties,
    consultationTypes,
    rooms,
    addAppointment,
    getConsultationTypeById,
  } = useClinic();

  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(preselectedPatient || null);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      consultationTypeId: '',
      professionalId: '',
      specialtyId: '',
      date: preselectedDate || new Date(),
      time: '09:00',
      duration: 30,
      notes: '',
      roomId: '',
      sendConfirmation: true,
    },
    mode: 'onChange',
  });

  // Reset form when dialog opens with preselected values
  useEffect(() => {
    if (open) {
      setSelectedPatient(preselectedPatient || null);
      form.reset({
        consultationTypeId: '',
        professionalId: '',
        specialtyId: '',
        date: preselectedDate || new Date(),
        time: '09:00',
        duration: 30,
        notes: '',
        roomId: '',
        sendConfirmation: true,
      });
      setStep(1);
    }
  }, [open, preselectedPatient, preselectedDate, form]);

  const resetForm = () => {
    setStep(1);
    setSelectedPatient(preselectedPatient || null);
    form.reset({
      consultationTypeId: '',
      professionalId: '',
      specialtyId: '',
      date: preselectedDate || new Date(),
      time: '09:00',
      duration: 30,
      notes: '',
      roomId: '',
      sendConfirmation: true,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 200);
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
  };

  const handleNextStep = () => {
    if (step === 1 && selectedPatient) {
      setStep(2);
    }
  };

  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleConsultationTypeChange = (typeId: string) => {
    const type = getConsultationTypeById(typeId);
    form.setValue('consultationTypeId', typeId);
    form.setValue('duration', type?.defaultDuration || 30);
  };

  const handleCreateAppointment = (data: AppointmentFormData, createAnother: boolean = false) => {
    if (!selectedPatient) {
      toast({
        title: 'Erro',
        description: 'Selecione um paciente primeiro.',
        variant: 'destructive',
      });
      return;
    }

    addAppointment({
      patientId: selectedPatient.id,
      professionalId: data.professionalId,
      specialtyId: data.specialtyId || specialties[0]?.id || '',
      consultationTypeId: data.consultationTypeId,
      date: format(data.date, 'yyyy-MM-dd'),
      time: data.time,
      duration: data.duration,
      status: 'scheduled' as AppointmentStatus,
      notes: data.notes?.trim() || undefined,
      roomId: data.roomId || undefined,
    });

    toast({
      title: 'Consulta criada',
      description: `Consulta agendada para ${format(data.date, "d 'de' MMMM", { locale: pt })} às ${data.time}`,
    });

    if (createAnother) {
      resetForm();
    } else {
      handleClose();
    }
  };

  // Gerar lista de horários
  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <User className="h-5 w-5" />
                Nova Consulta - Identificar Paciente
              </>
            ) : (
              <>
                <CalendarIcon className="h-5 w-5" />
                Nova Consulta - Detalhes
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-2">
          <div
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium',
              step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {step > 1 ? <Check className="h-4 w-4" /> : '1'}
          </div>
          <div className={cn('flex-1 h-1 rounded', step > 1 ? 'bg-primary' : 'bg-muted')} />
          <div
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium',
              step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            2
          </div>
        </div>

        {/* Passo 1 - Identificar Paciente */}
        {step === 1 && (
          <div className="space-y-4">
            <PatientLookupByNIF
              onPatientSelect={handlePatientSelect}
              selectedPatient={selectedPatient}
              onClear={() => setSelectedPatient(null)}
            />

            <div className="flex justify-end pt-4">
              <Button onClick={handleNextStep} disabled={!selectedPatient}>
                Continuar
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Passo 2 - Detalhes da Marcação */}
        {step === 2 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => handleCreateAppointment(data, false))} className="space-y-4">
              {/* Info do paciente selecionado */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-medium">{selectedPatient?.name}</p>
              </div>

              {/* Tipo de Consulta */}
              <FormField
                control={form.control}
                name="consultationTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Consulta *</FormLabel>
                    <Select value={field.value} onValueChange={handleConsultationTypeChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        {consultationTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.defaultDuration} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Profissional */}
              <FormField
                control={form.control}
                name="professionalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissional *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar profissional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        {professionals.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: prof.color }} />
                              {prof.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Especialidade */}
              <FormField
                control={form.control}
                name="specialtyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar especialidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        {specialties.map((spec) => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(field.value, 'dd/MM/yyyy', { locale: pt })}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => date && field.onChange(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50 max-h-60">
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Duração e Sala */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração</FormLabel>
                      <Select
                        value={field.value.toString()}
                        onValueChange={(v) => field.onChange(parseInt(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="30">30 minutos</SelectItem>
                          <SelectItem value="45">45 minutos</SelectItem>
                          <SelectItem value="60">60 minutos</SelectItem>
                          <SelectItem value="90">90 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roomId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sala/Gabinete</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Notas sobre a marcação..."
                        rows={3}
                        maxLength={1000}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Enviar confirmação */}
              <FormField
                control={form.control}
                name="sendConfirmation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Enviar confirmação ao paciente (SMS/Email)
                    </FormLabel>
                  </FormItem>
                )}
              />

              {/* Botões */}
              <div className="flex justify-between pt-4 gap-2">
                <Button type="button" variant="outline" onClick={handlePrevStep}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={form.handleSubmit((data) => handleCreateAppointment(data, true))}
                  >
                    Criar e Criar Outra
                  </Button>
                  <Button type="submit">
                    Criar Consulta
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
