import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { eventService } from '@/services/event.service';
import { eventAccessSchema, type EventAccessInput } from '@/lib/validation';
import { useParticipationStatus } from '@/hooks/useActiveEvent';
import { qk } from '@/lib/constants';
import type { EventParticipationStatus } from '@/types';

const MOTIVATION_QUOTES = [
  'Every step counts toward a healthier you! 🚶',
  'Walk together, win together—your team is counting on you! 💪',
  'Your health is your wealth. Take that step! 💎',
  'Progress, not perfection. Every step is progress! ⚡',
  "The only step backward is the one you don't take. Keep moving! 🎯",
  'Your legs can take you to great places. Use them! 🌟',
  "A thousand-mile journey begins with a single step. You're on your way! 🏃",
  'Consistency is key. One day at a time, one step at a time! 🔑',
] as const;

interface EventParticipationGateProps {
  eventId: string;
  children: React.ReactNode;
}

export function EventParticipationGate({ eventId, children }: EventParticipationGateProps) {
  const { data: status, isLoading } = useParticipationStatus();

  if (isLoading) {
    return (
      <div className="grid h-24 place-items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.allowed) {
    return <AccessBlocked eventId={eventId} status={status!} />;
  }

  return <>{children}</>;
}

function AccessBlocked({
  eventId,
  status,
}: {
  eventId: string;
  status: EventParticipationStatus;
}) {
  if (status.reason === 'setup_required') {
    return (
      <div className="space-y-4 py-2">
        <h1 className="text-xl font-bold">Event Not Available</h1>
        <p className="text-sm text-muted-foreground">
          {status.message ?? 'Event access verification required.'}
        </p>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            The event organizer must configure a join code and password before participants can
            continue. Please check back later.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <VerifyEventAccess eventId={eventId} message={status.message} />;
}

function VerifyEventAccess({ eventId, message }: { eventId: string; message: string | null }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<EventAccessInput>({
    resolver: zodResolver(eventAccessSchema),
  });

  const [quote] = useState(
    () => MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)],
  );

  const verify = useMutation({
    mutationFn: (input: EventAccessInput) =>
      eventService.verifyAccess(input.join_code, input.password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.participationStatus(eventId) });
      qc.invalidateQueries({ queryKey: qk.eventAccess(eventId) });
    },
  });

  const verifyError = verify.error
    ? String((verify.error as { message?: string }).message ?? verify.error).includes('INVALID')
      ? 'Invalid join code or password.'
      : (message ?? 'Event access verification required.')
    : null;

  return (
    <div className="space-y-6 py-2">
      {/* App Introduction */}
      <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-4 border border-primary/20">
        <h2 className="font-bold text-lg mb-2">Welcome to Stepathon! 🏆</h2>
        <p className="text-sm text-foreground mb-3">
          Stepathon is a team-based fitness challenge where you compete with colleagues to log the most steps.
          It's not just about winning—it's about building healthier habits together and supporting your team!
        </p>
        <ul className="text-sm space-y-1.5 text-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">📊</span>
            <span><strong>Track Steps:</strong> Log your daily steps and watch your progress grow</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">👥</span>
            <span><strong>Team Power:</strong> Join your team and climb the leaderboard together</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">🎯</span>
            <span><strong>Stay Motivated:</strong> Earn badges and celebrate milestones with your team</span>
          </li>
        </ul>
      </div>

      {/* Motivational Quote */}
      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-4">
          <p className="text-center text-sm font-medium text-primary italic">
            "{quote}"
          </p>
        </CardContent>
      </Card>

      {/* Access Code Form */}
      <div>
        <h1 className="text-xl font-bold mb-2">Join Your Event</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {message ?? 'Enter your event access code to get started.'}
        </p>
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit((v) => verify.mutate(v))} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="va-join-code">Join Code</Label>
                <Input id="va-join-code" autoComplete="off" placeholder="Enter your join code" {...register('join_code')} />
                {errors.join_code && (
                  <p className="text-xs text-destructive">{errors.join_code.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="va-password">Event Password</Label>
                <Input
                  id="va-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter event password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
              {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}
              <Button type="submit" className="w-full" disabled={verify.isPending}>
                {verify.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Get Started'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer Info */}
      <p className="text-center text-xs text-muted-foreground">
        Don't have an access code? Ask your event organizer to get started!
      </p>
    </div>
  );
}
