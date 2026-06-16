import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/constants';

/**
 * Subscribe to Postgres changes for the active event and invalidate the
 * relevant queries. This is what makes leaderboards + feed update live.
 * Enable Realtime on these tables in Supabase → Database → Replication.
 */
export function useRealtimeEvent(eventId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`event:${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'daily_steps', filter: `event_id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: qk.teamLeaderboard(eventId) });
          qc.invalidateQueries({ queryKey: qk.individualLeaderboard(eventId) });
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_feed', filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: qk.activity(eventId) }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, qc]);
}

/** Personal channel for the in-app notification bell. */
export function useRealtimeNotifications(userId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: qk.notifications }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);
}
