import { ArrowLeft, Coins, Handshake, History, Palette, Repeat2, ShieldCheck, Shirt, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui';

const clubEntries = [
  { slug: 'squad', title: 'ترکیب من', description: 'چیدمان و ترکیب اصلی باشگاه', icon: Shirt },
  { slug: 'players', title: 'بازیکنان من', description: 'فهرست بازیکنان باشگاه', icon: UsersRound },
  { slug: 'transfer-market', title: 'بازار نقل‌وانتقالات', description: 'فرصت‌های بازار بازیکنان', icon: Repeat2 },
  { slug: 'trade-offers', title: 'پیشنهادهای خریدوفروش', description: 'مدیریت پیشنهادهای دریافتی', icon: Handshake },
  { slug: 'transactions', title: 'تاریخچه معاملات', description: 'سوابق خریدوفروش باشگاه', icon: History },
  { slug: 'customization', title: 'شخصی‌سازی باشگاه', description: 'ظاهر و هویت باشگاه من', icon: Palette },
];

const featureBySlug = Object.fromEntries(clubEntries.map(entry => [entry.slug, entry]));

export function ClubPage() {
  return <>
    <PageHeader title="باشگاه من" subtitle="مدیریت تیم و دارایی‌های باشگاه"/>
    <main className="space-y-4 p-4">
      <Card className="relative overflow-hidden border-pitch-400/15 bg-gradient-to-l from-pitch-400/[.1] to-transparent p-5">
        <ShieldCheck size={98} strokeWidth={1.1} className="absolute -left-5 -top-6 rotate-6 text-pitch-300/[.09]"/>
        <div className="relative"><p className="text-[9px] font-black text-pitch-300">مرکز مدیریت تیم</p><h1 className="mt-1 text-lg font-black">باشگاهت را بساز و مدیریت کن</h1><p className="mt-2 max-w-[82%] text-[10px] leading-5 text-slate-400">همه ابزارهای تیم، نقل‌وانتقالات و شخصی‌سازی در یک بخش جمع شده‌اند.</p></div>
      </Card>
      <div className="space-y-2.5">{clubEntries.map(({ slug, title, description, icon: Icon }) => <Link key={slug} to={`/club/${slug}`} className="flex min-h-[68px] items-center gap-3 rounded-[1.35rem] border border-white/[.075] bg-ink-900/90 px-3.5 transition active:scale-[.99] active:bg-white/[.05]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.045] text-slate-300"><Icon size={18}/></span><div className="min-w-0 flex-1"><h2 className="truncate text-xs font-black">{title}</h2><p className="mt-1 truncate text-[9px] text-slate-500">{description}</p></div><ArrowLeft size={17} className="shrink-0 text-slate-600"/></Link>)}</div>
      <Link to="/store" className="flex min-h-[72px] items-center gap-3 rounded-[1.4rem] border border-amber-300/[.16] bg-gradient-to-l from-amber-300/[.08] to-transparent px-3.5 transition active:scale-[.99]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><Coins size={21}/></span><div className="min-w-0 flex-1"><h2 className="text-xs font-black text-amber-100">فروشگاه سکه</h2><p className="mt-1 truncate text-[9px] text-slate-500">خرید سکه و دریافت هدیه روزانه</p></div><ArrowLeft size={18} className="shrink-0 text-amber-300"/>
      </Link>
    </main>
  </>;
}

export function ClubFeaturePage({ slug }: { slug: string }) {
  const feature = featureBySlug[slug] ?? clubEntries[0];
  const Icon = feature.icon;
  return <><PageHeader title={feature.title} subtitle="باشگاه من" back/><main className="p-4"><Card className="flex min-h-52 flex-col items-center justify-center text-center"><span className="grid h-14 w-14 place-items-center rounded-[1.25rem] bg-pitch-400/10 text-pitch-300"><Icon size={25}/></span><h1 className="mt-4 text-base font-black">{feature.title}</h1><p className="mt-2 max-w-xs text-[11px] leading-6 text-slate-400">این بخش در ساختار باشگاه آماده شده و اطلاعات آن با فعال‌شدن قابلیت مربوط نمایش داده می‌شود.</p><Link to="/club" className="btn-secondary mt-5 min-w-32">بازگشت به باشگاه</Link></Card></main></>;
}
