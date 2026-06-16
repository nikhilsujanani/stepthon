import { cn } from '@/lib/utils';
import type { EarnedBadge } from '@/services/badge.service';

export function BadgeCard({ badge }: { badge: EarnedBadge }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border p-3 text-center transition',
        badge.earned ? 'bg-card' : 'opacity-40 grayscale',
      )}
      title={badge.description}
    >
      <span className="text-3xl">{badge.icon}</span>
      <p className="mt-1 text-xs font-semibold leading-tight">{badge.name}</p>
      {!badge.earned && <p className="text-[10px] text-muted-foreground">Locked</p>}
    </div>
  );
}
