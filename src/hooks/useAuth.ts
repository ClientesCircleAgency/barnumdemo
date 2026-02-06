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
      // Check each role in priority order: admin > secretary > doctor
      for (const role of ['admin', 'secretary', 'doctor'] as const) {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: role
        });
        
        if (error) {
          console.error(`Error checking ${role} role:`, error);
          continue;
        }
        
        if (data === true) {
          return role;
        }
      }
      
      return null; // No role found
    } catch (error) {
      console.error('Error checking user role:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Keep loading until the role check completes to avoid redirect flicker/loops
      if (session?.user) {
        setIsLoading(true);
        setTimeout(() => {
          checkUserRole(session.user.id)
            .then(setUserRole)
            .finally(() => setIsLoading(false));
        }, 0);
      } else {
        setUserRole(null);
        setIsLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setIsLoading(true);
          return checkUserRole(session.user.id)
            .then(setUserRole)
            .finally(() => setIsLoading(false));
        }

        setIsLoading(false);
      })
      .catch(() => {
        setUserRole(null);
        setIsLoading(false);
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
    } catch (error) {
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
