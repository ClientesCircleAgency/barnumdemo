import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface Collaborator {
  user_id: string;
  email: string;
  role: 'admin' | 'secretary' | 'doctor';
  color?: string | null;
  photo_url?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
  professional_specialty_id?: string | null;
  professional_specialty?: string | null;
  professional_color?: string | null;
  professional_avatar_url?: string | null;
  active_specialty_ids?: string[] | null;
  active_consultation_type_ids?: string[] | null;
  working_hours?: Json | null;
  time_off?: Json | null;
  extra_permissions?: Json | null;
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

async function getFunctionHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'x-user-token': session.access_token,
  };
}

async function invokeStaffFunction<TResponse>(
  functionName: string,
  body?: unknown
): Promise<TResponse> {
  const headers = await getFunctionHeaders();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: TResponse & { error?: string };
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Failed to read ${functionName} response`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Failed to call ${functionName}`);
  }

  return payload;
}

async function fetchCollaborators(): Promise<Collaborator[]> {
  const data = await invokeStaffFunction<ListCollaboratorsResponse>('list-collaborators');

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
  color?: string | null;
  profile?: {
    full_name?: string;
    color?: string | null;
    active_specialty_ids?: string[];
    active_consultation_type_ids?: string[];
    working_hours?: Json;
    time_off?: Json;
    extra_permissions?: Json;
  } | null;
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
      const data = await invokeStaffFunction<EdgeFnResponse>('update-collaborator', params);
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
      const data = await invokeStaffFunction<EdgeFnResponse>('delete-collaborator', params);
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
