import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, TeamMemberCardData, CatchNextTeam } from '@/types';

export const teamService = {
  /** Create a team in the active event; creator becomes captain + first member. */
  async create(eventId: string, name: string, captainId: string): Promise<Team> {
    const { data: team, error } = await supabase
      .from('teams').insert({ event_id: eventId, name, captain_id: captainId }).select().single();
    if (error) throw error;

    const { error: memErr } = await supabase.from('team_members').insert({
      team_id: team.id, user_id: captainId, event_id: eventId, role: 'captain',
    });
    if (memErr) throw memErr;
    return team;
  },

  async listForEvent(eventId: string): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams').select('*').eq('event_id', eventId).order('name');
    if (error) throw error;
    return data ?? [];
  },

  async join(teamId: string, eventId: string, userId: string): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, event_id: eventId, user_id: userId, role: 'member' })
      .select().single();
    if (error) throw error; // unique(event_id,user_id) → already on a team
    return data;
  },

  async myMembership(eventId: string, userId: string): Promise<TeamMember | null> {
    const { data, error } = await supabase
      .from('team_members').select('*')
      .eq('event_id', eventId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Member cards: roster + per-event totals + earned badges, sorted by steps. */
  async members(teamId: string, eventId: string): Promise<TeamMemberCardData[]> {
    const { data: roster, error } = await supabase
      .from('team_members')
      .select('role, users!inner(id, full_name, avatar_url)')
      .eq('team_id', teamId);
    if (error) throw error;

    const { data: totals } = await supabase
      .from('v_individual_leaderboard').select('user_id, total_steps').eq('event_id', eventId);
    const { data: badges } = await supabase
      .from('user_badges')
      .select('user_id, badges!inner(code, icon, name)')
      .eq('event_id', eventId);

    const totalsMap = new Map(totals?.map((t) => [t.user_id, t.total_steps]));
    const badgeMap = new Map<string, TeamMemberCardData['badges']>();
    badges?.forEach((b: any) => {
      const list = badgeMap.get(b.user_id) ?? [];
      list.push(b.badges);
      badgeMap.set(b.user_id, list);
    });

    return (roster ?? [])
      .map((r: any) => ({
        user_id: r.users.id,
        full_name: r.users.full_name,
        avatar_url: r.users.avatar_url,
        role: r.role,
        total_steps: totalsMap.get(r.users.id) ?? 0,
        badges: badgeMap.get(r.users.id) ?? [],
      }))
      .sort((a, b) => b.total_steps - a.total_steps);
  },

  /** Steps needed to overtake the team directly above us. */
  async catchNext(teamId: string): Promise<CatchNextTeam | null> {
    const { data, error } = await supabase.rpc('catch_next_team', { p_team_id: teamId });
    if (error) throw error;
    return data?.[0] ?? null;
  },
};
