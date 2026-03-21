import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { dentalServices, facialRejuvenationServices } from '@/data/services';
import { Service } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ServiceCard({ service, index }: { service: Service; index: number }) {
  const IconComponent = (Icons as any)[service.icon] || Icons.Circle;

  return (
    <div
      className="group overflow-hidden rounded-2xl bg-card border border-border shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-500"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Image */}
      {service.image && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={service.image}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <div className="w-12 h-12 rounded-xl bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <IconComponent className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <h4 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
          {service.name}
        </h4>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {service.description}
        </p>
      </div>
    </div>
  );
}

export function ServicesSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [activeTab, setActiveTab] = useState('dentaria');

  return (
    <section id="servicos" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
        >
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-4">
              <span className="text-sm font-medium text-accent-foreground">Serviços</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Os Nossos <span className="text-primary-gradient">Serviços</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Oferecemos uma gama completa de serviços de medicina dentária e
              rejuvenescimento facial, sempre com a mais alta qualidade.
            </p>
          </div>

          {/* Tabs */}
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-10 h-14 p-1 bg-card border border-border rounded-2xl">
              <TabsTrigger
                value="dentaria"
                className="data-[state=active]:bg-primary-gradient data-[state=active]:text-primary-foreground rounded-xl h-12 text-sm font-medium transition-all"
              >
                <Icons.Smile className="w-4 h-4 mr-2" />
                Medicina Dentária
              </TabsTrigger>
              <TabsTrigger
                value="rejuvenescimento"
                className="data-[state=active]:bg-primary-gradient data-[state=active]:text-primary-foreground rounded-xl h-12 text-sm font-medium transition-all"
              >
                <Icons.Sparkles className="w-4 h-4 mr-2" />
                Rejuvenescimento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dentaria" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {dentalServices.map((service, index) => (
                  <div
                    key={service.id}
                    className={isVisible ? 'animate-fade-in-up' : 'opacity-0'}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <ServiceCard service={service} index={index} />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="rejuvenescimento" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {facialRejuvenationServices.map((service, index) => (
                  <div
                    key={service.id}
                    className={isVisible ? 'animate-fade-in-up' : 'opacity-0'}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <ServiceCard service={service} index={index} />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
