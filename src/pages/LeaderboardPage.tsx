import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LeaderboardCard } from '@/components/leaderboard/LeaderboardCard';
import { EventParticipationGate } from '@/components/common/EventParticipationGate';
import { fmtSteps } from '@/lib/format';
import { useActiveEvent, useMyMembership } from '@/hooks/useActiveEvent';
import { useTeamLeaderboard, useIndividualLeaderboard } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';

export function LeaderboardPage() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  const { data: membership } = useMyMembership();
  const { data: teams = [], isLoading: tLoading } = useTeamLeaderboard(event?.id);
  const { data: people = [], isLoading: iLoading } = useIndividualLeaderboard(event?.id);

  if (!event) {
    return <p className="py-10 text-center text-muted-foreground">No active event.</p>;
  }

  return (
    <EventParticipationGate eventId={event.id}>
      <div className="space-y-4 py-2">
        <h1 className="text-xl font-bold">Leaderboard</h1>

        <Tabs defaultValue="teams">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="individuals">Individuals</TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="mt-4 space-y-2">
          {tLoading && <Skeletons />}
          {teams.map(({ row, rank, previousRank }) => (
            <LeaderboardCard
              key={row.team_id}
              rank={rank}
              previousRank={previousRank}
              name={row.team_name}
              totalSteps={row.total_steps}
              subtitle={`${row.member_count} members · ${fmtSteps(row.total_steps)} steps`}
              highlight={row.team_id === membership?.team_id}
            />
          ))}
        </TabsContent>

        <TabsContent value="individuals" className="mt-4 space-y-2">
          {iLoading && <Skeletons />}
          {people.map(({ row, rank, previousRank }) => (
            <LeaderboardCard
              key={row.user_id}
              rank={rank}
              previousRank={previousRank}
              name={row.full_name}
              totalSteps={row.total_steps}
              subtitle={row.team_name}
              avatarUrl={row.avatar_url}
              highlight={row.user_id === session?.user.id}
            />
          ))}
        </TabsContent>
      </Tabs>
      </div>
    </EventParticipationGate>
  );
}

const Skeletons = () =>
  Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
  ));
