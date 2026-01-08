import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar } from 'lucide-react';
import logo from '@/assets/logo-barnum-new.png';
export function HeroSection() {
  const scrollToMarcacao = () => {
    document.querySelector('#marcacao')?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  const scrollToSobre = () => {
    document.querySelector('#sobre')?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  return <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
    {/* Background Image */}
    <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{
      backgroundImage: `url('https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1920&q=80')`
    }}>
      <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />
    </div>

    {/* Content */}
    <div className="relative z-10 container mx-auto px-4 text-center">
      <div className="max-w-3xl mx-auto animate-fade-in-up">
        {/* Logo */}
        {/* Logo */}
        <div className="relative inline-block mx-auto mb-8">
          {/* Ghost image for dimensions */}
          <img alt="Barnum" className="h-48 md:h-64 lg:h-80 w-auto opacity-0" src={logo} />
          {/* Gradient Mask */}
          <div
            className="absolute inset-0 bg-primary-gradient drop-shadow-lg"
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

        {/* Main Tagline */}
        {/* Main Tagline */}
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
          Cuidamos do seu{' '}
          <span className="text-primary-gradient">Sorriso</span>
          {' '}e da sua{' '}
          <span className="text-primary-gradient">Autoestima</span>
          <span className="text-primary-gradient">.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto font-normal">
          Especialistas em Medicina Dentária e Rejuvenescimento Facial, com mais de 15 anos de experiência.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={scrollToMarcacao} className="bg-primary-gradient hover:opacity-90 text-base font-semibold px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl gap-2">
            <Calendar className="w-5 h-5" />
            Marcar Consulta
          </Button>
          <Button size="lg" variant="outline" onClick={scrollToSobre} className="text-base font-semibold px-8 py-6 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 rounded-xl gap-2">
            Conhecer a Clínica
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  </section>;
}