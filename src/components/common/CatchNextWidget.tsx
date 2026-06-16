import { Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fmtSteps } from '@/lib/format';
import type { CatchNextTeam } from '@/types';

export function CatchNextWidget({ data }: { data: CatchNextTeam | null }) {
  if (!data) {
    return (
      <Card className="border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold">🏆 You're in the lead!</p>
        <p className="text-xs text-muted-foreground">Keep walking to defend your spot.</p>
      </Card>
    );
  }
  return (
    <Card className="flex items-center gap-3 border-accent/40 bg-gradient-to-r from-accent/10 to-transparent p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20">
        <Zap className="h-5 w-5 text-accent" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-snug">
          Only <span className="text-accent">{fmtSteps(data.gap)}</span> steps to overtake{' '}
          {data.next_team_name}!
        </p>
        <p className="text-xs text-muted-foreground">Your team is counting on you.</p>
      </div>
    </Card>
  );
}
