import { useQuery } from '@tanstack/react-query';
import { eventService } from '@/services/event.service';
import { teamService } from '@/services/team.service';
import { qk } from '@/lib/constants';
import { useAuth } from './useAuth';

export function useActiveEvent() {
  return useQuery({ queryKey: qk.activeEvent, queryFn: eventService.getActive });
}

export function useMyMembership() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  return useQuery({
    queryKey: event ? qk.myMembership(event.id) : ['membership', 'none'],
    enabled: !!event && !!session,
    queryFn: () => teamService.myMembership(event!.id, session!.user.id),
  });
}

export function useParticipationStatus() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  return useQuery({
    queryKey: event ? qk.participationStatus(event.id) : ['participation', 'none'],
    enabled: !!event && !!session,
    queryFn: () => eventService.getParticipationStatus(event!.id),
  });
}

/** @deprecated use useParticipationStatus */
export function useEventAccess() {
  const { data: status, ...rest } = useParticipationStatus();
  return {
    ...rest,
    data: status?.allowed ?? false,
  };
}
