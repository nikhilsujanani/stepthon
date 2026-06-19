import { Link } from 'react-router-dom';
import { Footprints, Flag, Trophy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { ProgressCard } from '@/components/common/ProgressCard';
import { CatchNextWidget } from '@/components/common/CatchNextWidget';
import { ActivityCard } from '@/components/common/ActivityCard';
import { EventParticipationGate } from '@/components/common/EventParticipationGate';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEvent, useMyMembership } from '@/hooks/useActiveEvent';
import { useTeamLeaderboard, useCatchNext } from '@/hooks/useLeaderboard';
import { useQuery } from '@tanstack/react-query';
import { stepService } from '@/services/step.service';
import { activityService } from '@/services/activity.service';
import { qk } from '@/lib/constants';
import { fmtSteps, rankSuffix } from '@/lib/format';

export function HomePage() {
  const { session, profile } = useAuth();
  const { data: event } = useActiveEvent();
  const { data: membership } = useMyMembership();
  const { data: teamLb } = useTeamLeaderboard(event?.id);
  const { data: catchNext } = useCatchNext(membership?.team_id);

  const { data: todaySteps = 0 } = useQuery({
    queryKey: event ? [...qk.mySteps(event.id), 'today'] : ['today', 'none'],
    enabled: !!event && !!session,
    queryFn: () => stepService.todaysSteps(event!.id, session!.user.id),
  });

  const { data: activity = [] } = useQuery({
    queryKey: event ? qk.activity(event.id) : ['activity', 'none'],
    enabled: !!event,
    queryFn: () => activityService.forEvent(event!.id, 12),
  });

  if (!event) return <EmptyState />;

  return (
    <EventParticipationGate eventId={event.id}>
      <HomeDashboard
        event={event}
        membership={membership}
        teamLb={teamLb}
        catchNext={catchNext}
        todaySteps={todaySteps}
        activity={activity}
        profile={profile}
      />
    </EventParticipationGate>
  );
}

function HomeDashboard({
  event,
  membership,
  teamLb,
  catchNext,
  todaySteps,
  activity,
  profile,
}: {
  event: NonNullable<ReturnType<typeof useActiveEvent>['data']>;
  membership: ReturnType<typeof useMyMembership>['data'];
  teamLb: ReturnType<typeof useTeamLeaderboard>['data'];
  catchNext: ReturnType<typeof useCatchNext>['data'];
  todaySteps: number;
  activity: Awaited<ReturnType<typeof activityService.forEvent>>;
  profile: ReturnType<typeof useAuth>['profile'];
}) {
  const myTeam = teamLb?.find((t) => t.row.team_id === membership?.team_id);
  const eventTotal = teamLb?.reduce((s, t) => s + t.row.total_steps, 0) ?? 0;

  return (
    <div className="space-y-4 py-2">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="text-xl font-bold">{profile?.full_name?.split(' ')[0] || 'Walker'} 👋</h1>
        </div>
        <p className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {event.name}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today's Steps" value={fmtSteps(todaySteps)} icon={Footprints} />
        <StatCard
          label="Team Rank"
          value={myTeam ? rankSuffix(myTeam.rank) : '—'}
          icon={Trophy}
          hint={myTeam?.row.team_name}
        />
      </div>

      <Button asChild size="lg" className="w-full">
        <Link to="/update"><Plus className="h-5 w-5" /> Update Steps</Link>
      </Button>

      {membership && <CatchNextWidget data={catchNext ?? null} />}

      {event.goal_steps && (
        <ProgressCard title="Event Goal" current={eventTotal} goal={event.goal_steps} subtitle="all teams" />
      )}

      {myTeam && (
        <ProgressCard
          title={`${myTeam.row.team_name} progress`}
          current={myTeam.row.total_steps}
          goal={(teamLb?.[0]?.row.total_steps ?? myTeam.row.total_steps) || 1}
          subtitle={`vs Rank #1`}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">Activity Feed</h2>
          </div>
          <div className="divide-y">
            {activity.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No activity yet — be the first!</p>
            )}
            {activity.map((a) => <ActivityCard key={a.id} item={a} />)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <Flag className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">No active event</p>
        <p className="text-sm text-muted-foreground">Check back when your admin starts the next Stepathon.</p>
      </div>
    </div>
  );
}
