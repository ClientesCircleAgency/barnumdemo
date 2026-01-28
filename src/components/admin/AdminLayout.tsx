import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminSidebar } from './AdminSidebar';
import { ClinicProvider } from '@/context/ClinicContext';
import { AppointmentWizard } from './AppointmentWizard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { NotificationsDropdown } from './NotificationsDropdown';
import logo from '@/assets/logo-final-no-bg.png';

const pageTitles: Record<string, { title: string }> = {
  '/admin/dashboard': { title: 'Dashboard' },
  '/admin/agenda': { title: 'Agenda do Dia' },
  '/admin/pacientes': { title: 'Gestão de Pacientes' },
  '/admin/sala-espera': { title: 'Fluxo de Atendimento' },
  '/admin/lista-espera': { title: 'Lista de Espera' },
  '/admin/configuracoes': { title: 'Configurações' },
  '/admin/pedidos': { title: 'Pedidos de Marcação' },
  '/admin/plano': { title: 'Plano' },
  '/admin/estatisticas': { title: 'Estatísticas' },
};

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast({
      title: 'Sessão terminada',
      description: 'Até breve!',
    });
    navigate('/admin/login', { replace: true });
  };

  const handleNewAppointment = () => {
    setWizardOpen(true);
    setMobileMenuOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const currentPath = location.pathname;
  const pageInfo = pageTitles[currentPath] || { title: 'Admin' };
  const isMessagesPage = currentPath === '/admin/mensagens';

  return (
    <ClinicProvider>
      <div className="min-h-screen bg-background pt-24 lg:pt-28">
        {/* Top Header - Fixed Full Width */}
        <header className="fixed top-0 left-0 right-0 h-24 lg:h-28 border-b border-border bg-card px-4 lg:px-6 flex items-center justify-between z-50 shadow-sm">

          {/* Left: Mobile Menu Trigger */}
          <div className="flex items-center z-10 w-20">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>

          {/* Center: Brand Logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative h-16 lg:h-20 w-48 max-w-[200px]">
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

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-2 lg:gap-4 z-10 w-20">
            <NotificationsDropdown />
            <Avatar className="h-8 w-8 lg:h-9 lg:w-9 border-2 border-primary/20 cursor-pointer">
              <AvatarFallback className="bg-primary text-primary-foreground font-sans font-semibold text-xs lg:text-sm">
                DF
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            onNewAppointment={handleNewAppointment}
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border pt-24">
            <AdminSidebar
              collapsed={false}
              onToggle={() => { }}
              onNewAppointment={handleNewAppointment}
              onLogout={handleLogout}
              isMobile
            />
          </SheetContent>
        </Sheet>

        <div
          className={cn(
            'transition-all duration-300 flex flex-col',
            'lg:ml-64',
            collapsed && 'lg:ml-16'
          )}
        >
          {/* Main Content */}
          <main className={cn(
            'flex-1 overflow-auto',
            isMessagesPage ? '' : 'p-4 lg:p-6'
          )}>
            <Outlet />
          </main>
        </div>

        <AppointmentWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </ClinicProvider>
  );
}