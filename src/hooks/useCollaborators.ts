import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

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

interface EdgeFnResponse {
  success: boolean;
  error?: string;
  message?: string;
}

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'x-user-token': session.access_token,
  };
}

async function extractError(error: any, fallback: string): Promise<string> {
  try {
    if (error.context && typeof error.context.json === 'function') {
      const errBody = await error.context.json();
      return errBody?.error || fallback;
    }
    return error.message || fallback;
  } catch {
    return error.message || fallback;
  }
}

async function fetchCollaborators(): Promise<Collaborator[]> {
  const headers = await getHeaders();
  const { data, error } = await supabase.functions.invoke<ListCollaboratorsResponse>(
    'list-collaborators',
    { headers }
  );

  if (error) {
    throw new Error(await extractError(error, 'Failed to fetch collaborators'));
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
    staleTime: 30000,
    retry: 2,
  });
}

// --- Mutations ---

export interface UpdateCollaboratorParams {
  user_id: string;
  role?: 'admin' | 'secretary' | 'doctor';
  professional?: {
    action: 'link' | 'unlink' | 'update';
    id?: string;
    name?: string;
    specialty_id?: string | null;
    color?: string | null;
  } | null;
}

export function useUpdateCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateCollaboratorParams) => {
      const headers = await getHeaders();
      const { data, error } = await supabase.functions.invoke<EdgeFnResponse>(
        'update-collaborator',
        { body: params, headers }
      );

      if (error) {
        throw new Error(await extractError(error, 'Failed to update collaborator'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update collaborator');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export interface DeleteCollaboratorParams {
  user_id: string;
}

export function useDeleteCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteCollaboratorParams) => {
      const headers = await getHeaders();
      const { data, error } = await supabase.functions.invoke<EdgeFnResponse>(
        'delete-collaborator',
        { body: params, headers }
      );

      if (error) {
        throw new Error(await extractError(error, 'Failed to delete collaborator'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete collaborator');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}
