import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useAddContactMessage } from '@/hooks/useContactMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const contactSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  phone: z.string().min(9, 'Telefone inválido').max(20),
  message: z.string().min(10, 'Mensagem deve ter pelo menos 10 caracteres').max(1000),
});

type ContactFormData = z.infer<typeof contactSchema>;

const contactInfo = [
  {
    icon: MapPin,
    label: 'Morada',
    value: 'Rua dos Comediantes nº 13 r/c – C\n2910-468 Setúbal',
  },
  {
    icon: Phone,
    label: 'Telefone',
    value: '265 540 990 (Fixo)\n919 265 497 (Móvel)',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'geral@medifranco.pt',
  },
  {
    icon: Clock,
    label: 'Horário',
    value: 'Seg – Sex: 09:00 às 19:00\nSáb – Dom: Fechados',
  },
];

export function ContactSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const addMessage = useAddContactMessage();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      await addMessage.mutateAsync({
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message,
      });

      toast({
        title: 'Mensagem enviada!',
        description: 'Obrigado pelo seu contacto. Responderemos brevemente.',
      });

      reset();
    } catch {
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <section id="contactos" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={`transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-4">
              <span className="text-sm font-medium text-accent-foreground">Contactos</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Entre em <span className="text-primary-gradient">Contacto</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Tem alguma questão? Estamos aqui para ajudar.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Contact Info & Map */}
            <div className="space-y-6">
              {/* Contact Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contactInfo.map((info, index) => (
                  <div
                    key={index}
                    className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                      <info.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{info.label}</p>
                      <p className="text-foreground font-medium text-sm whitespace-pre-line">{info.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Google Maps */}
              <div className="rounded-2xl overflow-hidden shadow-lg h-64 md:h-80 border border-border">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3118.123456789!2d-8.893333!3d38.523889!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd194330b6b4f1c1%3A0x1234567890abcdef!2sRua%20dos%20Comediantes%2013%2C%202910-468%20Set%C3%BAbal!5e0!3m2!1spt-PT!2spt!4v1700000000000!5m2!1spt-PT!2spt"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização MediFranco"
                />
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Envie-nos uma mensagem
              </h3>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Nome</Label>
                  <Input
                    id="contact-name"
                    placeholder="O seu nome"
                    {...register('name')}
                    className={cn("rounded-xl h-12", errors.name && 'border-destructive')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="seu@email.com"
                      {...register('email')}
                      className={cn("rounded-xl h-12", errors.email && 'border-destructive')}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Telefone</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="912 345 678"
                      {...register('phone')}
                      className={cn("rounded-xl h-12", errors.phone && 'border-destructive')}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message">Mensagem</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="A sua mensagem..."
                    rows={4}
                    {...register('message')}
                    className={cn("rounded-xl resize-none", errors.message && 'border-destructive')}
                  />
                  {errors.message && (
                    <p className="text-sm text-destructive">{errors.message.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary-gradient hover:opacity-90 shadow-lg hover:shadow-xl transition-all rounded-xl h-14 text-base"
                  size="lg"
                >
                  <Send className="w-5 h-5 mr-2" />
                  {isSubmitting ? 'A enviar...' : 'Enviar Mensagem'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
