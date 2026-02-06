import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Armchair,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClinic } from '@/context/ClinicContext';
import { useAppointmentRequests } from '@/hooks/useAppointmentRequests';
import { useAuth } from '@/hooks/useAuth';
import { PlanBadge } from './PlanBadge';

type UserRole = 'admin' | 'secretary' | 'doctor';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: string;
  allowedRoles: UserRole[];
}

const navItems: NavItem[] = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['admin', 'secretary', 'doctor'] },
  { path: '/admin/agenda', label: 'Agenda', icon: CalendarDays, allowedRoles: ['admin', 'secretary', 'doctor'] },
  { path: '/admin/pedidos', label: 'Pedidos', icon: Inbox, badgeKey: 'requests', allowedRoles: ['admin', 'secretary'] },
  { path: '/admin/pacientes', label: 'Pacientes', icon: Users, allowedRoles: ['admin', 'secretary', 'doctor'] },
  { path: '/admin/estatisticas', label: 'Estatísticas', icon: TrendingUp, allowedRoles: ['admin'] },
  { path: '/admin/sala-espera', label: 'Sala de Espera', icon: Armchair, allowedRoles: ['admin', 'secretary', 'doctor'] },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNewAppointment: () => void;
  onLogout: () => void;
  isMobile?: boolean;
}

export function AdminSidebar({ collapsed, onToggle, onNewAppointment, onLogout, isMobile = false }: AdminSidebarProps) {
  const location = useLocation();
  const { appointments } = useClinic();
  const { data: requests = [] } = useAppointmentRequests();
  const { userRole } = useAuth();

  const todayDate = new Date().toISOString().split('T')[0];
  const pendingToday = appointments.filter(
    (a) => a.date === todayDate && (a.status === 'scheduled' || a.status === 'confirmed')
  ).length;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;

  const isCollapsed = collapsed && !isMobile;

  // Filter nav items by user role
  const visibleNavItems = navItems.filter(item => 
    userRole && item.allowedRoles.includes(userRole)
  );

  return (
    <aside
      className={cn(
        'border-r border-sidebar-border flex flex-col',
        isMobile ? 'w-full h-full' : 'fixed left-0 z-40 transition-all duration-300',
        !isMobile && 'top-24 lg:top-28 h-[calc(100vh-6rem)] lg:h-[calc(100vh-7rem)]',
        !isMobile && (isCollapsed ? 'w-16' : 'w-64')
      )}
    >
      {/* Plan Badge */}
      <div className={cn("px-3 border-b border-sidebar-border/50", isCollapsed ? "py-2" : "py-4")}>
        <PlanBadge plan="advanced" collapsed={isCollapsed} />
      </div>

      {/* Botão Nova Consulta */}
      <div className="p-3">
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onNewAppointment}
                size="icon"
                className="w-full bg-primary-gradient hover:opacity-90 shadow-md font-sans"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Nova Consulta</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={onNewAppointment}
            className="w-full gap-2 bg-primary-gradient hover:opacity-90 shadow-md transition-all hover:shadow-lg font-sans font-medium"
          >
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          const badge =
            item.badgeKey === 'requests' && pendingRequests > 0
              ? pendingRequests
              : item.path === '/admin/agenda' && pendingToday > 0
                ? pendingToday
                : null;

          if (isCollapsed) {
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'flex items-center justify-center h-10 w-full rounded-lg transition-all relative',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-primary'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {badge && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-mono text-[10px]">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-sans text-xs">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 h-10 px-3 rounded-lg transition-all font-sans text-sm',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-primary'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span className="h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-mono text-[10px]">
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Separador */}
      <div className="px-3 py-1">
        <div className="border-t border-sidebar-border/50" />
      </div>

      {/* Configurações e Footer */}
      <div className="p-3 space-y-0.5">
        {(userRole === 'admin' || userRole === 'secretary') && (
          isCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/admin/configuracoes"
                    className={cn(
                      'flex items-center justify-center h-10 w-full rounded-lg transition-all',
                      location.pathname === '/admin/configuracoes'
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-primary'
                  )}
                >
                  <Settings className="h-4 w-4" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-sans text-xs">Configurações</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="w-full h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-sans text-xs">Sair</TooltipContent>
            </Tooltip>
            </>
          ) : (
            <>
              <NavLink
                to="/admin/configuracoes"
                className={cn(
                  'flex items-center gap-3 h-10 px-3 rounded-lg transition-all font-sans text-sm',
                  location.pathname === '/admin/configuracoes'
                    ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-primary'
                )}
              >
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </NavLink>
            </>
          )
        )}
        {/* Logout button (always visible) */}
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="w-full h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-sans text-xs">Sair</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={onLogout}
            className="flex items-center gap-3 h-10 px-3 w-full rounded-lg transition-all font-sans text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        )}
      </div>

      {/* Toggle - only on desktop */}
      {!isMobile && (
        <div className="p-3 border-t border-sidebar-border/50">
          <button
            onClick={onToggle}
            className={cn(
              'flex items-center w-full h-9 rounded-lg transition-all font-sans text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30',
              isCollapsed ? 'justify-center' : 'justify-start gap-2 px-3'
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}