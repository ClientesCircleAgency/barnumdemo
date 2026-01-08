import { useState, useCallback, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      
      return data === true;
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
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
          checkAdminRole(session.user.id)
            .then(setIsAdmin)
            .finally(() => setIsLoading(false));
        }, 0);
      } else {
        setIsAdmin(false);
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
          return checkAdminRole(session.user.id)
            .then(setIsAdmin)
            .finally(() => setIsLoading(false));
        }

        setIsLoading(false);
      })
      .catch(() => {
        setIsAdmin(false);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [checkAdminRole]);

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
        const hasAdminRole = await checkAdminRole(data.user.id);
        if (!hasAdminRole) {
          await supabase.auth.signOut();
          return { success: false, error: 'Não tem permissões de administrador.' };
        }
        setIsAdmin(true);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
    }
  }, [checkAdminRole]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  }, []);

  return { 
    user, 
    session, 
    isAuthenticated: !!session && isAdmin, 
    isAdmin,
    isLoading, 
    login, 
    logout 
  };
}
