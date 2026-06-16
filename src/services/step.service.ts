import { supabase } from '@/lib/supabase';
import type { DailyStep } from '@/types';

/** Maps Postgres RAISE codes from submit_steps() to friendly messages. */
function humanize(message: string): string {
  if (message.includes('NO_ACTIVE_EVENT')) return 'There is no active event right now.';
  if (message.includes('NOT_ON_TEAM')) return 'Join a team before submitting steps.';
  if (message.includes('FUTURE_DATE')) return "You can't submit steps for a future date.";
  if (message.includes('OUT_OF_WINDOW')) return 'That date is outside the event window.';
  if (message.includes('STEPS_OUT_OF_RANGE')) return 'Step count is out of the allowed range.';
  return 'Could not save steps. Please try again.';
}

export const stepService = {
  /** Submit/overwrite today's (or a past in-window day's) steps via RPC. */
  async submit(stepDate: string, steps: number): Promise<DailyStep> {
    const { data, error } = await supabase.rpc('submit_steps', {
      p_step_date: stepDate,
      p_steps: steps,
    });
    if (error) throw new Error(humanize(error.message));
    return data as unknown as DailyStep;
  },

  async myStepsForEvent(eventId: string, userId: string): Promise<DailyStep[]> {
    const { data, error } = await supabase
      .from('daily_steps').select('*')
      .eq('event_id', eventId).eq('user_id', userId)
      .order('step_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async todaysSteps(eventId: string, userId: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('daily_steps').select('steps')
      .eq('event_id', eventId).eq('user_id', userId).eq('step_date', today).maybeSingle();
    return data?.steps ?? 0;
  },
};
