import { ArrowLeft, ArrowRight, Coins, Handshake, History, Palette, Repeat2, Shield, ShieldCheck, Shirt, Sparkles, UsersRound } from 'lucide-react';
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
    <PageHeader title="باشگاه من" subtitle="تیم را بساز، ترکیب بچین و وارد بازار شو" tone="mint" eyebrow="MY CLUB / TEAM HQ"/>
    <main className="space-y-4 p-4">
      <div className="mb-1 flex items-end justify-between"><div><span className="text-[7px] font-black tracking-[.18em] text-cyan-300" dir="ltr">CLUB OPERATIONS</span><h1 className="mt-1 text-base font-black">مرکز فرماندهی تیم</h1></div><ShieldCheck size={20} className="text-emerald-300"/></div>
      <div className="space-y-2.5">{clubEntries.map(({ slug, title, description, icon: Icon }, index) => <Link key={slug} to={`/club/${slug}`} className="feature-link flex min-h-[76px] items-center gap-3 rounded-[1.35rem] px-3.5 transition active:scale-[.99]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.05] text-cyan-200"><Icon size={19}/></span><div className="min-w-0 flex-1"><span className="text-[6px] font-black tracking-[.16em] text-white/25" dir="ltr">0{index + 1}</span><h2 className="truncate text-xs font-black">{title}</h2><p className="mt-1 truncate text-[9px] text-slate-500">{description}</p></div><ArrowLeft size={17} className="shrink-0 text-cyan-300/60"/></Link>)}</div>
      <Link to="/store" className="flex min-h-[72px] items-center gap-3 rounded-[1.4rem] border border-amber-300/[.16] bg-gradient-to-l from-amber-300/[.08] to-transparent px-3.5 transition active:scale-[.99]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><Coins size={21}/></span><div className="min-w-0 flex-1"><h2 className="text-xs font-black text-amber-100">فروشگاه سکه</h2><p className="mt-1 truncate text-[9px] text-slate-500">خرید سکه و دریافت هدیه روزانه</p></div><ArrowLeft size={18} className="shrink-0 text-amber-300"/>
      </Link>
    </main>
  </>;
}

export function ClubFeaturePage({ slug }: { slug: string }) {
  const feature = featureBySlug[slug] ?? clubEntries[0];
  const Icon = feature.icon;
  return <>
    <PageHeader title={feature.title} subtitle="باشگاه من" back tone="mint" eyebrow="MY CLUB / FEATURE"/>
    <main className="p-4">
      {slug === 'customization' ? <ClubCustomizationPreview/> : <Card className="empty-state flex min-h-56 flex-col items-center justify-center text-center"><span className="grid h-14 w-14 place-items-center rounded-xl bg-cyan-300 text-[#10051d]"><Icon size={25}/></span><span className="mt-4 text-[7px] font-black tracking-[.18em] text-fuchsia-300" dir="ltr">COMING NEXT MATCHDAY</span><h1 className="mt-1 text-base font-black">{feature.title}</h1><p className="mt-2 max-w-xs text-[11px] leading-6 text-slate-400">این بخش در ساختار باشگاه آماده شده و اطلاعات آن با فعال‌شدن قابلیت مربوط نمایش داده می‌شود.</p><Link to="/club" className="btn-secondary mt-5 min-w-32">بازگشت به باشگاه</Link></Card>}
    </main>
  </>;
}

const customizationOptions = [
  { label: 'لوگوی باشگاه', icon: Shield },
  { label: 'رنگ تیم', icon: Palette },
  { label: 'لباس تیم', icon: Shirt },
];

function ClubCustomizationPreview() {
  return <section className="club-customization-card" aria-labelledby="club-customization-title">
    <div className="club-customization-heading">
      <span className="club-customization-status"><Sparkles size={11}/>به‌زودی</span>
      <span className="club-customization-eyebrow" dir="ltr">IDENTITY LAB / PREVIEW</span>
    </div>

    <div className="club-identity-preview" aria-hidden="true">
      <div className="club-identity-logo">
        <span className="club-identity-logo-mark"><Shield size={34} strokeWidth={1.6}/><b>FC</b></span>
        <small>LOGO</small>
      </div>
      <div className="club-identity-colors">
        <small>TEAM COLORS</small>
        <span className="club-identity-color club-identity-color-cyan"/>
        <span className="club-identity-color club-identity-color-violet"/>
        <span className="club-identity-color club-identity-color-magenta"/>
      </div>
      <div className="club-identity-jersey">
        <span className="club-identity-jersey-mark"><Shirt size={37} strokeWidth={1.55}/></span>
        <small>KIT 01</small>
      </div>
    </div>

    <div className="club-customization-copy">
      <h1 id="club-customization-title">هویت باشگاهت را بساز</h1>
      <p>لوگو، رنگ‌ها و لباس تیم را با هویت دلخواهت هماهنگ کن.</p>
    </div>

    <div className="club-customization-options" aria-label="گزینه‌های شخصی‌سازی در راه">
      {customizationOptions.map(({ label, icon: OptionIcon }) => <button key={label} type="button" disabled className="club-customization-option">
        <span><OptionIcon size={17} strokeWidth={1.8}/></span>
        {label}
      </button>)}
    </div>

    <Link to="/club" className="club-customization-back"><ArrowRight size={14}/>بازگشت به باشگاه</Link>
  </section>;
}
