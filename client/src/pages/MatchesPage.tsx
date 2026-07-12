import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, LayoutGrid, Radio, Sparkles, Trophy } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { MatchCard } from '@/components/MatchCard';
import { WalletShortcut } from '@/components/WalletShortcut';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';
import type { Match } from '@/types/api';

type MatchFilter = '' | 'live' | 'scheduled' | 'finished';
const tabs: Array<{ value: MatchFilter; label: string; hint: string; icon: typeof Radio }> = [
  { value: '', label: 'همه', hint: 'کل بازی‌ها', icon: LayoutGrid },
  { value: 'live', label: 'زنده', hint: 'در جریان', icon: Radio },
  { value: 'scheduled', label: 'آینده', hint: 'پیش‌رو', icon: CalendarClock },
  { value: 'finished', label: 'نتایج', hint: 'تمام‌شده', icon: Trophy }
];

export function MatchesPage() {
  const [status, setStatus] = useState<MatchFilter>('');
  const query = useQuery({ queryKey: ['matches', status], queryFn: async () => (await api.get<Match[]>('/matches', { params: { status: status || undefined } })).data, refetchInterval: status === 'live' ? 30_000 : false });
  const activeTab = tabs.find((tab) => tab.value === status)!;

  return (
    <main className="matches-page pb-5">
      <header className="matches-hero safe-top relative overflow-hidden px-4 pb-10 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-40"/>
        <div className="matches-orb absolute -left-16 -top-20 h-60 w-60 rounded-full bg-sky-400/[.09] blur-3xl"/>
        <div className="absolute -right-24 top-20 h-56 w-56 rounded-full border border-emerald-300/[.07]"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3"><BrandMark className="h-11 w-11"/><div><p className="text-[9px] font-bold text-emerald-300">مرکز مسابقات</p><h1 className="mt-0.5 text-lg font-black">بازی‌های مهم</h1></div></div>
          <div className="flex items-center gap-2"><WalletShortcut/><span className="hidden h-11 w-11 place-items-center rounded-2xl border border-sky-300/15 bg-sky-300/[.07] text-sky-300 min-[380px]:grid"><CalendarClock size={21}/></span></div>
        </div>
        <div className="relative mt-6">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-300"><Sparkles size={12}/> هر بازی، یک پیش‌بینی تازه</div>
          <h2 className="mt-1 text-2xl font-black leading-10">بازی رو ببین، نتیجه رو<br/><span className="text-emerald-300">قبل از سوت شروع حدس بزن.</span></h2>
        </div>
      </header>

      <div className="relative -mt-6 px-4">
        <div className="grid grid-cols-4 gap-1.5 rounded-[1.6rem] border border-white/[.08] bg-ink-900/95 p-2 shadow-2xl shadow-black/25 backdrop-blur-xl">
          {tabs.map(({ value, label, icon: Icon }) => {
            const active = status === value;
            return <button type="button" key={value} aria-pressed={active} onClick={() => setStatus(value)} className={cn('relative flex min-h-[66px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl text-[9px] font-bold transition active:scale-95', active ? value === 'live' ? 'bg-rose-400/[.11] text-rose-300' : 'bg-emerald-400/[.11] text-emerald-300' : 'text-slate-500')}><Icon size={18} strokeWidth={active ? 2.6 : 1.8}/><span className="truncate">{label}</span>{active && <span className={cn('absolute bottom-1 h-0.5 w-4 rounded-full', value === 'live' ? 'bg-rose-300' : 'bg-emerald-300')}/>}</button>;
          })}
        </div>
      </div>

      <div className="px-4 pt-6">
        <div className="mb-3 flex items-end justify-between">
          <div><p className="text-[9px] font-bold text-emerald-300">{activeTab.hint}</p><h2 className="mt-0.5 text-base font-black">برنامه مسابقات</h2></div>
          {!query.isLoading && query.data && <span className="rounded-full border border-white/[.07] bg-white/[.035] px-3 py-1.5 text-[9px] font-bold text-slate-400">{faNumber(query.data.length)} بازی</span>}
        </div>
        {query.isLoading ? <PageSkeleton/> : query.error ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/> : query.data?.length ? <div className="space-y-3">{query.data.map((match) => <MatchCard key={match._id} match={match}/>)}</div> : <EmptyState title="بازی‌ای در این بخش نیست" description="به‌محض انتشار برنامه جدید، بازی‌ها همین‌جا نمایش داده می‌شوند."/>}
      </div>
    </main>
  );
}
