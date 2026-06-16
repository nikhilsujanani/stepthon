import { supabase } from '@/lib/supabase';
import type { Badge, UserBadge } from '@/types';

export interface EarnedBadge extends Badge {
  awarded_at: string | null;
  earned: boolean;
}

export const badgeService = {
  async catalog(): Promise<Badge[]> {
    const { data, error } = await supabase
      .from('badges').select('*').order('sort_order');
    if (error) throw error;
    return data ?? [];
  },

  async myBadges(eventId: string, userId: string): Promise<UserBadge[]> {
    const { data, error } = await supabase
      .from('user_badges').select('*').eq('event_id', eventId).eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },

  /** Full collection with earned/locked state for the Profile badge grid. */
  async collection(eventId: string, userId: string): Promise<EarnedBadge[]> {
    const [catalog, earned] = await Promise.all([
      this.catalog(),
      this.myBadges(eventId, userId),
    ]);
    const earnedMap = new Map(earned.map((e) => [e.badge_id, e.awarded_at]));
    return catalog.map((b) => ({
      ...b,
      earned: earnedMap.has(b.id),
      awarded_at: earnedMap.get(b.id) ?? null,
    }));
  },
};
