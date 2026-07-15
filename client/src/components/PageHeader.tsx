import { ArrowRight, Radio, ShieldCheck, ShoppingBag, Sparkles, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { WalletShortcut } from './WalletShortcut';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  back?: boolean;
  backTo?: string;
  admin?: boolean;
  tone?: 'mint' | 'cyan' | 'violet' | 'amber' | 'fuchsia';
  eyebrow?: string;
};

const toneIcons = { mint: ShieldCheck, cyan: Radio, violet: Sparkles, amber: ShoppingBag, fuchsia: Trophy } as const;

export function PageHeader({ title, subtitle, back = false, backTo, admin = false, tone = 'mint', eyebrow }: PageHeaderProps) {
  const navigate = useNavigate();
  const HeroIcon = admin ? ShieldCheck : toneIcons[tone];
  const goBack = () => {
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  };

  return <header className={cn('page-hero safe-top relative z-20 overflow-hidden px-4 pb-7 pt-3', `page-hero-${tone}`, admin && 'page-hero-admin')}>
    <div className="page-hero-grid absolute inset-0"/>
    <div className="page-hero-angle absolute inset-0"/>
    <div className="page-hero-orb absolute"/>
    <div className="relative mx-auto max-w-xl">
      <div className="flex items-center gap-2.5">
        {back && <button type="button" onClick={goBack} className="broadcast-icon-button" aria-label="بازگشت"><ArrowRight size={19}/></button>}
        <div className="min-w-0 flex-1">
          <p className="page-hero-eyebrow truncate" dir="ltr">{eyebrow || (admin ? 'CONTROL ROOM' : 'FOOTBALL CLUB / MATCHDAY')}</p>
        </div>
        <WalletShortcut className="broadcast-icon-button"/>
      </div>
      <div className="mt-6 flex items-end gap-3">
        <span className="page-hero-mark grid h-11 w-11 shrink-0 place-items-center"><HeroIcon size={20} strokeWidth={2.4}/></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.35rem] font-black tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1 truncate text-[10px] font-semibold text-slate-300">{subtitle}</p>}
        </div>
        <span className="page-hero-index" dir="ltr">{admin ? 'ADM' : tone.slice(0, 2).toUpperCase()}</span>
      </div>
    </div>
  </header>;
}
