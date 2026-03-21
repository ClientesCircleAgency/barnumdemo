import { useState, useCallback, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'secretary' | 'doctor' | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Backward compatibility
  const isAdmin = userRole === 'admin';

  const checkUserRole = useCallback(async (userId: string): Promise<UserRole> => {
    try {
      for (const role of ['admin', 'secretary', 'doctor'] as const) {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: role
        });
        if (error) continue;
        if (data === true) return role;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount with the current session.
    // No need to call getSession() separately — doing both causes duplicate role checks.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setIsLoading(true);
        checkUserRole(session.user.id)
          .then(setUserRole)
          .finally(() => setIsLoading(false));
      } else {
        setUserRole(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const role = await checkUserRole(data.user.id);
        if (!role) {
          await supabase.auth.signOut();
          return { success: false, error: 'Não tem permissões para aceder ao sistema.' };
        }
        setUserRole(role);
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
    }
  }, [checkUserRole]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  }, []);

  return { 
    user, 
    session, 
    isAuthenticated: !!session && !!userRole, 
    isAdmin,
    userRole,
    isSecretary: userRole === 'secretary',
    isDoctor: userRole === 'doctor',
    isLoading, 
    login, 
    logout 
  };
}
