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
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .neq('role', 'admin')
    .order('role');

  if (rolesError) throw rolesError;
  if (!roles?.length) return [];

  const userIds = roles.map((role) => role.user_id);

  const [{ data: profiles, error: profilesError }, { data: professionals, error: professionalsError }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('user_id, full_name, color, photo_url, active_specialty_ids, active_consultation_type_ids, working_hours, time_off, extra_permissions')
      .in('user_id', userIds),
    supabase
      .from('professionals')
      .select('id, user_id, name, specialty_id, color, avatar_url')
      .in('user_id', userIds),
  ]);

  if (profilesError) throw profilesError;
  if (professionalsError) throw professionalsError;

  const specialtyIds = Array.from(
    new Set((professionals || []).map((professional) => professional.specialty_id).filter(Boolean))
  ) as string[];

  const { data: specialties, error: specialtiesError } = specialtyIds.length
    ? await supabase.from('specialties').select('id, name').in('id', specialtyIds)
    : { data: [], error: null };

  if (specialtiesError) throw specialtiesError;

  const profilesByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
  const professionalsByUserId = new Map((professionals || []).map((professional) => [professional.user_id, professional]));
  const specialtiesById = new Map((specialties || []).map((specialty) => [specialty.id, specialty.name]));

  const collaborators = roles
    .filter((role) => role.role === 'doctor' || role.role === 'secretary')
    .map((role): Collaborator => {
      const profile = profilesByUserId.get(role.user_id);
      const professional = professionalsByUserId.get(role.user_id);
      const displayName = profile?.full_name || professional?.name || 'Colaborador';

      return {
        user_id: role.user_id,
        email: displayName,
        role: role.role,
        color: profile?.color || null,
        photo_url: profile?.photo_url || null,
        active_specialty_ids: profile?.active_specialty_ids || null,
        active_consultation_type_ids: profile?.active_consultation_type_ids || null,
        working_hours: profile?.working_hours || null,
        time_off: profile?.time_off || null,
        extra_permissions: profile?.extra_permissions || null,
        professional_id: professional?.id || null,
        professional_name: professional?.name || profile?.full_name || null,
        professional_specialty_id: professional?.specialty_id || null,
        professional_specialty: professional?.specialty_id ? specialtiesById.get(professional.specialty_id) || null : null,
        professional_color: professional?.color || null,
        professional_avatar_url: professional?.avatar_url || null,
      };
    });

  if (collaborators.length > 0) {
    return collaborators;
  }

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
      if (params.role === 'admin') {
        throw new Error('Admin accounts are managed in the database only');
      }

      if (params.role) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: params.role })
          .eq('user_id', params.user_id)
          .neq('role', 'admin');

        if (error) throw error;
      }

      if (params.profile) {
        const fullName = params.profile.full_name || 'Colaborador';
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: params.user_id,
            full_name: fullName,
            ...(params.profile.color !== undefined && { color: params.profile.color }),
            ...(params.profile.active_specialty_ids !== undefined && { active_specialty_ids: params.profile.active_specialty_ids }),
            ...(params.profile.active_consultation_type_ids !== undefined && { active_consultation_type_ids: params.profile.active_consultation_type_ids }),
            ...(params.profile.working_hours !== undefined && { working_hours: params.profile.working_hours }),
            ...(params.profile.time_off !== undefined && { time_off: params.profile.time_off }),
            ...(params.profile.extra_permissions !== undefined && { extra_permissions: params.profile.extra_permissions }),
          }, { onConflict: 'user_id' });

        if (error) throw error;
      }

      if (params.professional?.action === 'update') {
        const { data: existingProfessional, error: existingError } = await supabase
          .from('professionals')
          .select('id')
          .eq('user_id', params.user_id)
          .maybeSingle();

        if (existingError) throw existingError;

        const professionalPayload = {
          user_id: params.user_id,
          name: params.professional.name || params.profile?.full_name || 'Profissional',
          specialty_id: params.professional.specialty_id || null,
          color: params.professional.color || params.color || '#6366f1',
        };

        const { error } = existingProfessional
          ? await supabase
            .from('professionals')
            .update(professionalPayload)
            .eq('id', existingProfessional.id)
          : await supabase
            .from('professionals')
            .insert(professionalPayload);

        if (error) throw error;
      }

      if (params.professional?.action === 'unlink') {
        const { error } = await supabase
          .from('professionals')
          .update({ user_id: null })
          .eq('user_id', params.user_id);

        if (error) throw error;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      queryClient.invalidateQueries({ queryKey: ['professional-availability'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
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
