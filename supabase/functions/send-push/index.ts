// Supabase Edge Function: send-push
// Sends a Web Push notification to every registered device for a user.
// Invoke from DB webhooks / other functions, or directly with a JSON body:
//   { "user_id": "...", "title": "...", "body": "...", "url": "/leaderboard" }
//
// Secrets required (set with `supabase secrets set`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, url } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), { status: 400 });
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id);
    if (error) throw error;

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' });
    const results = await Promise.allSettled(
      (subs ?? []).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ).catch(async (err: { statusCode?: number }) => {
          // Prune dead subscriptions (410 Gone / 404).
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
          }
          throw err;
        }),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return new Response(JSON.stringify({ sent, total: subs?.length ?? 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
