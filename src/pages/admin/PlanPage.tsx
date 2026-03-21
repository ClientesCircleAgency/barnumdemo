import { ArrowRight, Check, Zap, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import logo from '@/assets/logo-barnum-new.png';

const currentPlan = 'advanced';

const planFeatures = {
  advanced: [
    'Até 500 pacientes',
    'Agenda avançada',
    'Sala de espera digital',
    'Relatórios básicos',
    'Suporte por email',
  ],
  premium: [
    'Pacientes ilimitados',
    'Agenda avançada com IA',
    'Sala de espera digital',
    'Relatórios avançados e analytics',
    'Integrações com laboratórios',
    'API completa',
    'Suporte prioritário 24/7',
    'Onboarding personalizado',
  ],
};

export default function PlanPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="max-w-4xl mx-auto px-4 py-12 lg:py-20">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <div className="relative inline-block">
            <img
              src={logo}
              alt="Barnun"
              className="h-16 lg:h-20 object-contain opacity-0"
            />
            <div
              className="absolute inset-0 bg-primary-gradient"
              style={{
                maskImage: `url(${logo})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: `url(${logo})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center'
              }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-1.5 bg-primary/5 border-primary/20 text-primary">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Plano Atual: Advanced
          </Badge>
          <h1 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
            Eleve a sua clínica ao próximo nível
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Desbloqueie todo o potencial do DentalHub com funcionalidades premium
          </p>
        </div>

        {/* Plan Comparison */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-12">
          {/* Current Plan */}
          <Card className="p-6 lg:p-8 border-border bg-card/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <h3 className="text-xl font-bold text-foreground">Advanced</h3>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {planFeatures.advanced.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full" disabled>
              Plano atual
            </Button>
          </Card>

          {/* Premium Plan */}
          <Card className="p-6 lg:p-8 border-primary/30 bg-gradient-to-b from-primary/5 to-transparent relative overflow-hidden ring-1 ring-primary/20">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />

            {/* Popular badge */}
            <div className="absolute -top-px right-6">
              <div className="bg-gradient-to-r from-primary to-purple-500 text-white text-xs font-medium px-3 py-1 rounded-b-lg flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Recomendado
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6 mt-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upgrade para</p>
                <h3 className="text-xl font-bold text-foreground">Premium</h3>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {planFeatures.premium.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-foreground">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg">
              Fazer Upgrade
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Sem compromisso. Cancele quando quiser.
            </p>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Precisa de ajuda? Contacte o nosso suporte em{' '}
            <a href="mailto:suporte@dentalhub.pt" className="text-primary hover:underline">
              suporte@dentalhub.pt
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
