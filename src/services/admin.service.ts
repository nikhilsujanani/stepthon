import { supabase } from '@/lib/supabase';

export interface AdminStats {
  totalParticipants: number;
  totalTeams: number;
  participationRate: number;   // % of members who logged today
  todaysSteps: number;
  totalEventSteps: number;
  topTeam: { name: string; steps: number } | null;
  mostActiveUser: { name: string; steps: number } | null;
}

export interface DailyPoint { date: string; steps: number; participants: number }

export const adminService = {
  async stats(eventId: string): Promise<AdminStats> {
    const today = new Date().toISOString().slice(0, 10);

    const [{ count: members }, { count: teams }, teamLb, indLb, todayRows, allRows] =
      await Promise.all([
        supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('teams').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('v_team_leaderboard').select('team_name, total_steps').eq('event_id', eventId).order('rank').limit(1),
        supabase.from('v_individual_leaderboard').select('full_name, total_steps').eq('event_id', eventId).order('rank').limit(1),
        supabase.from('daily_steps').select('user_id, steps').eq('event_id', eventId).eq('step_date', today),
        supabase.from('daily_steps').select('steps').eq('event_id', eventId),
      ]);

    const todaysSteps = (todayRows.data ?? []).reduce((s, r) => s + r.steps, 0);
    const totalEventSteps = (allRows.data ?? []).reduce((s, r) => s + r.steps, 0);
    const loggedToday = new Set((todayRows.data ?? []).map((r) => r.user_id)).size;

    return {
      totalParticipants: members ?? 0,
      totalTeams: teams ?? 0,
      participationRate: members ? Math.round((loggedToday / members) * 100) : 0,
      todaysSteps,
      totalEventSteps,
      topTeam: teamLb.data?.[0] ? { name: teamLb.data[0].team_name, steps: teamLb.data[0].total_steps } : null,
      mostActiveUser: indLb.data?.[0] ? { name: indLb.data[0].full_name, steps: indLb.data[0].total_steps } : null,
    };
  },

  /** Daily step trend + participation for charts. */
  async dailyTrend(eventId: string): Promise<DailyPoint[]> {
    const { data } = await supabase
      .from('daily_steps').select('step_date, steps, user_id').eq('event_id', eventId);
    const byDay = new Map<string, { steps: number; users: Set<string> }>();
    (data ?? []).forEach((r) => {
      const e = byDay.get(r.step_date) ?? { steps: 0, users: new Set<string>() };
      e.steps += r.steps; e.users.add(r.user_id); byDay.set(r.step_date, e);
    });
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), steps: v.steps, participants: v.users.size }));
  },
};
