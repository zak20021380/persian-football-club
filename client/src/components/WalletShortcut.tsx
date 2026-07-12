import { Coins } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function WalletShortcut({ className = '' }: { className?: string }) {
  const active = useLocation().pathname === '/store';
  return <Link
    to="/store"
    aria-label="فروشگاه سکه"
    title="فروشگاه سکه"
    className={cn(
      'relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[.07] text-amber-300 transition active:scale-90',
      active && 'border-amber-300/30 bg-amber-300/[.14] shadow-[0_8px_24px_rgba(245,158,11,.1)]',
      className,
    )}
  >
    <Coins size={19}/>
    <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-300"/>
  </Link>;
}
