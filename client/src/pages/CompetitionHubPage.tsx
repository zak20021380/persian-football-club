import { ArrowLeft, CircleHelp, Gift, Medal, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui';

const competitionEntries = [
  { to: '/matches', title: 'پیش‌بینی مسابقات', description: 'نتیجه بازی‌های مهم را پیش‌بینی کن', icon: Target, tone: 'bg-emerald-400/10 text-emerald-300' },
  { to: '/quiz', title: 'کوییز روزانه', description: 'دانش فوتبالی‌ات را محک بزن', icon: CircleHelp, tone: 'bg-violet-400/10 text-violet-300' },
  { to: '/rankings', title: 'رتبه‌بندی', description: 'جایگاهت را بین قهرمان‌ها ببین', icon: Medal, tone: 'bg-amber-300/10 text-amber-300' },
  { to: '/rewards', title: 'جوایز', description: 'شرایط جایزه‌ها و کمپین‌ها', icon: Gift, tone: 'bg-sky-400/10 text-sky-300' },
];

export function CompetitionHubPage() {
  return <>
    <PageHeader title="رقابت" subtitle="همه چالش‌ها در یک زمین"/>
    <main className="space-y-5 p-4">
      <Card className="relative overflow-hidden border-pitch-400/15 bg-gradient-to-l from-pitch-400/[.09] to-transparent p-5">
        <Trophy size={92} strokeWidth={1.2} className="absolute -left-4 -top-5 rotate-12 text-pitch-300/[.09]"/>
        <div className="relative"><p className="text-[9px] font-black text-pitch-300">مرکز رقابت باشگاه</p><h1 className="mt-1 text-lg font-black">بازی کن، امتیاز بگیر، صعود کن</h1><p className="mt-2 max-w-[82%] text-[10px] leading-5 text-slate-400">پیش‌بینی، کوییز، جدول رتبه‌بندی و جایزه‌ها از اینجا در دسترس‌اند.</p></div>
      </Card>
      <section>
        <h2 className="mb-3 text-sm font-black">رقابت</h2>
        <div className="grid grid-cols-2 gap-2.5">{competitionEntries.map(({ to, title, description, icon: Icon, tone }) => <Link key={to} to={to} className="min-w-0"><Card className="h-full min-h-[132px] p-3.5 transition active:scale-[.98]"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}><Icon size={19}/></span><h3 className="mt-3 truncate text-xs font-black">{title}</h3><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{description}</p></Card></Link>)}</div>
      </section>
      <Link to="/competitions" className="flex min-h-16 items-center gap-3 rounded-[1.4rem] border border-white/[.08] bg-ink-900/90 p-3.5 transition active:scale-[.99]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-pitch-400/10 text-pitch-300"><Trophy size={19}/></span>
        <div className="min-w-0 flex-1"><h3 className="text-xs font-black">جام‌ها و مسابقات ویژه</h3><p className="mt-1 truncate text-[9px] text-slate-500">رقابت‌های زمان‌دار باشگاه</p></div><ArrowLeft size={18} className="shrink-0 text-slate-500"/>
      </Link>
    </main>
  </>;
}
