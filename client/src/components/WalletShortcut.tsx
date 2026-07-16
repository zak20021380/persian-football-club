import { Gem } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function WalletShortcut({ className = '' }: { className?: string }) {
  const active = useLocation().pathname === '/store';
  return <Link
    to="/store"
    aria-label="فروشگاه سکه"
    title="فروشگاه سکه"
    className={cn(
      'wallet-shortcut-premium relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition active:scale-90',
      active && 'wallet-shortcut-active',
      className,
    )}
  >
    <Gem size={18} strokeWidth={2.2}/>
    <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(73,228,242,.4)]"/>
  </Link>;
}
