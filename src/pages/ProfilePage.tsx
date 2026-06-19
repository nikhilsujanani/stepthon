import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Flame, Footprints, LogOut, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { BadgeCard } from '@/components/common/BadgeCard';
import { badgeService } from '@/services/badge.service';
import { stepService } from '@/services/step.service';
import { notificationService } from '@/services/notification.service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { qk } from '@/lib/constants';
import { fmtSteps } from '@/lib/format';

export function ProfilePage() {
  const { session, profile, isAdmin, signOut } = useAuth();
  const { data: event } = useActiveEvent();
  const userId = session!.user.id;
  const qc = useQueryClient();

  const { data: badges = [] } = useQuery({
    queryKey: event ? qk.myBadges(event.id) : ['badges', 'none'],
    enabled: !!event,
    queryFn: () => badgeService.collection(event!.id, userId),
  });

  const { data: steps = [] } = useQuery({
    queryKey: event ? qk.mySteps(event.id) : ['steps', 'none'],
    enabled: !!event,
    queryFn: () => stepService.myStepsForEvent(event!.id, userId),
  });

  const { data: streak = 0 } = useQuery({
    queryKey: event ? ['streak', event.id, userId] : ['streak', 'none'],
    enabled: !!event,
    queryFn: async () => {
      const { data } = await supabase.rpc('current_streak', { p_user_id: userId, p_event_id: event!.id });
      return data ?? 0;
    },
  });

  const total = steps.reduce((s, d) => s + d.steps, 0);

  const { data: notifications = [] } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => notificationService.list(userId),
  });

  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="space-y-4 py-2">
      <header className="flex items-center gap-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-2xl font-bold">
            {profile?.full_name?.charAt(0) ?? '?'}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{profile?.full_name}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Current Streak" value={`${streak} 🔥`} icon={Flame} />
        <StatCard label="Total Steps" value={fmtSteps(total)} icon={Footprints} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Notifications</h2>
          <div className="divide-y">
            {notifications.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No notifications yet.</p>
            )}
            {notifications.slice(0, 10).map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? 'text-muted-foreground' : 'font-semibold'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  {(n.metadata as { kind?: string })?.kind === 'team_access_request' && (
                    <Link to="/team" className="mt-1 inline-block text-xs text-primary">
                      Review on Team page
                    </Link>
                  )}
                </div>
                {!n.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-xs"
                    onClick={async () => {
                      await notificationService.markRead(n.id);
                      qc.invalidateQueries({ queryKey: qk.notifications });
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          </div>
          {unread.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{unread.length} unread</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Badge Collection</h2>
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b) => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 font-semibold">Activity History</h2>
          <div className="divide-y">
            {steps.slice(0, 10).map((d) => (
              <div key={d.id} className="flex justify-between py-2 text-sm">
                <span className="text-muted-foreground">{d.step_date}</span>
                <span className="font-semibold tabular-nums">{fmtSteps(d.steps)}</span>
              </div>
            ))}
            {steps.length === 0 && <p className="py-2 text-sm text-muted-foreground">No steps logged yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => notificationService.enablePush(userId)}
      >
        <Bell className="h-4 w-4" /> Enable notifications
      </Button>

      {isAdmin && (
        <Button variant="outline" className="w-full" asChild>
          <Link to="/admin">
            <ShieldCheck className="h-4 w-4" /> Admin Panel
          </Link>
        </Button>
      )}

      <Button variant="ghost" className="w-full text-destructive" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
