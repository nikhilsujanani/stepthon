import { supabase } from '@/lib/supabase';
import type { TeamLeaderboardRow, IndividualLeaderboardRow } from '@/types';

export interface WithMovement<T> {
  row: T;
  rank: number;
  previousRank: number | null;
}

async function previousRanks(eventId: string, scope: 'team' | 'individual') {
  // Most recent snapshot per entity → previous_rank for movement arrows.
  const { data } = await supabase
    .from('leaderboard_snapshots')
    .select('entity_id, rank, captured_at')
    .eq('event_id', eventId).eq('scope', scope)
    .order('captured_at', { ascending: false })
    .limit(500);
  const map = new Map<string, number>();
  data?.forEach((s) => { if (!map.has(s.entity_id)) map.set(s.entity_id, s.rank); });
  return map;
}

export const leaderboardService = {
  async teams(eventId: string): Promise<WithMovement<TeamLeaderboardRow>[]> {
    const [{ data, error }, prev] = await Promise.all([
      supabase.from('v_team_leaderboard').select('*')
        .eq('event_id', eventId).order('rank', { ascending: true }),
      previousRanks(eventId, 'team'),
    ]);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      row, rank: row.rank, previousRank: prev.get(row.team_id) ?? null,
    }));
  },

  async individuals(eventId: string): Promise<WithMovement<IndividualLeaderboardRow>[]> {
    const [{ data, error }, prev] = await Promise.all([
      supabase.from('v_individual_leaderboard').select('*')
        .eq('event_id', eventId).order('rank', { ascending: true }),
      previousRanks(eventId, 'individual'),
    ]);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      row, rank: row.rank, previousRank: prev.get(row.user_id) ?? null,
    }));
  },
};
