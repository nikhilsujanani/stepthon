import { useQuery } from '@tanstack/react-query';
import { leaderboardService } from '@/services/leaderboard.service';
import { teamService } from '@/services/team.service';
import { qk } from '@/lib/constants';

export function useTeamLeaderboard(eventId?: string) {
  return useQuery({
    queryKey: eventId ? qk.teamLeaderboard(eventId) : ['lb', 'team', 'none'],
    enabled: !!eventId,
    queryFn: () => leaderboardService.teams(eventId!),
  });
}

export function useIndividualLeaderboard(eventId?: string) {
  return useQuery({
    queryKey: eventId ? qk.individualLeaderboard(eventId) : ['lb', 'ind', 'none'],
    enabled: !!eventId,
    queryFn: () => leaderboardService.individuals(eventId!),
  });
}

export function useCatchNext(teamId?: string) {
  return useQuery({
    queryKey: teamId ? qk.catchNext(teamId) : ['catch', 'none'],
    enabled: !!teamId,
    queryFn: () => teamService.catchNext(teamId!),
  });
}
