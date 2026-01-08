import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RoomRow } from '@/types/database';

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async (): Promise<RoomRow[]> => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}
