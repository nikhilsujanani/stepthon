import { NavLink } from 'react-router-dom';
import { Home, Trophy, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/profile', label: 'Profile', icon: User },
];

export function BottomNavigation() {
  return (
    <nav className="sticky bottom-0 z-40 border-t bg-card/95 backdrop-blur pb-safe">
      <ul className="mx-auto grid max-w-[480px] grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'fill-primary/15')} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
