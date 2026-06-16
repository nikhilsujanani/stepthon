import { QueryClient } from '@tanstack/react-query';

/**
 * Caching strategy:
 * - staleTime 30s: leaderboards/feeds are realtime-pushed, so polling is off;
 *   the short stale window dedupes burst refetches without showing old data long.
 * - gcTime 5m: keep data warm when navigating between bottom-nav tabs.
 * - Realtime subscriptions call queryClient.invalidateQueries on DB changes,
 *   so most freshness comes from push, not time-based refetch.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});
