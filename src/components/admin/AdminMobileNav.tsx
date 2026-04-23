import { NavLink } from 'react-router-dom';
import { Armchair, CalendarDays, Inbox, LayoutDashboard, Menu, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useClinic } from '@/context/ClinicContext';
import { useAppointmentRequests } from '@/hooks/useAppointmentRequests';
import { Button } from '@/components/ui/button';

type UserRole = 'admin' | 'secretary' | 'doctor';

interface AdminMobileNavProps {
  onMenuOpen: () => void;
  onNewAppointment: () => void;
}

interface MobileNavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  allowedRoles: UserRole[];
}

export function AdminMobileNav({ onMenuOpen, onNewAppointment }: AdminMobileNavProps) {
  const { userRole } = useAuth();
  const { appointments } = useClinic();
  const { data: requests = [] } = useAppointmentRequests();

  const todayDate = new Date().toISOString().split('T')[0];
  const agendaBadge = appointments.filter((appointment) => appointment.date === todayDate && appointment.status === 'confirmed').length;
  const requestsBadge = requests.filter((request) => request.status === 'pending').length;

  const navItems: MobileNavItem[] = [
    { path: '/admin/dashboard', label: 'Home', icon: LayoutDashboard, allowedRoles: ['admin', 'secretary', 'doctor'] },
    { path: '/admin/agenda', label: 'Agenda', icon: CalendarDays, badge: agendaBadge, allowedRoles: ['admin', 'secretary', 'doctor'] },
    {
      path: userRole === 'doctor' ? '/admin/sala-espera' : '/admin/pedidos',
      label: userRole === 'doctor' ? 'Atender' : 'Pedidos',
      icon: userRole === 'doctor' ? Armchair : Inbox,
      badge: userRole === 'doctor' ? undefined : requestsBadge,
      allowedRoles: ['admin', 'secretary', 'doctor'],
    },
    { path: '/admin/pacientes', label: 'Pacientes', icon: Users, allowedRoles: ['admin', 'secretary', 'doctor'] },
  ];

  const visibleItems = navItems.filter((item) => userRole && item.allowedRoles.includes(userRole));

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[4.85rem] z-40 flex justify-center lg:hidden">
        <Button
          type="button"
          onClick={onNewAppointment}
          className="pointer-events-auto h-14 w-14 rounded-full bg-primary-gradient shadow-[0_18px_40px_rgba(180,115,28,0.35)] hover:opacity-90"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <nav className="safe-area-pb fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-card/95 px-3 pb-3 pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">
          {visibleItems.slice(0, 4).map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-3 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={onMenuOpen}
            className="flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-medium text-muted-foreground transition-all hover:bg-primary/5 hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
