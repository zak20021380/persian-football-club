import { Home, Laugh, Medal, ShieldCheck, Swords, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: 'خانه', icon: Home, end: true },
  { to: '/matches', label: 'بازی‌ها', icon: Swords },
  { to: '/competitions', label: 'جام‌ها', icon: ShieldCheck },
  { to: '/fun', label: 'فان', icon: Laugh },
  { to: '/rankings', label: 'برترین‌ها', icon: Medal },
  { to: '/profile', label: 'پروفایل', icon: UserRound }
];

export function AppShell() {
  return (
    <div className="pitch-grid min-h-screen pb-28">
      <div className="mx-auto w-full max-w-xl"><Outlet/></div>
      <nav className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-1">
        <div className="pointer-events-auto mx-auto grid max-w-xl grid-cols-6 gap-0.5 rounded-[1.5rem] border border-white/10 bg-ink-900/95 p-1.5 shadow-[0_-8px_35px_rgba(0,0,0,.32)] backdrop-blur-2xl">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] text-[8px] font-bold text-slate-500 transition active:scale-95', isActive && (to === '/fun' ? 'bg-fuchsia-400/[.11] text-fuchsia-300' : 'bg-emerald-400/[.11] text-emerald-300'))}>
              {({ isActive }) => <><Icon size={18} strokeWidth={isActive ? 2.6 : 1.8}/><span className="truncate">{label}</span>{isActive && <span className={cn('absolute bottom-1 h-0.5 w-4 rounded-full', to === '/fun' ? 'bg-fuchsia-300' : 'bg-emerald-300')}/>}</>}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
