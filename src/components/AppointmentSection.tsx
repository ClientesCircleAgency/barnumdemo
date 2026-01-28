import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon, Clock, Send, Smile, Sparkles } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useAddAppointmentRequest } from '@/hooks/useAppointmentRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const appointmentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  phone: z.string().min(9, 'Telefone inválido').max(20),
  nif: z.string().length(9, 'NIF deve ter 9 dígitos').regex(/^\d+$/, 'NIF deve conter apenas números'),
  serviceType: z.enum(['dentaria', 'rejuvenescimento'], { required_error: 'Selecione o tipo de consulta' }),
  reason: z.string().min(10, 'Por favor descreva o motivo da consulta (mínimo 10 caracteres)'),
  preferredDate: z.string().min(1, 'Selecione uma data'),
  preferredTime: z.string().min(1, 'Selecione uma hora'),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

export function AppointmentSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const addRequest = useAddAppointmentRequest();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
  });

  const watchServiceType = watch('serviceType');

  // IDs retrieved from Supabase audit/migration logs
  const SPECIALTY_IDS = {
    dentaria: '22222222-2222-2222-2222-222222222222',
    rejuvenescimento: '11111111-1111-1111-1111-111111111111', // Repurposed/New ID
  };

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      await addRequest.mutateAsync({
        name: data.name,
        email: data.email,
        phone: data.phone,
        nif: data.nif,
        reason: data.reason,
        specialty_id: SPECIALTY_IDS[data.serviceType],
        preferred_date: data.preferredDate,
        preferred_time: data.preferredTime,
      });

      toast({
        title: 'Marcação enviada!',
        description: 'Entraremos em contacto brevemente para confirmar a sua consulta.',
      });

      reset();
      setSelectedDate(undefined);
    } catch {
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setValue('preferredDate', format(date, 'yyyy-MM-dd'));
    }
  };

  return (
    <section id="marcacao" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-4">
              <span className="text-sm font-medium text-accent-foreground">Marcação</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Marque a sua <span className="text-primary-gradient">Consulta</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Preencha o formulário abaixo e entraremos em contacto para confirmar
              a sua marcação.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 md:p-8 shadow-lg"
          >
            {/* Service Type Selection */}
            <div className="mb-8">
              <Label className="text-base font-medium mb-4 block">Tipo de Consulta</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setValue('serviceType', 'rejuvenescimento' as any)}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-center",
                    watchServiceType === 'rejuvenescimento' as any
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icons.Sparkles className={cn(
                    "w-8 h-8 mx-auto mb-3",
                    watchServiceType === 'rejuvenescimento' as any ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium",
                    watchServiceType === 'rejuvenescimento' as any ? "text-primary" : "text-foreground"
                  )}>Rejuvenescimento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValue('serviceType', 'dentaria')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-center",
                    watchServiceType === 'dentaria'
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Smile className={cn(
                    "w-8 h-8 mx-auto mb-3",
                    watchServiceType === 'dentaria' ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium",
                    watchServiceType === 'dentaria' ? "text-primary" : "text-foreground"
                  )}>Medicina Dentária</span>
                </button>
              </div>
              {errors.serviceType && (
                <p className="text-sm text-destructive mt-2">{errors.serviceType.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  placeholder="O seu nome"
                  {...register('name')}
                  className={cn("rounded-xl h-12", errors.name && 'border-destructive')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* NIF */}
              <div className="space-y-2">
                <Label htmlFor="nif">NIF</Label>
                <Input
                  id="nif"
                  placeholder="123456789"
                  maxLength={9}
                  {...register('nif')}
                  className={cn("rounded-xl h-12", errors.nif && 'border-destructive')}
                />
                {errors.nif && (
                  <p className="text-sm text-destructive">{errors.nif.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  {...register('email')}
                  className={cn("rounded-xl h-12", errors.email && 'border-destructive')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Reason (Full Width) */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="reason">Motivo da Consulta</Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva brevemente o motivo da sua consulta"
                  {...register('reason')}
                  className={cn("rounded-xl min-h-[100px]", errors.reason && 'border-destructive')}
                />
                {errors.reason && (
                  <p className="text-sm text-destructive">{errors.reason.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="912 345 678"
                  {...register('phone')}
                  className={cn("rounded-xl h-12", errors.phone && 'border-destructive')}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Data Preferida</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl h-12",
                        !selectedDate && "text-muted-foreground",
                        errors.preferredDate && "border-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "PPP", { locale: pt })
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const day = date.getDay();
                        return date < today || day === 0;
                      }}
                      initialFocus
                      className="pointer-events-auto rounded-2xl"
                    />
                  </PopoverContent>
                </Popover>
                {errors.preferredDate && (
                  <p className="text-sm text-destructive">{errors.preferredDate.message}</p>
                )}
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label>Hora Preferida</Label>
                <Select onValueChange={(value) => setValue('preferredTime', value)}>
                  <SelectTrigger className={cn("rounded-xl h-12", errors.preferredTime && 'border-destructive')}>
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Selecione a hora" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time} className="rounded-lg">
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.preferredTime && (
                  <p className="text-sm text-destructive">{errors.preferredTime.message}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 bg-primary-gradient hover:opacity-90 shadow-lg hover:shadow-xl transition-all rounded-xl h-14 text-base"
              size="lg"
            >
              <Send className="w-5 h-5 mr-2" />
              {isSubmitting ? 'A enviar...' : 'Enviar Pedido de Marcação'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
