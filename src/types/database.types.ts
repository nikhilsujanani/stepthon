/**
 * Hand-authored stand-in for `supabase gen types typescript`.
 * Once your project is linked, regenerate with `npm run db:types` to keep this
 * in lockstep with the schema. Only the surfaces the app touches are typed here.
 */
export type AppRole = 'admin' | 'member';
export type TeamRole = 'captain' | 'member';
export type EventStatus = 'draft' | 'active' | 'closed';
export type ActivityType =
  | 'steps_submitted' | 'badge_earned' | 'rank_changed' | 'streak' | 'team_joined' | 'milestone';
export type NotifType =
  | 'daily_reminder' | 'achievement' | 'ranking_change' | 'challenge_alert' | 'system';
export type BadgeCriteria =
  | 'single_day_threshold' | 'total_threshold' | 'streak' | 'consistency' | 'top_contributor';
export type LeaderboardScope = 'team' | 'individual';

interface Row<T> { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }
interface ViewRow<T> { Row: T; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      users: Row<{
        id: string; email: string; full_name: string; avatar_url: string | null;
        role: AppRole; created_at: string; updated_at: string;
      }>;
      events: Row<{
        id: string; name: string; description: string; start_date: string; end_date: string;
        status: EventStatus; max_steps_per_day: number; goal_steps: number | null;
        join_code: string | null; password_hash: string | null;
        requires_admin_setup: boolean;
        created_by: string; created_at: string; updated_at: string;
      }>;
      event_access: Row<{
        event_id: string; user_id: string; granted_at: string;
      }>;
      teams: Row<{
        id: string; event_id: string; name: string; captain_id: string; created_at: string;
      }>;
      team_members: Row<{
        id: string; team_id: string; user_id: string; event_id: string;
        role: TeamRole; joined_at: string;
      }>;
      daily_steps: Row<{
        id: string; user_id: string; team_id: string; event_id: string;
        step_date: string; steps: number; proof_url: string | null;
        created_at: string; updated_at: string;
      }>;
      badges: Row<{
        id: string; code: string; name: string; description: string; icon: string;
        criteria_type: BadgeCriteria; threshold: number | null; sort_order: number;
      }>;
      user_badges: Row<{
        id: string; user_id: string; badge_id: string; event_id: string; awarded_at: string;
      }>;
      activity_feed: Row<{
        id: string; event_id: string; team_id: string | null; user_id: string | null;
        type: ActivityType; message: string; metadata: Record<string, unknown>; created_at: string;
      }>;
      notifications: Row<{
        id: string; user_id: string; type: NotifType; title: string; body: string;
        read: boolean; metadata: Record<string, unknown>; created_at: string;
      }>;
      push_subscriptions: Row<{
        id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: string;
      }>;
      leaderboard_snapshots: Row<{
        id: string; event_id: string; scope: LeaderboardScope; entity_id: string;
        rank: number; previous_rank: number | null; total_steps: number; captured_at: string;
      }>;
    };
    Views: {
      v_team_leaderboard: ViewRow<{
        event_id: string; team_id: string; team_name: string; captain_id: string;
        total_steps: number; active_members: number; member_count: number; rank: number;
      }>;
      v_individual_leaderboard: ViewRow<{
        event_id: string; user_id: string; team_id: string; full_name: string;
        avatar_url: string | null; total_steps: number; days_logged: number;
        best_day: number; team_name: string; rank: number;
      }>;
      v_team_totals: ViewRow<{
        event_id: string; team_id: string; team_name: string; captain_id: string;
        total_steps: number; active_members: number; member_count: number;
      }>;
      v_individual_totals: ViewRow<{
        event_id: string; user_id: string; team_id: string; full_name: string;
        avatar_url: string | null; total_steps: number; days_logged: number; best_day: number;
      }>;
    };
    Functions: {
      submit_steps: {
        Args: { p_step_date: string; p_steps: number };
        Returns: Database['public']['Tables']['daily_steps']['Row'];
      };
      catch_next_team: {
        Args: { p_team_id: string };
        Returns: { next_team_id: string; next_team_name: string; gap: number }[];
      };
      current_streak: { Args: { p_user_id: string; p_event_id: string }; Returns: number };
      capture_leaderboard_snapshot: { Args: { p_event_id: string }; Returns: undefined };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      set_event_password: { Args: { p_event_id: string; p_password: string }; Returns: undefined };
      verify_event_access: { Args: { p_join_code: string; p_password: string }; Returns: undefined };
      event_requires_access: { Args: { p_event_id: string }; Returns: boolean };
      event_access_configured: { Args: { p_event_id: string }; Returns: boolean };
      get_event_participation_status: { Args: { p_event_id: string }; Returns: Record<string, unknown> };
    };
    Enums: {
      app_role: AppRole; team_role: TeamRole; event_status: EventStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
