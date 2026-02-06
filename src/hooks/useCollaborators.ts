import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Collaborator {
  user_id: string;
  email: string;
  role: 'admin' | 'secretary' | 'doctor';
  professional_id?: string | null;
  professional_name?: string | null;
  professional_specialty?: string | null;
  professional_color?: string | null;
}

interface ListCollaboratorsResponse {
  success: boolean;
  collaborators?: Collaborator[];
  error?: string;
}

async function fetchCollaborators(): Promise<Collaborator[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No active session');
  }

  const { data, error } = await supabase.functions.invoke<ListCollaboratorsResponse>(
    'list-collaborators',
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(error.message || 'Failed to fetch collaborators');
  }

  if (!data?.success || !data.collaborators) {
    throw new Error(data?.error || 'Failed to fetch collaborators');
  }

  return data.collaborators;
}

export function useCollaborators() {
  return useQuery({
    queryKey: ['collaborators'],
    queryFn: fetchCollaborators,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}
