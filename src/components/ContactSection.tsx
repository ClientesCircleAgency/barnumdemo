import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';

const contactInfo = [
  {
    icon: MapPin,
    label: 'Morada',
    value: 'Av. Dr. António Rodrigues Manito, 65, 1.º Andar\n2900-067 Setúbal',
    className: 'sm:col-span-2 xl:col-span-2',
  },
  {
    icon: Phone,
    label: 'Telefone',
    value: '265 231 64 (Fixo)\n936 667 034 (Móvel)',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'barnun_clinica@hotmail.com',
  },
  {
    icon: Clock,
    label: 'Horário',
    value: 'Seg – Sex: 09:00 às 19:00\nSáb – Dom: Fechados',
    className: 'sm:col-span-2 xl:col-span-2',
  },
];

export function ContactSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section id="contactos" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-4">
              <span className="text-sm font-medium text-accent-foreground">Contactos</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Entre em <span className="text-primary-gradient">Contacto</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-7">
              Tem alguma questão? Estamos aqui para ajudar.
            </p>
          </div>

          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {contactInfo.map((info) => (
                <div
                  key={info.label}
                  className={cn(
                    'bg-card border border-border rounded-2xl p-5 sm:p-6 flex items-start gap-4 min-h-[148px] hover:shadow-lg hover:border-primary/30 transition-all duration-300',
                    info.className
                  )}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                    <info.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base text-muted-foreground mb-1.5">{info.label}</p>
                    <p className="text-foreground font-semibold text-sm sm:text-[15px] whitespace-pre-line leading-6 [overflow-wrap:anywhere]">
                      {info.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden shadow-lg h-[340px] md:h-[440px] border border-border">
              <iframe
                src="https://www.google.com/maps?q=Av.%20Dr.%20Ant%C3%B3nio%20Rodrigues%20Manito%2C%2065%2C%201.%C2%BA%20Andar%2C%202900-067%20Set%C3%BAbal&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização Barnun"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
