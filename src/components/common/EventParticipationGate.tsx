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
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Enter Event Access</h1>
      <p className="text-sm text-muted-foreground">
        {message ?? 'Event access verification required.'}
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
              <Input
                id="va-password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
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
