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
      // Check if setting exists
      const { data: existing } = await supabase
        .from('clinic_settings')
        .select('id')
        .eq('key', key)
        .maybeSingle();
      
      let result;
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('clinic_settings')
          .update({ value })
          .eq('key', key)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('clinic_settings')
          .insert([{ key, value }])
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic_settings'] });
    },
  });
}
