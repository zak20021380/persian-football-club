import { useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BrainCircuit,
  Crown,
  Eye,
  Gem,
  Medal,
  Minus,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  X
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { WalletShortcut } from '@/components/WalletShortcut';
import { ErrorState } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';

type RankingCategory = 'fantasy'|'predictions'|'quiz'|'friends';
type RankingPeriod = 'week'|'month'|'season';
type RankingMode = 'performance'|'clubValue';

interface RankingEntry {
  userId: string;
  clubName: string;
  ownerName: string;
  score: number;
  rank: number;
  rankChange: number;
  isCurrent: boolean;
  formation?: string;
  playerCount: number;
}

interface RankingData {
  type: RankingCategory|'club-value';
  period: RankingPeriod;
  metric: 'points'|'value';
  leaders: RankingEntry[];
  current: RankingEntry;
}

const categories: Array<{ value: RankingCategory; label: string; eyebrow: string; icon: typeof Trophy }> = [
  { value: 'fantasy', label: 'فانتزی', eyebrow: 'ترکیب فعال', icon: ShieldCheck },
  { value: 'predictions', label: 'پیش‌بینی', eyebrow: 'نتیجه‌ها', icon: Target },
  { value: 'quiz', label: 'کوییز', eyebrow: 'دانش فوتبال', icon: BrainCircuit },
  { value: 'friends', label: 'دوستان', eyebrow: 'دعوت موفق', icon: Users }
];

const periods: Array<{ value: RankingPeriod; label: string }> = [
  { value: 'week', label: 'هفته جاری' },
  { value: 'month', label: 'ماه جاری' },
  { value: 'season', label: 'کل فصل' }
];

const badgePalettes = [
  ['#f8cf69', '#b36a19'], ['#ff637d', '#86152c'], ['#efb34e', '#9e3c15'], ['#6fe6d3', '#116771'],
  ['#64d8f4', '#2556a8'], ['#8aa7ff', '#542f9e'], ['#eec66f', '#3a7597'], ['#d68bff', '#603688'],
  ['#75efb4', '#196445'], ['#ffd35d', '#8c6421']
] as const;

const demoTeams: RankingEntry[] = [
  { userId: 'demo-1', clubName: 'پادشاهان اتحاد', ownerName: 'آرش زمانی', score: 864, rank: 1, rankChange: 2, isCurrent: false, formation: '4-3-3', playerCount: 11 },
  { userId: 'demo-2', clubName: 'شیاطین سرخ', ownerName: 'امیرحسین رضایی', score: 839, rank: 2, rankChange: -1, isCurrent: false, formation: '4-2-3-1', playerCount: 11 },
  { userId: 'demo-3', clubName: 'توپچی‌های لندن', ownerName: 'مهرداد کریمی', score: 812, rank: 3, rankChange: 3, isCurrent: false, formation: '4-3-3', playerCount: 11 },
  { userId: 'demo-4', clubName: 'گرگ‌های آنفیلد', ownerName: 'نیما اکبری', score: 788, rank: 4, rankChange: 0, isCurrent: false, formation: '3-4-3', playerCount: 11 },
  { userId: 'demo-5', clubName: 'آبی‌های منچستر', ownerName: 'پویا احمدی', score: 756, rank: 5, rankChange: -2, isCurrent: false, formation: '4-3-3', playerCount: 11 },
  { userId: 'demo-6', clubName: 'شیرهای لندن', ownerName: 'کاربر توسعه', score: 731, rank: 6, rankChange: 4, isCurrent: true, formation: '3-5-2', playerCount: 11 },
  { userId: 'demo-7', clubName: 'عقاب‌های شمال', ownerName: 'سارا محمدی', score: 704, rank: 7, rankChange: 1, isCurrent: false, formation: '4-4-2', playerCount: 11 },
  { userId: 'demo-8', clubName: 'ستاره‌های کردستان', ownerName: 'آوات مرادی', score: 682, rank: 8, rankChange: -1, isCurrent: false, formation: '4-2-3-1', playerCount: 11 },
  { userId: 'demo-9', clubName: 'سرداران پارس', ownerName: 'یاسین نادری', score: 651, rank: 9, rankChange: 0, isCurrent: false, formation: '4-1-4-1', playerCount: 11 },
  { userId: 'demo-10', clubName: 'طلایی‌های اصفهان', ownerName: 'مهدی شریفی', score: 626, rank: 10, rankChange: 2, isCurrent: false, formation: '4-3-3', playerCount: 11 }
];

export function RankingsPage() {
  const [category, setCategory] = useState<RankingCategory>('fantasy');
  const [period, setPeriod] = useState<RankingPeriod>('week');
  const [mode, setMode] = useState<RankingMode>('performance');
  const [preview, setPreview] = useState<RankingEntry|null>(null);
  const queryType = mode === 'clubValue' ? 'club-value' : category;
  const query = useQuery({
    queryKey: ['rankings', queryType, period],
    queryFn: async () => (await api.get<RankingData>('/rankings', { params: { type: queryType, period } })).data
  });
  const demoMode = Boolean(query.data && query.data.leaders.length === 0);
  const leaders = useMemo(() => demoMode ? demoRankings(category, period, mode) : query.data?.leaders ?? [], [category, demoMode, mode, period, query.data?.leaders]);
  const current = demoMode ? leaders.find(entry => entry.isCurrent) : query.data?.current;
  const metric: RankingData['metric'] = mode === 'clubValue' ? 'value' : 'points';
  const activeCategory = categories.find(item => item.value === category)!;

  return (
    <main className="ranking-page pb-12">
      <header className="ranking-leaderboard-hero safe-top relative isolate overflow-hidden px-4 pb-12 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-30"/>
        <div className="ranking-hero-light absolute inset-0"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10 rounded-xl"/>
            <div className="ranking-ffn-lockup" dir="ltr"><strong>FFN</strong><span>FANTASY LEADERBOARD</span></div>
          </div>
          <WalletShortcut/>
        </div>
        <div className="relative mt-7 max-w-[330px]">
          <span className="text-[7px] font-black tracking-[.2em] text-cyan-300" dir="ltr">THE RACE FOR NUMBER ONE</span>
          <h1 className="mt-1.5 text-[27px] font-black leading-[1.35] tracking-tight">برترین تیم‌های فانتزی</h1>
          <p className="mt-2 max-w-[290px] text-[9px] font-medium leading-5 text-slate-400">رتبه‌بندی بر اساس عملکرد بازیکنان ترکیب فعال؛ امتیاز کاپیتان با ضریب دو محاسبه می‌شود.</p>
          <div className="ranking-captain-rule mt-2.5 flex w-fit items-center gap-1.5" dir="ltr"><Crown size={12}/><strong>CAPTAIN</strong><span>2×</span></div>
        </div>
      </header>

      <div className="relative -mt-7 px-4">
        <ModeSwitch value={mode} onChange={setMode}/>
      </div>

      <div className="mt-4 space-y-4 px-4">
        {mode === 'performance' && (
          <>
            <CategoryTabs value={category} onChange={setCategory}/>
            <PeriodTabs value={period} onChange={setPeriod}/>
          </>
        )}

        {query.isLoading ? (
          <RankingLoading/>
        ) : query.error ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/>
        ) : (
          <>
            {current && <CurrentRank entry={current} metric={metric} category={category}/>}

            {leaders.length ? (
              <>
                <section>
                  <SectionHead
                    eyebrow={mode === 'clubValue' ? 'CLUB VALUATION' : activeCategory.eyebrow}
                    title={mode === 'clubValue' ? 'باارزش‌ترین باشگاه‌ها' : 'صدرنشین‌های این رقابت'}
                    demo={demoMode}
                  />
                  <Podium entries={leaders.slice(0, 3)} metric={metric} category={category}/>
                </section>

                {leaders.length > 3 && (
                  <section className="pb-3">
                    <div className="mb-2.5 flex items-center justify-between">
                      <div><span className="text-[7px] font-black tracking-[.17em] text-fuchsia-300" dir="ltr">FULL TABLE</span><h2 className="mt-0.5 text-sm font-black">ادامه جدول</h2></div>
                      <span className="text-[8px] font-bold text-slate-500">{faNumber(leaders.length)} باشگاه</span>
                    </div>
                    <div className="ranking-list overflow-hidden rounded-[1.35rem] border border-white/[.075] p-1.5">
                      {leaders.slice(3).map(entry => <LeaderRow key={entry.userId} entry={entry} metric={metric} category={category} onPreview={setPreview}/>)}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <RankingEmpty mode={mode}/>
            )}
          </>
        )}
      </div>

      {preview && <TeamPreview entry={preview} metric={metric} category={category} onClose={() => setPreview(null)}/>}
    </main>
  );
}

function ModeSwitch({ value, onChange }: { value: RankingMode; onChange: (value: RankingMode) => void }) {
  return (
    <div className="ranking-mode-switch grid grid-cols-2 gap-1.5 p-1.5">
      <button type="button" aria-pressed={value === 'performance'} onClick={() => onChange('performance')} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-[.9rem] text-[10px] font-black transition active:scale-[.98]', value === 'performance' ? 'ranking-mode-active text-cyan-100' : 'text-slate-500')}><Trophy size={16}/>رتبه‌بندی عملکرد</button>
      <button type="button" aria-pressed={value === 'clubValue'} onClick={() => onChange('clubValue')} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-[.9rem] text-[10px] font-black transition active:scale-[.98]', value === 'clubValue' ? 'ranking-mode-active ranking-mode-value text-amber-100' : 'text-slate-500')}><Gem size={16}/>ارزش باشگاه‌ها</button>
    </div>
  );
}

function CategoryTabs({ value, onChange }: { value: RankingCategory; onChange: (value: RankingCategory) => void }) {
  return (
    <div className="ranking-category-tabs grid grid-cols-4 gap-1 p-1.5">
      {categories.map(({ value: itemValue, label, icon: Icon }) => {
        const active = value === itemValue;
        return <button key={itemValue} type="button" aria-pressed={active} onClick={() => onChange(itemValue)} className={cn('relative flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-xl text-[8.5px] font-extrabold transition active:scale-95', active ? 'bg-cyan-300/[.11] text-cyan-200' : 'text-slate-500')}><Icon size={16} strokeWidth={active ? 2.6 : 1.8}/><span>{label}</span>{active && <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-cyan-300"/>}</button>;
      })}
    </div>
  );
}

function PeriodTabs({ value, onChange }: { value: RankingPeriod; onChange: (value: RankingPeriod) => void }) {
  return (
    <div className="flex rounded-xl border border-white/[.07] bg-white/[.025] p-1">
      {periods.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)} className={cn('min-h-9 flex-1 rounded-lg text-[9px] font-bold transition', value === item.value ? 'bg-white/[.085] text-white shadow-[inset_0_1px_rgba(255,255,255,.05)]' : 'text-slate-500')}>{item.label}</button>)}
    </div>
  );
}

