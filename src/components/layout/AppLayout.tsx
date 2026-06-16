import { Outlet } from 'react-router-dom';
import { BottomNavigation } from './BottomNavigation';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useRealtimeEvent, useRealtimeNotifications } from '@/hooks/useRealtime';

/** Phone-width shell with persistent bottom nav + live subscriptions. */
export function AppLayout() {
  const { session } = useAuth();
  const { data: event } = useActiveEvent();
  useRealtimeEvent(event?.id);
  useRealtimeNotifications(session?.user.id);

  return (
    <div className="app-shell flex flex-col bg-background">
      <main className="flex-1 px-4 pb-4 pt-safe">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
}
