import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type AllowedRoles = 'admin' | 'secretary' | 'doctor';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AllowedRoles[];
  redirectTo?: string;
}

export function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { userRole, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!userRole || !allowedRoles.includes(userRole)) {
      // Redirect based on user role
      const fallback = redirectTo || getFallbackRoute(userRole);
      navigate(fallback, { replace: true });
    }
  }, [userRole, isLoading, allowedRoles, navigate, redirectTo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    return null;
  }

  return <>{children}</>;
}

function getFallbackRoute(role: 'admin' | 'secretary' | 'doctor' | null): string {
  if (role === 'doctor') return '/admin/agenda';
  if (role === 'secretary') return '/admin/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/admin/login';
}
