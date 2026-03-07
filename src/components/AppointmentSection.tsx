import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon, Clock, Send, Smile, Sparkles, Loader2 } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useAddAppointmentRequest } from '@/hooks/useAppointmentRequests';
import { useSpecialties } from '@/hooks/useSpecialties';
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

const COUNTRY_CONFIGS = {
  PT: { code: '+351', flag: '\u{1F1F5}\u{1F1F9}', placeholder: '912 345 678', regex: /^[923]\d{8}$/, label: 'Portugal' },
  BR: { code: '+55', flag: '\u{1F1E7}\u{1F1F7}', placeholder: '11 91234 5678', regex: /^\d{10,11}$/, label: 'Brasil' },
} as const;

type CountryKey = keyof typeof COUNTRY_CONFIGS;

const appointmentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  countryCode: z.enum(['PT', 'BR'] as const),
  phone: z.string().min(1, 'Telefone obrigatório').max(20),
  nif: z.string().length(9, 'NIF deve ter 9 dígitos').regex(/^\d+$/, 'NIF deve conter apenas números'),
  serviceType: z.string({ required_error: 'Selecione o tipo de consulta' }).uuid('Selecione o tipo de consulta'),
  reason: z.string().min(10, 'Por favor descreva o motivo da consulta (mínimo 10 caracteres)'),
  preferredDate: z.string().min(1, 'Selecione uma data'),
  preferredTime: z.string().min(1, 'Selecione uma hora'),
}).superRefine((data, ctx) => {
  const digits = data.phone.replace(/\s/g, '');
  const config = COUNTRY_CONFIGS[data.countryCode];
  if (!config.regex.test(digits)) {
    const msg = data.countryCode === 'PT'
      ? 'Número PT inválido (9 dígitos, começar por 9, 2 ou 3)'
      : 'Número BR inválido (10-11 dígitos: DDD + número)';
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ['phone'] });
  }
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

const SPECIALTY_ICONS: Record<string, React.ElementType> = {
  'Rejuvenescimento Facial': Sparkles,
  'Medicina Dentária': Smile,
};

export function AppointmentSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const addRequest = useAddAppointmentRequest();
  const { data: specialties, isLoading: loadingSpecialties } = useSpecialties();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCountry, setSelectedCountry] = useState<CountryKey>('PT');
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
    defaultValues: { countryCode: 'PT' },
  });

  const watchServiceType = watch('serviceType');

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      const cleanDigits = data.phone.replace(/\s/g, '');
      const fullPhone = COUNTRY_CONFIGS[data.countryCode].code + cleanDigits;

      await addRequest.mutateAsync({
        name: data.name,
        email: data.email,
        phone: fullPhone,
        nif: data.nif,
        reason: data.reason,
        specialty_id: data.serviceType,
        preferred_date: data.preferredDate,
        preferred_time: data.preferredTime,
      });

      toast({
        title: 'Marcação enviada!',
        description: 'Entraremos em contacto brevemente para confirmar a sua consulta.',
      });

      reset();
      setSelectedDate(undefined);
      setSelectedCountry('PT');
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
              {loadingSpecialties ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>A carregar especialidades...</span>
                </div>
              ) : (
                <div className={cn("grid gap-4", (specialties?.length ?? 0) <= 3 ? `grid-cols-${specialties?.length ?? 2}` : "grid-cols-2 md:grid-cols-3")}>
                  {specialties?.map((spec) => {
                    const Icon = SPECIALTY_ICONS[spec.name] ?? Sparkles;
                    const isSelected = watchServiceType === spec.id;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => setValue('serviceType', spec.id, { shouldValidate: true })}
                        className={cn(
                          "p-6 rounded-2xl border-2 transition-all text-center",
                          isSelected
                            ? "border-primary bg-accent"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className={cn(
                          "w-8 h-8 mx-auto mb-3",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "font-medium",
                          isSelected ? "text-primary" : "text-foreground"
                        )}>{spec.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
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

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedCountry}
                    onValueChange={(v: CountryKey) => {
                      setSelectedCountry(v);
                      setValue('countryCode', v);
                    }}
                  >
                    <SelectTrigger className={cn("rounded-xl h-12 w-[130px] shrink-0", errors.phone && 'border-destructive')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(Object.keys(COUNTRY_CONFIGS) as CountryKey[]).map((key) => (
                        <SelectItem key={key} value={key} className="rounded-lg">
                          <span className="mr-1">{COUNTRY_CONFIGS[key].flag}</span> {COUNTRY_CONFIGS[key].code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={COUNTRY_CONFIGS[selectedCountry].placeholder}
                    {...register('phone')}
                    className={cn("rounded-xl h-12 flex-1", errors.phone && 'border-destructive')}
                  />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
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
