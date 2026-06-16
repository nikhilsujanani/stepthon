// Supabase Edge Function: daily-reminder
// Scheduled (cron) function. For the active event, notifies every member who
// has NOT submitted steps today. Schedule via Supabase Dashboard → Edge
// Functions → Cron, e.g.  0 18 * * *  (18:00 daily).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: event } = await supabase
    .from('events').select('id').eq('status', 'active').maybeSingle();
  if (!event) return new Response(JSON.stringify({ skipped: 'no active event' }));

  const { data: members } = await supabase
    .from('team_members').select('user_id').eq('event_id', event.id);

  const { data: submitted } = await supabase
    .from('daily_steps').select('user_id').eq('event_id', event.id).eq('step_date', today);

  const submittedSet = new Set((submitted ?? []).map((r) => r.user_id));
  const pending = (members ?? []).map((m) => m.user_id).filter((id) => !submittedSet.has(id));

  // Write in-app notifications + fan out web push.
  if (pending.length) {
    await supabase.from('notifications').insert(
      pending.map((user_id) => ({
        user_id,
        type: 'daily_reminder',
        title: 'Time to log your steps',
        body: "Don't forget to submit today's steps.",
      })),
    );
    await Promise.allSettled(
      pending.map((user_id) =>
        supabase.functions.invoke('send-push', {
          body: { user_id, title: 'Stepathon', body: "Don't forget to submit today's steps.", url: '/update' },
        }),
      ),
    );
  }

  return new Response(JSON.stringify({ reminded: pending.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
