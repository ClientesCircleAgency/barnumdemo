import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface ClinicSetting {
  id: string;
  key: string;
  value: Json;
  updated_at: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ['clinic_settings'],
    queryFn: async (): Promise<Record<string, Json>> => {
      const { data, error } = await supabase
        .from('clinic_settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert array to object keyed by setting key
      const settings: Record<string, Json> = {};
      ((data || []) as ClinicSetting[]).forEach((row) => {
        settings[row.key] = row.value;
      });
      
      return settings;
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      const { data, error } = await supabase
        .from('clinic_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic_settings'] });
    },
  });
}
