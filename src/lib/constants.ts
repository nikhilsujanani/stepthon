export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Stepathon';
export const TAGLINE = 'Walk Together. Win Together.';
export const MAX_STEPS_PER_DAY = Number(import.meta.env.VITE_MAX_STEPS_PER_DAY || 100000);

/** TanStack Query keys — centralized so invalidation stays consistent. */
export const qk = {
  me: ['me'] as const,
  activeEvent: ['event', 'active'] as const,
  myMembership: (eventId: string) => ['membership', eventId] as const,
  eventAccess: (eventId: string) => ['event-access', eventId] as const,
  teamLeaderboard: (eventId: string) => ['leaderboard', 'team', eventId] as const,
  individualLeaderboard: (eventId: string) => ['leaderboard', 'individual', eventId] as const,
  team: (teamId: string) => ['team', teamId] as const,
  teamMembers: (teamId: string) => ['team', teamId, 'members'] as const,
  mySteps: (eventId: string) => ['steps', 'me', eventId] as const,
  myBadges: (eventId: string) => ['badges', 'me', eventId] as const,
  activity: (eventId: string) => ['activity', eventId] as const,
  notifications: ['notifications'] as const,
  catchNext: (teamId: string) => ['catch-next', teamId] as const,
  adminStats: (eventId: string) => ['admin', 'stats', eventId] as const,
  events: ['events'] as const,
};
