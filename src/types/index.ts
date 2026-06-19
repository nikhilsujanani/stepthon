import type { Database } from './database.types';

type T = Database['public']['Tables'];
type V = Database['public']['Views'];

export type UserProfile = T['users']['Row'];
export type Event = Omit<T['events']['Row'], 'password_hash'>;
export type EventAccess = T['event_access']['Row'];

export type EventParticipationStatus = {
  allowed: boolean;
  reason: 'ok' | 'setup_required' | 'verification_required';
  message: string | null;
};

export type Team = T['teams']['Row'];
export type TeamMember = T['team_members']['Row'];
export type DailyStep = T['daily_steps']['Row'];
export type Badge = T['badges']['Row'];
export type UserBadge = T['user_badges']['Row'];
export type Activity = T['activity_feed']['Row'];
export type AppNotification = T['notifications']['Row'];

export type TeamLeaderboardRow = V['v_team_leaderboard']['Row'];
export type IndividualLeaderboardRow = V['v_individual_leaderboard']['Row'];

export interface CatchNextTeam {
  next_team_id: string;
  next_team_name: string;
  gap: number;
}

/** A team member enriched with their per-event totals + earned badges. */
export interface TeamMemberCardData {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: TeamMember['role'];
  total_steps: number;
  badges: Pick<Badge, 'code' | 'icon' | 'name'>[];
}
