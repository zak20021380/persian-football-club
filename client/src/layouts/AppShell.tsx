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
      <nav aria-label="پیمایش اصلی" className="app-bottom-nav-shell safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-1">
        <div className="app-bottom-nav pointer-events-auto mx-auto grid max-w-xl grid-cols-5">
          {items.map(({ to, label, icon: Icon, paths, center }) => {
            const active = pathActive(pathname, paths);
            return <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'app-bottom-nav__item',
                active && 'is-active',
                center && 'app-bottom-nav__item--primary',
              )}
            >
              <span className="app-bottom-nav__icon" aria-hidden="true"><Icon size={center ? 21 : 18} strokeWidth={active ? 2.35 : 1.75}/></span>
              <span className="app-bottom-nav__label">{label}</span>
              <span className="app-bottom-nav__indicator" aria-hidden="true"/>
            </Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
