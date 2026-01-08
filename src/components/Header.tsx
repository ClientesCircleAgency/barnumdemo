import { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo-barnum-new.png';
const navItems = [{
  label: 'Início',
  href: '#hero'
}, {
  label: 'Sobre Nós',
  href: '#sobre'
}, {
  label: 'Serviços',
  href: '#servicos'
}, {
  label: 'Testemunhos',
  href: '#testemunhos'
}, {
  label: 'Contactos',
  href: '#contactos'
}];
export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    element?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  return <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-card/95 backdrop-blur-md shadow-sm border-b border-border' : 'bg-transparent'}`}>
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between h-16 md:h-20">
        {/* Mobile Menu Button */}
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-foreground hover:bg-accent rounded-xl transition-colors">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Logo */}
        <a href="#hero" className="flex items-center absolute left-1/2 -translate-x-1/2 md:relative md:left-0 md:translate-x-0 group">
          <div className="relative">
            {/* Ghost image for dimensions */}
            <img alt="Barnum" className="h-20 md:h-24 w-auto opacity-0" src={logo} />
            {/* Gradient Mask */}
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
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => <button key={item.href} onClick={() => handleNavClick(item.href)} className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary hover:bg-accent rounded-xl transition-all">
            {item.label}
          </button>)}
        </nav>

        {/* CTA Button */}
        <div className="hidden md:flex items-center gap-4">
          <Button onClick={() => handleNavClick('#marcacao')} className="bg-primary-gradient hover:opacity-90 shadow-lg hover:shadow-xl transition-all rounded-xl">
            <Phone className="w-4 h-4 mr-2" />
            Marcar Consulta
          </Button>
        </div>

        {/* Spacer for mobile */}
        <div className="w-10 md:hidden" />
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && <div className="md:hidden absolute top-full left-0 right-0 bg-card shadow-lg border-b border-border animate-fade-in">
        <nav className="flex flex-col p-4 gap-1">
          {navItems.map(item => <button key={item.href} onClick={() => handleNavClick(item.href)} className="px-4 py-3 text-left text-foreground/80 hover:text-primary hover:bg-accent rounded-xl transition-colors">
            {item.label}
          </button>)}
          <div className="pt-3 mt-2 border-t border-border">
            <Button onClick={() => handleNavClick('#marcacao')} className="w-full bg-primary-gradient hover:opacity-90 rounded-xl">
              <Phone className="w-4 h-4 mr-2" />
              Marcar Consulta
            </Button>
          </div>
        </nav>
      </div>}
    </div>
  </header>;
}