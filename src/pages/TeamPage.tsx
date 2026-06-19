import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crown, Users, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/common/StatCard';
import { CatchNextWidget } from '@/components/common/CatchNextWidget';
import { TeamMemberCard } from '@/components/team/TeamMemberCard';
import { teamService } from '@/services/team.service';
import { eventService } from '@/services/event.service';
import { createTeamSchema, eventAccessSchema, type CreateTeamInput, type EventAccessInput } from '@/lib/validation';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEvent, useMyMembership, useEventAccess } from '@/hooks/useActiveEvent';
import { useTeamLeaderboard, useCatchNext } from '@/hooks/useLeaderboard';
import { qk } from '@/lib/constants';
import { fmtSteps, rankSuffix } from '@/lib/format';

export function TeamPage() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  const { data: membership } = useMyMembership();
  const { data: hasAccess, isLoading: accessLoading } = useEventAccess();

  if (!event) return <p className="py-10 text-center text-muted-foreground">No active event.</p>;
  if (accessLoading) {
    return (
      <div className="grid h-24 place-items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!membership && hasAccess === false) {
    return <VerifyEventAccess eventId={event.id} />;
  }
  if (!membership) return <JoinOrCreate eventId={event.id} userId={session!.user.id} />;
  return <MyTeam eventId={event.id} teamId={membership.team_id} />;
}

function VerifyEventAccess({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<EventAccessInput>({
    resolver: zodResolver(eventAccessSchema),
  });

  const verify = useMutation({
    mutationFn: (input: EventAccessInput) =>
      eventService.verifyAccess(input.join_code, input.password),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.eventAccess(eventId) }),
  });

  const verifyError = verify.error
    ? String((verify.error as { message?: string }).message ?? verify.error).includes('INVALID')
      ? 'Invalid join code or password.'
      : 'Could not verify access. Please try again.'
    : null;

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Enter Event Access</h1>
      <p className="text-sm text-muted-foreground">
        Enter the join code and password provided by your event organizer.
      </p>
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit((v) => verify.mutate(v))} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="va-join-code">Join Code</Label>
              <Input id="va-join-code" autoComplete="off" {...register('join_code')} />
              {errors.join_code && (
                <p className="text-xs text-destructive">{errors.join_code.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-password">Event Password</Label>
              <Input id="va-password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}
            <Button type="submit" className="w-full" disabled={verify.isPending}>
              {verify.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify Access'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MyTeam({ eventId, teamId }: { eventId: string; teamId: string }) {
  const { data: teamLb } = useTeamLeaderboard(eventId);
  const { data: catchNext } = useCatchNext(teamId);
  const { data: members = [] } = useQuery({
    queryKey: qk.teamMembers(teamId),
    queryFn: () => teamService.members(teamId, eventId),
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
  const { data: teams = [] } = useQuery({
    queryKey: ['teams', eventId],
    queryFn: () => teamService.listForEvent(eventId),
  });

  const join = useMutation({
    mutationFn: (teamId: string) => teamService.join(teamId, eventId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myMembership(eventId) }),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
  });
  const create = useMutation({
    mutationFn: (v: CreateTeamInput) => teamService.create(eventId, v.name, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myMembership(eventId) }),
  });

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
            <Card key={t.id} className="flex items-center justify-between p-3">
              <p className="font-semibold">{t.name}</p>
              <Button size="sm" onClick={() => join.mutate(t.id)} disabled={join.isPending}>Join</Button>
            </Card>
          ))}
          {join.isError && <p className="text-sm text-destructive">Could not join — you may already be on a team.</p>}
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
