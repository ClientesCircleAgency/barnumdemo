import React, { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import { useClinic } from '@/context/ClinicContext';
import { useAuth } from '@/hooks/useAuth';
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
  const { user, isDoctor } = useAuth();
  const {
    professionals,
    specialties,
    consultationTypes,
    addAppointment,
  } = useClinic();

  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(preselectedPatient || null);

  const doctorProfessionalId = useMemo(
    () =>
      isDoctor
        ? professionals.find((professional) => professional.userId === user?.id)?.id || ''
        : '',
    [isDoctor, professionals, user?.id]
  );

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
      sendConfirmation: true,
    },
    mode: 'onChange',
  });

  const selectedSpecialtyId = form.watch('specialtyId');
  const selectedProfessionalId = form.watch('professionalId');

  const availableConsultationTypes = useMemo(
    () =>
      selectedSpecialtyId
        ? consultationTypes.filter((type) => type.specialtyId === selectedSpecialtyId)
        : [],
    [consultationTypes, selectedSpecialtyId]
  );

  const availableProfessionals = useMemo(
    () =>
      professionals.filter((professional) => {
        if (isDoctor && professional.id !== doctorProfessionalId) {
          return false;
        }

        if (!selectedSpecialtyId) {
          return true;
        }

        return (
          professional.specialtyIds.includes(selectedSpecialtyId) ||
          professional.specialty === selectedSpecialtyId
        );
      }),
    [doctorProfessionalId, isDoctor, professionals, selectedSpecialtyId]
  );

  useEffect(() => {
    if (!open) return;

    setSelectedPatient(preselectedPatient || null);
    form.reset({
      consultationTypeId: '',
      professionalId: doctorProfessionalId,
      specialtyId: '',
      date: preselectedDate || new Date(),
      time: '09:00',
      duration: 30,
      notes: '',
      sendConfirmation: true,
    });
    setStep(1);
  }, [open, preselectedPatient, preselectedDate, form, doctorProfessionalId]);

  useEffect(() => {
    if (!open || !doctorProfessionalId) return;
    form.setValue('professionalId', doctorProfessionalId, { shouldValidate: true });
  }, [doctorProfessionalId, form, open]);

  useEffect(() => {
    if (
      selectedProfessionalId &&
      !availableProfessionals.some((professional) => professional.id === selectedProfessionalId)
    ) {
      form.setValue('professionalId', doctorProfessionalId, { shouldValidate: true });
    }
  }, [availableProfessionals, doctorProfessionalId, form, selectedProfessionalId]);

  useEffect(() => {
    const currentConsultationTypeId = form.getValues('consultationTypeId');
    if (
      currentConsultationTypeId &&
      !availableConsultationTypes.some((type) => type.id === currentConsultationTypeId)
    ) {
      form.setValue('consultationTypeId', '', { shouldValidate: true });
    }
  }, [availableConsultationTypes, form]);

  const resetForm = () => {
    setStep(1);
    setSelectedPatient(preselectedPatient || null);
    form.reset({
      consultationTypeId: '',
      professionalId: doctorProfessionalId,
      specialtyId: '',
      date: preselectedDate || new Date(),
      time: '09:00',
      duration: 30,
      notes: '',
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
    form.setValue('consultationTypeId', typeId, { shouldValidate: true });
  };

  const handleSpecialtyChange = (specialtyId: string) => {
    form.setValue('specialtyId', specialtyId, { shouldValidate: true });
    form.setValue('consultationTypeId', '', { shouldValidate: true });

    const fallbackProfessionalId =
      isDoctor && doctorProfessionalId ? doctorProfessionalId : '';

    if (
      selectedProfessionalId &&
      !professionals.some((professional) => {
        if (professional.id !== selectedProfessionalId) return false;
        return (
          professional.specialtyIds.includes(specialtyId) ||
          professional.specialty === specialtyId
        );
      })
    ) {
      form.setValue('professionalId', fallbackProfessionalId, { shouldValidate: true });
    }
  };

  const handleCreateAppointment = async (
    data: AppointmentFormData,
    createAnother: boolean = false
  ) => {
    if (!selectedPatient) {
      toast({
        title: 'Erro',
        description: 'Selecione um paciente primeiro.',
        variant: 'destructive',
      });
      return;
    }

    const specialtyId =
      data.specialtyId ||
      consultationTypes.find((type) => type.id === data.consultationTypeId)?.specialtyId ||
      '';

    if (!specialtyId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma especialidade valida para esta consulta.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addAppointment({
        patientId: selectedPatient.id,
        professionalId: data.professionalId,
        specialtyId,
        consultationTypeId: data.consultationTypeId,
        date: format(data.date, 'yyyy-MM-dd'),
        time: data.time,
        duration: data.duration,
        status: 'confirmed' as AppointmentStatus,
        notes: data.notes?.trim() || undefined,
      });

      toast({
        title: 'Consulta criada',
        description: `Consulta agendada para ${format(data.date, "d 'de' MMMM", { locale: pt })} as ${data.time}`,
      });

      if (createAnother) {
        resetForm();
      } else {
        handleClose();
      }
    } catch (error) {
      toast({
        title: 'Erro ao criar consulta',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

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

        {step === 2 && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => handleCreateAppointment(data, false))}
              className="space-y-4"
            >
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-medium">{selectedPatient?.name}</p>
              </div>

              <FormField
                control={form.control}
                name="specialtyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade *</FormLabel>
                    <Select value={field.value} onValueChange={handleSpecialtyChange}>
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

              <FormField
                control={form.control}
                name="consultationTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Consulta *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={handleConsultationTypeChange}
                      disabled={!selectedSpecialtyId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              selectedSpecialtyId
                                ? 'Selecionar tipo'
                                : 'Selecione primeiro a especialidade'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        {availableConsultationTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="professionalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissional *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isDoctor && !!doctorProfessionalId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar profissional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        {availableProfessionals.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: prof.color }}
                              />
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
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duracao</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={5}
                          max={1440}
                          step={5}
                          inputMode="numeric"
                          value={Number.isFinite(field.value) ? field.value : ''}
                          onChange={(event) => {
                            const value = event.target.value;
                            field.onChange(value === '' ? NaN : Number.parseInt(value, 10));
                          }}
                          placeholder="Ex: 180"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Introduza a duracao real da consulta em minutos.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observacoes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Notas sobre a marcacao..."
                        rows={3}
                        maxLength={1000}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                A confirmacao automatica desta consulta continua a ser controlada pelos fluxos do
                n8n. A opcao visual foi removida para evitar falsas expectativas.
              </div>

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
                  <Button type="submit">Criar Consulta</Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
