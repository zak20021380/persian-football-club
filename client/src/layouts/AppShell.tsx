import { Home, ShieldCheck, ShoppingBag, Swords, UserRound } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: 'خانه', icon: Home, paths: ['/'] },
  { to: '/competition', label: 'مسابقات', icon: Swords, paths: ['/competition', '/matches', '/competitions', '/quiz', '/rankings', '/rewards'] },
  { to: '/club', label: 'باشگاه', icon: ShieldCheck, paths: ['/club'], center: true },
  { to: '/store', label: 'فروشگاه', icon: ShoppingBag, paths: ['/store'] },
  { to: '/profile', label: 'پروفایل', icon: UserRound, paths: ['/profile'] },
];

function pathActive(pathname: string, paths: string[]): boolean {
  return paths.some(path => path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`));
}

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="app-canvas min-h-screen pb-28">
      <div className="mx-auto w-full max-w-xl"><Outlet/></div>
      <nav aria-label="پیمایش اصلی" className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-1">
        <div className="app-bottom-nav pointer-events-auto mx-auto grid max-w-xl grid-cols-5 gap-1 p-1.5">
          {items.map(({ to, label, icon: Icon, paths, center }) => {
            const active = pathActive(pathname, paths);
            return <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] text-[9px] font-bold text-slate-500 transition active:scale-95',
                active && 'bg-emerald-400/[.11] text-emerald-300',
                center && '-mt-3 min-h-[66px] border border-emerald-300/[.14] bg-ink-850 text-slate-300 shadow-[0_-8px_24px_rgba(0,0,0,.22)]',
                center && active && 'border-emerald-300/30 bg-gradient-to-b from-emerald-400/[.18] to-ink-850 text-emerald-200',
              )}
            >
              <span className={cn('grid place-items-center', center && 'h-8 w-8 rounded-xl bg-emerald-400/[.12] text-emerald-300')}><Icon size={center ? 20 : 18} strokeWidth={active ? 2.6 : 1.8}/></span>
              <span className="max-w-full truncate px-1">{label}</span>
              {active && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-emerald-300"/>}
            </Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
