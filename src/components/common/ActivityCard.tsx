import { formatDistanceToNow } from 'date-fns';
import { Activity as ActivityIcon, Award, TrendingUp, Flame, Footprints } from 'lucide-react';
import type { Activity } from '@/types';

const icon = {
  steps_submitted: Footprints,
  badge_earned: Award,
  rank_changed: TrendingUp,
  streak: Flame,
  team_joined: ActivityIcon,
  milestone: Award,
} as const;

export function ActivityCard({ item }: { item: Activity }) {
  const Icon = icon[item.type] ?? ActivityIcon;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{item.message}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