function CurrentRank({ entry, metric, category }: { entry: RankingEntry; metric: RankingData['metric']; category: RankingCategory }) {
  return (
    <section className="ranking-current-card relative isolate overflow-hidden p-3.5">
      <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-cyan-300 via-fuchsia-400 to-transparent"/>
      <div className="relative flex items-center gap-3">
        <span className="ranking-current-position grid h-14 min-w-14 place-items-center px-2 text-center"><span><small className="block text-[7px] font-black tracking-[.1em] text-cyan-300" dir="ltr">YOUR RANK</small><strong className="mt-0.5 block text-xl font-black">#{faNumber(entry.rank)}</strong></span></span>
        <ClubBadge entry={entry} className="h-12 w-11"/>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1 text-[8px] font-black text-cyan-300"><Sparkles size={11}/>جایگاه فعلی شما</div><h2 className="mt-1 truncate text-[12px] font-black">{entry.clubName}</h2><p className="mt-0.5 truncate text-[8px] text-slate-500">مالک: {entry.ownerName}</p></div>
        <div className="shrink-0 text-left"><Score value={entry.score} metric={metric} category={category} emphasize/><Movement value={entry.rankChange} className="mt-1 justify-end"/></div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, demo }: { eyebrow: string; title: string; demo: boolean }) {
  return <div className="mb-2.5 flex items-end justify-between"><div><span className="text-[7px] font-black tracking-[.17em] text-cyan-300" dir="ltr">{eyebrow}</span><h2 className="mt-0.5 text-[15px] font-black">{title}</h2></div>{demo && <span className="rounded-full border border-fuchsia-300/[.14] bg-fuchsia-300/[.07] px-2 py-1 text-[7px] font-black text-fuchsia-200" dir="ltr">DEMO BOARD</span>}</div>;
}

