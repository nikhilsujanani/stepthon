import { Crown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fmtSteps } from '@/lib/format';
import type { TeamMemberCardData } from '@/types';

export function TeamMemberCard({ member }: { member: TeamMemberCardData }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted font-bold">
          {member.full_name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate font-semibold">{member.full_name}</p>
          {member.role === 'captain' && <Crown className="h-3.5 w-3.5 text-accent" />}
        </div>
        <p className="text-xs text-muted-foreground">{fmtSteps(member.total_steps)} steps</p>
      </div>
      <div className="flex -space-x-1">
        {member.badges.slice(0, 4).map((b) => (
          <span key={b.code} title={b.name} className="text-base">{b.icon}</span>
        ))}
      </div>
    </Card>
  );
}
