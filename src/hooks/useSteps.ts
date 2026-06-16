import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stepService } from '@/services/step.service';
import { qk } from '@/lib/constants';
import { useAuth } from './useAuth';
import { useActiveEvent } from './useActiveEvent';

export function useMySteps() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  return useQuery({
    queryKey: event ? qk.mySteps(event.id) : ['steps', 'none'],
    enabled: !!event && !!session,
    queryFn: () => stepService.myStepsForEvent(event!.id, session!.user.id),
  });
}

export function useSubmitSteps() {
  const qc = useQueryClient();
  const { data: event } = useActiveEvent();

  return useMutation({
    mutationFn: ({ stepDate, steps }: { stepDate: string; steps: number }) =>
      stepService.submit(stepDate, steps),
    onSuccess: () => {
      if (!event) return;
      // Refresh everything the submission touches.
      qc.invalidateQueries({ queryKey: qk.mySteps(event.id) });
      qc.invalidateQueries({ queryKey: qk.teamLeaderboard(event.id) });
      qc.invalidateQueries({ queryKey: qk.individualLeaderboard(event.id) });
      qc.invalidateQueries({ queryKey: qk.activity(event.id) });
      qc.invalidateQueries({ queryKey: qk.myBadges(event.id) });
    },
  });
}
