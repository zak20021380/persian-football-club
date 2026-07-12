import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WalletShortcut } from './WalletShortcut';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  back?: boolean;
  backTo?: string;
  admin?: boolean;
};

export function PageHeader({ title, subtitle, back = false, backTo, admin = false }: PageHeaderProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  };

  return <header className="safe-top sticky top-0 z-30 border-b border-white/[.06] bg-ink-950/85 px-4 pb-3 backdrop-blur-xl"><div className="mx-auto flex max-w-xl items-center gap-3"><button type="button" onClick={goBack} className={back ? 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[.06]' : 'hidden'} aria-label="بازگشت"><ArrowRight size={21}/></button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-extrabold">{title}</h1>{admin && <ShieldCheck size={17} className="shrink-0 text-pitch-400"/>}</div>{subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}</div><WalletShortcut/></div></header>;
}
