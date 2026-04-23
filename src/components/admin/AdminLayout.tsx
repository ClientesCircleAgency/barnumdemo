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
import { AdminMobileNav } from './AdminMobileNav';
import logo from '@/assets/logo-final-no-bg.png';

const pageTitles: Record<string, { title: string }> = {
  '/admin/dashboard': { title: 'Dashboard' },
  '/admin/agenda': { title: 'Agenda do Dia' },
  '/admin/pacientes': { title: 'Gestão de Pacientes' },
  '/admin/profissionais': { title: 'Profissionais' },
  '/admin/sala-espera': { title: 'Fluxo de Atendimento' },
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
  const { isAuthenticated, isLoading, logout, userRole, user } = useAuth();
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
  const profileLabel = user?.user_metadata?.display_name || user?.email || 'Utilizador';
  const roleLabel =
    userRole === 'admin' ? 'Admin' : userRole === 'secretary' ? 'Secretariado' : userRole === 'doctor' ? 'Médico' : 'Equipa';

  return (
    <ClinicProvider>
      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(201,137,35,0.08),transparent_28%),linear-gradient(180deg,rgba(255,252,247,0.98),rgba(247,244,238,0.92))] pt-20 lg:pt-28">
        <header className="safe-area-pt fixed top-0 left-0 right-0 z-50 border-b border-primary/10 bg-card/90 px-4 shadow-sm backdrop-blur-xl lg:px-6">
          <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-3 lg:h-28">
            <div className="flex min-w-0 items-center gap-3 lg:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-2xl border border-primary/10 bg-background/70 lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 lg:flex">
                <div
                  className="h-8 w-8 bg-primary-gradient"
                  style={{
                    maskImage: `url(${logo})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: `url(${logo})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                  }}
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 lg:text-xs">
                  Tela Med
                </p>
                <h1 className="truncate font-display text-base font-semibold text-foreground lg:text-2xl">
                  {pageInfo.title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <div className="hidden lg:block">
                <Button
                  onClick={handleNewAppointment}
                  className="mr-3 rounded-2xl bg-primary-gradient px-4 shadow-md hover:opacity-90"
                >
                  Nova Consulta
                </Button>
                <NotificationsDropdown />
              </div>

              <div className="lg:hidden">
                <NotificationsDropdown />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-primary/10 bg-background/85 px-2.5 py-2 shadow-sm lg:gap-3 lg:px-3">
                <Avatar className="h-10 w-10 border border-primary/10 bg-primary/5">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {profileLabel
                      .split(' ')
                      .map((part: string) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left lg:block">
                  <p className="max-w-[180px] truncate text-sm font-semibold text-foreground">
                    {profileLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                </div>
              </div>
            </div>
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
            'flex-1 overflow-x-hidden overflow-y-auto bg-transparent',
            isMessagesPage ? '' : 'px-3 pb-28 pt-3 lg:p-6'
          )}>
            <Outlet />
          </main>
        </div>

        <AdminMobileNav
          onMenuOpen={() => setMobileMenuOpen(true)}
          onNewAppointment={handleNewAppointment}
        />

        <AppointmentWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </ClinicProvider>
  );
}
