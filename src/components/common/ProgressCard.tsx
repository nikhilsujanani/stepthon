import { Card } from '@/components/ui/card';
import { fmtSteps, pct } from '@/lib/format';

interface ProgressCardProps {
  title: string;
  current: number;
  goal: number;
  subtitle?: string;
}

export function ProgressCard({ title, current, goal, subtitle }: ProgressCardProps) {
  const percent = pct(current, goal);
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm font-bold text-primary">{percent}%</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {fmtSteps(current)} / {fmtSteps(goal)} steps{subtitle ? ` · ${subtitle}` : ''}
      </p>
    </Card>
  );
}
