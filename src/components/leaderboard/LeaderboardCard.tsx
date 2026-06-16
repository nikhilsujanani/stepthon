import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmtSteps, movement, movementIcon } from '@/lib/format';

interface LeaderboardCardProps {
  rank: number;
  previousRank: number | null;
  name: string;
  totalSteps: number;
  subtitle?: string;        // e.g. team name for individuals, member count for teams
  avatarUrl?: string | null;
  highlight?: boolean;      // the viewer's own row / team
}

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

export function LeaderboardCard({
  rank, previousRank, name, totalSteps, subtitle, avatarUrl, highlight,
}: LeaderboardCardProps) {
  const move = movement(rank, previousRank);
  return (
    <Card
      className={cn(
        'flex items-center gap-3 p-3',
        highlight && 'ring-2 ring-primary',
        rank <= 3 && 'bg-gradient-to-r from-card to-primary/5',
      )}
    >
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span className="text-lg font-bold">{medal(rank) ?? rank}</span>
      </div>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-bold">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="text-right">
        <p className="font-bold tabular-nums">{fmtSteps(totalSteps)}</p>
        <p
          className={cn(
            'text-xs',
            move === 'up' && 'text-primary',
            move === 'down' && 'text-destructive',
            move === 'same' && 'text-muted-foreground',
            move === 'new' && 'text-accent',
          )}
        >
          {movementIcon[move]}
        </p>
      </div>
    </Card>
  );
}
