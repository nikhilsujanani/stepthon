import { supabase } from '@/lib/supabase';
import type { Activity } from '@/types';

export const activityService = {
  async forEvent(eventId: string, limit = 30): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activity_feed').select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async forTeam(teamId: string, limit = 30): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activity_feed').select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },
};