function Podium({ entries, metric, category }: { entries: RankingEntry[]; metric: RankingData['metric']; category: RankingCategory }) {
  const slots: Array<{ entry?: RankingEntry; rank: 1|2|3 }> = [
    { entry: entries[1], rank: 2 },
    { entry: entries[0], rank: 1 },
    { entry: entries[2], rank: 3 }
  ];
  return (
    <div className="ranking-podium-panel relative isolate overflow-hidden px-2 pb-3 pt-12">
      <div className="ranking-podium-light absolute inset-x-[22%] top-3 h-28 rounded-full blur-3xl"/>
      <div className="relative grid grid-cols-3 items-end gap-1.5">
        {slots.map(({ entry, rank }) => {
          if (!entry) return <div key={rank} className="h-[105px]" aria-hidden="true"/>;
          return (
            <article key={entry.userId} className="flex min-w-0 flex-col items-center text-center">
              <div className="relative z-10 mb-[-17px]">
                {rank === 1 && <Crown size={22} className="absolute -top-7 left-1/2 -translate-x-1/2 -rotate-6 fill-amber-300 text-amber-300"/>}
                <ClubBadge entry={entry} className={cn('w-12', rank === 1 ? 'h-[58px] w-[54px]' : 'h-[52px]')}/>
                <span className={cn('absolute -bottom-1 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-lg text-[9px] font-black shadow-lg', rank === 1 ? 'bg-amber-300 text-[#171006]' : rank === 2 ? 'bg-slate-200 text-slate-900' : 'bg-orange-600 text-white')}>{faNumber(rank)}</span>
              </div>
              <div className={cn('ranking-podium-step flex w-full flex-col items-center justify-end px-1 pb-3 pt-6', rank === 1 ? 'h-[142px] ranking-podium-gold' : rank === 2 ? 'h-[119px] ranking-podium-silver' : 'h-[105px] ranking-podium-bronze')}>
                <h3 className="line-clamp-2 min-h-7 w-full text-[9.5px] font-black leading-4">{entry.clubName}</h3>
                <p className="mt-0.5 w-full truncate text-[7px] text-slate-500">{entry.ownerName}</p>
                <Score value={entry.score} metric={metric} category={category} podium={rank}/>
                <Movement value={entry.rankChange} className="mt-1" compact/>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LeaderRow({ entry, metric, category, onPreview }: { entry: RankingEntry; metric: RankingData['metric']; category: RankingCategory; onPreview: (entry: RankingEntry) => void }) {
  return (
    <article className={cn('ranking-leader-row flex min-h-[78px] items-center gap-2.5 rounded-[1rem] px-2.5 py-2', entry.isCurrent && 'ranking-row-current')}>
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[.65rem] border text-[10px] font-black', entry.isCurrent ? 'border-cyan-300/25 bg-cyan-300/[.1] text-cyan-200' : 'border-white/[.07] bg-white/[.035] text-slate-400')}>{faNumber(entry.rank)}</span>
      <ClubBadge entry={entry} className="h-10 w-9"/>
      <div className="min-w-0 flex-1"><h3 className="truncate text-[10.5px] font-black">{entry.clubName}</h3><p className="mt-0.5 truncate text-[8px] text-slate-500">{entry.ownerName}</p><Movement value={entry.rankChange} className="mt-1" compact/></div>
      <div className="flex shrink-0 flex-col items-end gap-1.5"><Score value={entry.score} metric={metric} category={category}/><button type="button" onClick={() => onPreview(entry)} className="flex min-h-6 items-center gap-1 rounded-lg border border-white/[.07] bg-white/[.035] px-2 text-[7px] font-black text-slate-300 transition active:scale-95 active:bg-white/[.08]"><Eye size={10}/>مشاهده تیم</button></div>
    </article>
  );
}

function ClubBadge({ entry, className }: { entry: RankingEntry; className?: string }) {
  const palette = badgePalettes[badgeIndex(entry.userId)];
  const style = { '--badge-top': palette[0], '--badge-bottom': palette[1] } as CSSProperties;
  return <span className={cn('ranking-club-badge relative grid shrink-0 place-items-center', className)} style={style} aria-label={`نشان ${entry.clubName}`}><span>{badgeMark(entry.clubName)}</span></span>;
}

function Score({ value, metric, category, emphasize, podium }: { value: number; metric: RankingData['metric']; category: RankingCategory; emphasize?: boolean; podium?: 1|2|3 }) {
  const unit = metric === 'value' ? 'سکه' : category === 'friends' ? 'دعوت' : 'امتیاز';
  return <div className={cn('whitespace-nowrap text-left', podium && 'mt-1.5 text-center')}><strong className={cn('block font-black', emphasize ? 'text-[13px] text-white' : podium === 1 ? 'text-[10px] text-amber-300' : 'text-[10px] text-cyan-200')}>{faNumber(value)}</strong><span className="mt-0.5 block text-[6.5px] font-bold text-slate-500">{unit}</span></div>;
}

function Movement({ value, className, compact }: { value: number; className?: string; compact?: boolean }) {
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return <span className={cn('flex items-center gap-0.5 font-black', compact ? 'text-[6.5px]' : 'text-[8px]', value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-600', className)}><Icon size={compact ? 8 : 10} strokeWidth={2.7}/>{value ? faNumber(Math.abs(value)) : 'بدون تغییر'}</span>;
}

function RankingLoading() {
  return <div className="space-y-4" aria-label="در حال دریافت جدول رتبه‌بندی"><div className="broadcast-skeleton h-20 rounded-[1.3rem]"/><div className="broadcast-skeleton-hero relative h-56 overflow-hidden rounded-[1.5rem]"/><div className="space-y-2 rounded-[1.35rem] border border-white/[.05] p-2">{[0,1,2,3].map(item => <div key={item} className="broadcast-skeleton h-[70px] rounded-xl"/>)}</div></div>;
}

function RankingEmpty({ mode }: { mode: RankingMode }) {
  return <section className="ranking-empty-state rounded-[1.5rem] border border-dashed border-white/[.1] px-5 py-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/[.09] text-cyan-300">{mode === 'clubValue' ? <Gem size={23}/> : <Trophy size={23}/>}</span><h2 className="mt-4 text-sm font-black">هنوز تیمی وارد جدول نشده</h2><p className="mt-1.5 text-[9px] leading-5 text-slate-500">با ثبت ترکیب فعال و کسب اولین امتیاز، رتبه‌ها اینجا نمایش داده می‌شوند.</p></section>;
}

function TeamPreview({ entry, metric, category, onClose }: { entry: RankingEntry; metric: RankingData['metric']; category: RankingCategory; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[#03040d]/75 px-2 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={`تیم ${entry.clubName}`} onClick={event => event.stopPropagation()} className="ranking-team-preview safe-bottom relative mx-auto w-full max-w-xl rounded-t-[1.8rem] border border-b-0 border-cyan-200/[.12] p-4">
        <button type="button" onClick={onClose} aria-label="بستن" className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/[.055] text-slate-400"><X size={16}/></button>
        <div className="flex items-center gap-3 pr-1">
          <ClubBadge entry={entry} className="h-[62px] w-14"/>
          <div className="min-w-0"><span className="text-[7px] font-black tracking-[.18em] text-cyan-300" dir="ltr">TEAM SNAPSHOT</span><h2 className="mt-1 truncate text-base font-black">{entry.clubName}</h2><p className="mt-0.5 text-[9px] text-slate-500">مالک: {entry.ownerName}</p></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/[.035] p-3"><Medal size={15} className="mx-auto text-amber-300"/><strong className="mt-1.5 block text-xs">#{faNumber(entry.rank)}</strong><span className="mt-1 block text-[7px] text-slate-500">رتبه</span></div>
          <div className="rounded-xl bg-white/[.035] p-3"><ShieldCheck size={15} className="mx-auto text-cyan-300"/><strong className="mt-1.5 block text-xs" dir="ltr">{entry.formation || '—'}</strong><span className="mt-1 block text-[7px] text-slate-500">آرایش</span></div>
          <div className="rounded-xl bg-white/[.035] p-3"><Users size={15} className="mx-auto text-fuchsia-300"/><strong className="mt-1.5 block text-xs">{faNumber(entry.playerCount)}</strong><span className="mt-1 block text-[7px] text-slate-500">بازیکن فعال</span></div>
        </div>
        <div className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-cyan-200/[.1] bg-cyan-300/[.055] px-3"><span className="text-[9px] font-black text-cyan-100">عملکرد ثبت‌شده تیم</span><Score value={entry.score} metric={metric} category={category} emphasize/></div>
        <button type="button" onClick={onClose} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-300 to-emerald-300 text-[10px] font-black text-[#07111f]">بازگشت به جدول<ArrowLeft size={14}/></button>
      </section>
    </div>
  );
}

function demoRankings(category: RankingCategory, period: RankingPeriod, mode: RankingMode): RankingEntry[] {
  const periodFactor = period === 'week' ? 1 : period === 'month' ? 3.4 : 9.7;
  const categoryFactor = category === 'fantasy' ? 1 : category === 'predictions' ? .47 : category === 'quiz' ? .62 : .02;
  return demoTeams.map((entry, index) => ({
    ...entry,
    score: mode === 'clubValue' ? 98_500 - index * 4_730 : Math.max(category === 'friends' ? 1 : 0, Math.round(entry.score * periodFactor * categoryFactor))
  }));
}

function badgeIndex(value: string): number {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0) % badgePalettes.length;
}

function badgeMark(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
}
