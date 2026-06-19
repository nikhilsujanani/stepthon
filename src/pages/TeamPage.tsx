import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crown, Users, Plus, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/common/StatCard';
import { CatchNextWidget } from '@/components/common/CatchNextWidget';
import { TeamMemberCard } from '@/components/team/TeamMemberCard';
import { EventParticipationGate } from '@/components/common/EventParticipationGate';
import { teamService } from '@/services/team.service';
import { createTeamSchema, teamAccessRequestSchema, type CreateTeamInput, type TeamAccessRequestInput } from '@/lib/validation';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEvent, useMyMembership } from '@/hooks/useActiveEvent';
import { useTeamLeaderboard, useCatchNext } from '@/hooks/useLeaderboard';
import { qk } from '@/lib/constants';
import { fmtSteps, rankSuffix } from '@/lib/format';

export function TeamPage() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  const { data: membership } = useMyMembership();

  if (!event) return <p className="py-10 text-center text-muted-foreground">No active event.</p>;

  return (
    <EventParticipationGate eventId={event.id}>
      {!membership ? (
        <JoinOrCreate eventId={event.id} userId={session!.user.id} />
      ) : (
        <MyTeam eventId={event.id} teamId={membership.team_id} isCaptain={membership.role === 'captain'} />
      )}
    </EventParticipationGate>
  );
}

function MyTeam({
  eventId,
  teamId,
  isCaptain,
}: {
  eventId: string;
  teamId: string;
  isCaptain: boolean;
}) {
  const qc = useQueryClient();
  const { data: teamLb } = useTeamLeaderboard(eventId);
  const { data: catchNext } = useCatchNext(teamId);
  const { data: members = [] } = useQuery({
    queryKey: qk.teamMembers(teamId),
    queryFn: () => teamService.members(teamId, eventId),
  });
  const { data: pendingRequests = [] } = useQuery({
    queryKey: qk.teamJoinRequests(teamId),
    enabled: isCaptain,
    queryFn: () => teamService.pendingRequests(teamId),
  });

  const resolve = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      teamService.resolveRequest(requestId, approve),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.teamJoinRequests(teamId) });
      qc.invalidateQueries({ queryKey: qk.teamMembers(teamId) });
      qc.invalidateQueries({ queryKey: qk.myMembership(eventId) });
      qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });

  const me = teamLb?.find((t) => t.row.team_id === teamId);

  return (
    <div className="space-y-4 py-2">
      <header>
        <h1 className="text-xl font-bold">{me?.row.team_name ?? 'My Team'}</h1>
        <p className="text-sm text-muted-foreground">{members.length} members</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Team Rank" value={me ? rankSuffix(me.rank) : '—'} icon={Crown} />
        <StatCard label="Total Steps" value={fmtSteps(me?.row.total_steps ?? 0)} icon={Users} />
      </div>

      {isCaptain && pendingRequests.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Join Requests</h2>
            {pendingRequests.map((req) => (
              <div key={req.id} className="space-y-2 rounded-lg border p-3">
                <div>
                  <p className="font-semibold">{req.full_name}</p>
                  <p className="text-xs text-muted-foreground">{req.email}</p>
                  {req.message && (
                    <p className="mt-1 text-sm text-muted-foreground">{req.message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ requestId: req.id, approve: true })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ requestId: req.id, approve: false })}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CatchNextWidget data={catchNext ?? null} />

      <div className="space-y-2">
        <h2 className="font-semibold">Members</h2>
        {members.map((m) => <TeamMemberCard key={m.user_id} member={m} />)}
      </div>
    </div>
  );
}

function JoinOrCreate({ eventId, userId }: { eventId: string; userId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [requestTeamId, setRequestTeamId] = useState<string | null>(null);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', eventId],
    queryFn: () => teamService.listForEvent(eventId),
  });
  const { data: myPending = [] } = useQuery({
    queryKey: qk.myTeamJoinRequests(eventId),
    queryFn: () => teamService.myPendingRequests(eventId),
  });

  const pendingTeamIds = new Set(myPending.map((r) => r.team_id));

  const join = useMutation({
    mutationFn: (teamId: string) => teamService.join(teamId, eventId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myMembership(eventId) }),
  });

  const requestAccess = useMutation({
    mutationFn: ({ teamId, message }: { teamId: string; message?: string }) =>
      teamService.requestAccess(teamId, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myTeamJoinRequests(eventId) });
      qc.invalidateQueries({ queryKey: qk.notifications });
      setRequestTeamId(null);
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
  });
  const create = useMutation({
    mutationFn: (v: CreateTeamInput) => teamService.create(eventId, v.name, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myMembership(eventId) }),
  });

  const requestForm = useForm<TeamAccessRequestInput>({
    resolver: zodResolver(teamAccessRequestSchema),
    defaultValues: { message: '' },
  });

  const requestTeam = teams.find((t) => t.id === requestTeamId);

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Join a Team</h1>
      <div className="flex gap-2">
        <Button variant={tab === 'join' ? 'default' : 'outline'} className="flex-1" onClick={() => setTab('join')}>Join</Button>
        <Button variant={tab === 'create' ? 'default' : 'outline'} className="flex-1" onClick={() => setTab('create')}>Create</Button>
      </div>

      {tab === 'join' ? (
        <div className="space-y-2">
          {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams yet — create the first one!</p>}
          {teams.map((t) => (
            <Card key={t.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.name}</p>
                {pendingTeamIds.has(t.id) && (
                  <p className="text-xs text-muted-foreground">Request pending</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {!pendingTeamIds.has(t.id) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setRequestTeamId(t.id)}>
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => join.mutate(t.id)} disabled={join.isPending}>Join</Button>
                  </>
                )}
              </div>
            </Card>
          ))}
          {join.isError && <p className="text-sm text-destructive">Could not join — you may already be on a team.</p>}

          {requestTeam && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-medium">Request access to {requestTeam.name}</p>
                <form
                  onSubmit={requestForm.handleSubmit((v) =>
                    requestAccess.mutate({ teamId: requestTeam.id, message: v.message }),
                  )}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="req-message">Message (optional)</Label>
                    <Textarea
                      id="req-message"
                      rows={2}
                      placeholder="Introduce yourself to the team captain…"
                      {...requestForm.register('message')}
                    />
                    {requestForm.formState.errors.message && (
                      <p className="text-xs text-destructive">
                        {requestForm.formState.errors.message.message}
                      </p>
                    )}
                  </div>
                  {requestAccess.isError && (
                    <p className="text-xs text-destructive">
                      {String((requestAccess.error as Error).message).includes('PENDING')
                        ? 'You already have a pending request for this team.'
                        : 'Could not send request. Please try again.'}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRequestTeamId(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={requestAccess.isPending}>
                      {requestAccess.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        'Send Request'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-3">
              <input
                placeholder="Team name"
                className="h-11 w-full rounded-lg border bg-background px-3"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              {create.isError && <p className="text-xs text-destructive">Name taken — pick another.</p>}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-4 w-4" /> Create Team</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
