import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Linkedin } from 'lucide-react';
import logo from '@/assets/logo-barnum-new.png';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          {/* Logo & Social */}
          <div className="space-y-6 text-center md:text-left">
            <div className="flex justify-center md:justify-start">
              <div className="relative inline-block">
                <img src={logo} alt="Barnun" className="h-28 w-auto opacity-0" />
                <div
                  className="absolute inset-0 bg-primary-gradient"
                  style={{
                    maskImage: `url(${logo})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'left center',
                    WebkitMaskImage: `url(${logo})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'left center'
                  }}
                />
              </div>
            </div>
            <p className="text-background/70 text-sm hidden md:block leading-relaxed">
              Cuidamos do seu sorriso e da sua autoestima há mais de 15 anos, com dedicação e tecnologia de ponta.
            </p>
            <div className="flex gap-3 justify-center md:justify-start">
              <a
                href="#"
                className="w-11 h-11 rounded-xl bg-background/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-11 h-11 rounded-xl bg-background/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-11 h-11 rounded-xl bg-background/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links Rápidos */}
          <div className="hidden md:block">
            <h4 className="font-semibold text-lg mb-5">Links Rápidos</h4>
            <ul className="space-y-3">
              {[
                { label: 'Início', href: '#hero' },
                { label: 'Sobre Nós', href: '#sobre' },
                { label: 'Serviços', href: '#servicos' },
                { label: 'Testemunhos', href: '#testemunhos' },
                { label: 'Contactos', href: '#contactos' },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-background/70 hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Serviços */}
          <div className="hidden md:block">
            <h4 className="font-semibold text-lg mb-5">Serviços</h4>
            <ul className="space-y-3">
              {[
                'Ortodontia',
                'Implantologia',
                'Branqueamento',
                'Toxina Botulínica',
                'Ácido Hialurónico',
                'Harmonização Facial',
              ].map((service) => (
                <li key={service}>
                  <span className="text-background/70 text-sm">{service}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contactos */}
          <div>
            <h4 className="font-semibold text-lg mb-5 text-center md:text-left">Contactos</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <span className="text-background/70 text-sm">
                  Rua dos Comediantes nº 13 r/c – C<br />
                  2910-468 Setúbal
                </span>
              </li>
              <li className="flex items-start gap-3 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div className="text-background/70 text-sm">
                  <a href="tel:+351265540990" className="hover:text-primary block">
                    265 540 990 (Fixo)
                  </a>
                  <a href="tel:+351919265497" className="hover:text-primary block">
                    919 265 497 (Móvel)
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-3 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <a href="mailto:geral@barnum.pt" className="text-background/70 hover:text-primary text-sm">
                  geral@barnum.pt
                </a>
              </li>
              <li className="flex items-start gap-3 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="text-background/70 text-sm">
                  <p>Seg – Sex: 09:00 às 19:00</p>
                  <p>Sáb – Dom: Fechados</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-background/10">
        <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-background/50 text-sm text-center md:text-left">
            © {currentYear} Barnun. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-background/50 hover:text-primary text-sm transition-colors">
              Política de Privacidade
            </a>
            <a href="#" className="text-background/50 hover:text-primary text-sm transition-colors">
              Termos e Condições
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
