import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BrainCircuit,
  ChevronLeft,
  Crown,
  Gem,
  Minus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { WalletShortcut } from '@/components/WalletShortcut';
import { ErrorState } from '@/components/ui';
import { api } from '@/lib/api';
import { formations, type FormationSlot } from '@/lib/formations';
import { cn, faNumber } from '@/lib/utils';
import type { BuiltInSquadFormation } from '@/types/api';

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
  logoUrl?: string;
  form?: number[];
}

interface RankingData {
  type: RankingCategory|'club-value';
  period: RankingPeriod;
  metric: 'points'|'value';
  leaders: RankingEntry[];
  current: RankingEntry;
}

interface RankingClubPlayer {
  _id: string;
  name: string;
  position: string;
  photoUrl?: string;
  nationality?: string;
  club?: string;
  marketValue?: number;
  fantasyPoints: number;
}

interface RankingClubDetails {
  userId: string;
  logoUrl?: string;
  formation?: string;
  starters: Array<RankingClubPlayer|null>;
  substitutes: RankingClubPlayer[];
  captainId?: string;
  viceCaptainId?: string;
  customPositions: FormationSlot[];
  totalSquadValue: number;
  totalFantasyPoints: number;
  recentWeeks: Array<{ startsAt: string; points: number }>;
}

interface DemoClubSeed extends RankingEntry {
  players: string[];
  substitutes: string[];
  captainIndex: number;
  viceCaptainIndex: number;
}

const categories: Array<{ value: RankingCategory; label: string; eyebrow: string; icon: typeof Trophy }> = [
  { value: 'fantasy', label: 'فانتزی', eyebrow: 'FANTASY TABLE', icon: ShieldCheck },
  { value: 'predictions', label: 'پیش‌بینی', eyebrow: 'PREDICTION TABLE', icon: Target },
  { value: 'quiz', label: 'کوییز', eyebrow: 'QUIZ TABLE', icon: BrainCircuit },
  { value: 'friends', label: 'دوستان', eyebrow: 'FRIENDS TABLE', icon: Users }
];

const periods: Array<{ value: RankingPeriod; label: string }> = [
  { value: 'week', label: 'هفته جاری' },
  { value: 'month', label: 'ماه جاری' },
  { value: 'season', label: 'کل فصل' }
];

const demoTeams: DemoClubSeed[] = [
  {
    userId: 'demo-man-city', clubName: 'Manchester City', ownerName: 'آرش زمانی', logoUrl: 'https://media.api-sports.io/football/teams/50.png',
    score: 864, rank: 1, rankChange: 2, isCurrent: false, formation: '4-3-3', playerCount: 11, form: [61, 74, 68, 82, 79], captainIndex: 9, viceCaptainIndex: 6,
    players: ['Ederson', 'Joško Gvardiol', 'Rúben Dias', 'John Stones', 'Kyle Walker', 'Rodri', 'Phil Foden', 'Kevin De Bruyne', 'Jérémy Doku', 'Erling Haaland', 'Savinho'],
    substitutes: ['Stefan Ortega', 'Manuel Akanji', 'Bernardo Silva', 'Jack Grealish', 'Omar Marmoush']
  },
  {
    userId: 'demo-man-utd', clubName: 'Manchester United', ownerName: 'امیرحسین رضایی', logoUrl: 'https://media.api-sports.io/football/teams/33.png',
    score: 839, rank: 2, rankChange: -1, isCurrent: false, formation: '4-2-3-1', playerCount: 11, form: [77, 69, 72, 66, 81], captainIndex: 8, viceCaptainIndex: 6,
    players: ['André Onana', 'Diogo Dalot', 'Lisandro Martínez', 'Matthijs de Ligt', 'Noussair Mazraoui', 'Casemiro', 'Kobbie Mainoo', 'Alejandro Garnacho', 'Bruno Fernandes', 'Amad Diallo', 'Rasmus Højlund'],
    substitutes: ['Altay Bayındır', 'Harry Maguire', 'Mason Mount', 'Joshua Zirkzee', 'Luke Shaw']
  },
  {
    userId: 'demo-arsenal', clubName: 'Arsenal', ownerName: 'مهرداد کریمی', logoUrl: 'https://media.api-sports.io/football/teams/42.png',
    score: 812, rank: 3, rankChange: 3, isCurrent: false, formation: '4-3-3', playerCount: 11, form: [54, 63, 76, 71, 84], captainIndex: 10, viceCaptainIndex: 6,
    players: ['David Raya', 'Riccardo Calafiori', 'Gabriel Magalhães', 'William Saliba', 'Jurriën Timber', 'Declan Rice', 'Martin Ødegaard', 'Mikel Merino', 'Gabriel Martinelli', 'Kai Havertz', 'Bukayo Saka'],
    substitutes: ['Neto', 'Ben White', 'Jakub Kiwior', 'Leandro Trossard', 'Gabriel Jesus']
  },
  {
    userId: 'demo-liverpool', clubName: 'Liverpool', ownerName: 'نیما اکبری', logoUrl: 'https://media.api-sports.io/football/teams/40.png',
    score: 788, rank: 4, rankChange: 0, isCurrent: false, formation: '3-4-3', playerCount: 11, form: [70, 67, 70, 74, 73], captainIndex: 10, viceCaptainIndex: 2,
    players: ['Alisson', 'Ibrahima Konaté', 'Virgil van Dijk', 'Andrew Robertson', 'Ryan Gravenberch', 'Alexis Mac Allister', 'Dominik Szoboszlai', 'Curtis Jones', 'Luis Díaz', 'Darwin Núñez', 'Mohamed Salah'],
    substitutes: ['Caoimhín Kelleher', 'Joe Gomez', 'Wataru Endo', 'Cody Gakpo', 'Diogo Jota']
  },
  {
    userId: 'demo-chelsea', clubName: 'Chelsea', ownerName: 'کاربر توسعه', logoUrl: 'https://media.api-sports.io/football/teams/49.png',
    score: 756, rank: 5, rankChange: 2, isCurrent: true, formation: '4-2-3-1', playerCount: 11, form: [49, 58, 64, 61, 78], captainIndex: 8, viceCaptainIndex: 5,
    players: ['Robert Sánchez', 'Marc Cucurella', 'Levi Colwill', 'Wesley Fofana', 'Reece James', 'Moisés Caicedo', 'Enzo Fernández', 'Pedro Neto', 'Cole Palmer', 'Noni Madueke', 'Nicolas Jackson'],
    substitutes: ['Filip Jørgensen', 'Tosin Adarabioyo', 'Roméo Lavia', 'Christopher Nkunku', 'Jadon Sancho']
  },
  {
    userId: 'demo-tottenham', clubName: 'Tottenham Hotspur', ownerName: 'پویا احمدی', logoUrl: 'https://media.api-sports.io/football/teams/47.png',
    score: 731, rank: 6, rankChange: -2, isCurrent: false, formation: '3-5-2', playerCount: 11, form: [68, 62, 55, 69, 57], captainIndex: 10, viceCaptainIndex: 6,
    players: ['Guglielmo Vicario', 'Micky van de Ven', 'Cristian Romero', 'Pedro Porro', 'Destiny Udogie', 'Yves Bissouma', 'James Maddison', 'Pape Matar Sarr', 'Dejan Kulusevski', 'Brennan Johnson', 'Son Heung-min'],
    substitutes: ['Fraser Forster', 'Radu Drăgușin', 'Rodrigo Bentancur', 'Timo Werner', 'Richarlison']
  },
  {
    userId: 'demo-newcastle', clubName: 'Newcastle United', ownerName: 'سارا محمدی', logoUrl: 'https://media.api-sports.io/football/teams/34.png',
    score: 704, rank: 7, rankChange: 1, isCurrent: false, formation: '4-3-3', playerCount: 11, form: [51, 66, 59, 68, 63], captainIndex: 9, viceCaptainIndex: 6,
    players: ['Nick Pope', 'Lewis Hall', 'Sven Botman', 'Fabian Schär', 'Kieran Trippier', 'Bruno Guimarães', 'Sandro Tonali', 'Joelinton', 'Anthony Gordon', 'Alexander Isak', 'Harvey Barnes'],
    substitutes: ['Martin Dúbravka', 'Dan Burn', 'Joe Willock', 'Jacob Murphy', 'Callum Wilson']
  },
  {
    userId: 'demo-aston-villa', clubName: 'Aston Villa', ownerName: 'آوات مرادی', logoUrl: 'https://media.api-sports.io/football/teams/66.png',
    score: 682, rank: 8, rankChange: -1, isCurrent: false, formation: '4-4-2', playerCount: 11, form: [60, 54, 63, 52, 65], captainIndex: 10, viceCaptainIndex: 6,
    players: ['Emiliano Martínez', 'Lucas Digne', 'Pau Torres', 'Ezri Konsa', 'Matty Cash', 'John McGinn', 'Youri Tielemans', 'Boubacar Kamara', 'Leon Bailey', 'Morgan Rogers', 'Ollie Watkins'],
    substitutes: ['Robin Olsen', 'Tyrone Mings', 'Ross Barkley', 'Jacob Ramsey', 'Jhon Durán']
  }
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
  const rankedEntries = useMemo(() => {
    if (!current || leaders.some(entry => entry.userId === current.userId)) return leaders;
    return [...leaders, current].sort((a, b) => a.rank - b.rank);
  }, [current, leaders]);
  const metric: RankingData['metric'] = mode === 'clubValue' ? 'value' : 'points';
  const activeCategory = categories.find(item => item.value === category)!;

  return (
    <main className="ranking-page pb-12">
      <header className="ranking-leaderboard-hero safe-top relative isolate overflow-hidden px-4 pb-11 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-30"/>
        <div className="ranking-hero-light absolute inset-0"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10 rounded-xl"/>
            <div className="ranking-ffn-lockup" dir="ltr"><strong>FFN</strong><span>FANTASY LEADERBOARD</span></div>
          </div>
          <WalletShortcut/>
        </div>
        <div className="relative mt-6 max-w-[330px]">
          <span className="text-[7px] font-black tracking-[.2em] text-cyan-300" dir="ltr">PREMIER FANTASY RANKINGS</span>
          <h1 className="mt-1.5 text-[25px] font-black leading-[1.35] tracking-tight">جدول برترین باشگاه‌ها</h1>
          <p className="mt-2 max-w-[300px] text-[9px] font-medium leading-5 text-slate-400">رتبه‌بندی زنده، فرم اخیر و امتیاز فانتزی تمام باشگاه‌ها در یک جدول دقیق و حرفه‌ای.</p>
          <div className="ranking-captain-rule mt-2.5 flex w-fit items-center gap-1.5" dir="ltr"><Crown size={12}/><strong>CAPTAIN</strong><span>2×</span></div>
        </div>
      </header>

      <div className="relative -mt-7 px-3.5 min-[390px]:px-4">
        <ModeSwitch value={mode} onChange={setMode}/>
      </div>

      <div className="mt-3.5 space-y-3.5 px-3.5 min-[390px]:px-4">
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
        ) : rankedEntries.length ? (
          <section className="pb-3">
            <SectionHead
              eyebrow={mode === 'clubValue' ? 'CLUB VALUATION' : activeCategory.eyebrow}
              title={mode === 'clubValue' ? 'باارزش‌ترین باشگاه‌ها' : 'جدول کامل رتبه‌بندی'}
              count={rankedEntries.length}
              demo={demoMode}
            />
            <div className="ranking-list overflow-hidden rounded-[1.25rem] border border-white/[.075] p-1.5">
              {rankedEntries.map(entry => (
                <LeaderRow key={entry.userId} entry={entry} metric={metric} category={category} onPreview={setPreview}/>
              ))}
            </div>
          </section>
        ) : (
          <RankingEmpty mode={mode}/>
        )}
      </div>

      {preview && <ClubDetailsSheet entry={preview} metric={metric} category={category} period={period} onClose={() => setPreview(null)}/>}
    </main>
  );
}

function ModeSwitch({ value, onChange }: { value: RankingMode; onChange: (value: RankingMode) => void }) {
  return (
    <div className="ranking-mode-switch grid grid-cols-2 gap-1.5 p-1.5">
      <button type="button" aria-pressed={value === 'performance'} onClick={() => onChange('performance')} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-[.9rem] text-[9px] font-black transition active:scale-[.98] min-[360px]:text-[10px]', value === 'performance' ? 'ranking-mode-active text-cyan-100' : 'text-slate-500')}><Trophy size={15}/>رتبه‌بندی عملکرد</button>
      <button type="button" aria-pressed={value === 'clubValue'} onClick={() => onChange('clubValue')} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-[.9rem] text-[9px] font-black transition active:scale-[.98] min-[360px]:text-[10px]', value === 'clubValue' ? 'ranking-mode-active ranking-mode-value text-amber-100' : 'text-slate-500')}><Gem size={15}/>ارزش باشگاه‌ها</button>
    </div>
  );
}

function CategoryTabs({ value, onChange }: { value: RankingCategory; onChange: (value: RankingCategory) => void }) {
  return (
    <div className="ranking-category-tabs grid grid-cols-4 gap-1 p-1.5">
      {categories.map(({ value: itemValue, label, icon: Icon }) => {
        const active = value === itemValue;
        return <button key={itemValue} type="button" aria-pressed={active} onClick={() => onChange(itemValue)} className={cn('relative flex min-h-[54px] flex-col items-center justify-center gap-1.5 rounded-xl text-[8px] font-extrabold transition active:scale-95', active ? 'bg-cyan-300/[.11] text-cyan-200' : 'text-slate-500')}><Icon size={15} strokeWidth={active ? 2.6 : 1.8}/><span>{label}</span>{active && <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-cyan-300"/>}</button>;
      })}
    </div>
  );
}

function PeriodTabs({ value, onChange }: { value: RankingPeriod; onChange: (value: RankingPeriod) => void }) {
  return (
    <div className="flex rounded-xl border border-white/[.07] bg-white/[.025] p-1">
      {periods.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)} className={cn('min-h-9 flex-1 rounded-lg text-[8.5px] font-bold transition min-[360px]:text-[9px]', value === item.value ? 'bg-white/[.085] text-white shadow-[inset_0_1px_rgba(255,255,255,.05)]' : 'text-slate-500')}>{item.label}</button>)}
    </div>
  );
}

function SectionHead({ eyebrow, title, count, demo }: { eyebrow: string; title: string; count: number; demo: boolean }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-2">
      <div><span className="text-[7px] font-black tracking-[.17em] text-cyan-300" dir="ltr">{eyebrow}</span><h2 className="mt-0.5 text-[14px] font-black">{title}</h2></div>
      <div className="flex items-center gap-1.5">{demo && <span className="rounded-full border border-fuchsia-300/[.14] bg-fuchsia-300/[.07] px-1.5 py-1 text-[6px] font-black text-fuchsia-200" dir="ltr">DEMO</span>}<span className="text-[7.5px] font-bold text-slate-500">{faNumber(count)} باشگاه</span></div>
    </div>
  );
}

function LeaderRow({ entry, metric, category, onPreview }: { entry: RankingEntry; metric: RankingData['metric']; category: RankingCategory; onPreview: (entry: RankingEntry) => void }) {
  const podiumRank = entry.rank >= 1 && entry.rank <= 3 ? entry.rank : undefined;
  return (
    <button
      type="button"
      onClick={() => onPreview(entry)}
      aria-label={`مشاهده جزئیات ${entry.clubName}`}
      className={cn(
        'ranking-leader-row group relative flex min-h-[74px] w-full items-center gap-2 rounded-[.95rem] px-2 py-2 text-right transition active:scale-[.992] active:bg-white/[.045] min-[390px]:gap-2.5 min-[390px]:px-2.5',
        podiumRank && `ranking-row-top-${podiumRank}`,
        entry.isCurrent && 'ranking-row-current'
      )}
    >
      <span className={cn('ranking-rank grid h-8 w-8 shrink-0 place-items-center rounded-[.65rem] border text-[10px] font-black', podiumRank && `ranking-rank-${podiumRank}`, entry.isCurrent && 'ranking-rank-current')}>{faNumber(entry.rank)}</span>
      <span className="ranking-crest-shell grid h-10 w-10 shrink-0 place-items-center rounded-xl"><ClubCrest name={entry.clubName} logo={entry.logoUrl} className="h-9 w-9 !overflow-visible !rounded-none"/></span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5"><strong className="truncate text-[10px] font-black text-slate-100 min-[380px]:text-[10.5px]" dir="ltr">{entry.clubName}</strong>{entry.isCurrent && <span className="ranking-you-badge shrink-0">تیم شما</span>}</span>
        <span className="mt-0.5 block truncate text-[7.5px] text-slate-500">مالک: {entry.ownerName}</span>
        <span className="mt-1.5 flex items-center gap-2.5"><Movement value={entry.rankChange}/><CurrentForm values={entry.form}/></span>
      </span>
      <span className="flex shrink-0 items-center gap-1 min-[390px]:gap-1.5">
        <Score value={entry.score} metric={metric} category={category}/>
        <ChevronLeft size={13} className="text-slate-700 transition group-active:-translate-x-0.5 group-active:text-cyan-300"/>
      </span>
    </button>
  );
}

function Score({ value, metric, category, emphasize }: { value: number; metric: RankingData['metric']; category: RankingCategory; emphasize?: boolean }) {
  const unit = metric === 'value' ? 'سکه' : category === 'friends' ? 'دعوت' : 'امتیاز';
  return <span className="min-w-[42px] whitespace-nowrap text-left"><strong className={cn('block font-black', emphasize ? 'text-[15px] text-white' : 'text-[10.5px] text-cyan-200')}>{faNumber(value)}</strong><span className="mt-0.5 block text-[6px] font-bold text-slate-500">{unit}</span></span>;
}

function Movement({ value }: { value: number }) {
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return <span className={cn('flex items-center gap-0.5 text-[6px] font-black', value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-600')}><Icon size={8} strokeWidth={2.8}/>{value ? faNumber(Math.abs(value)) : 'ثابت'}</span>;
}

function CurrentForm({ values }: { values?: number[] }) {
  if (!values?.length) return <span className="text-[6px] font-bold text-slate-600">فرم —</span>;
  const recent = values.slice(-5);
  const max = Math.max(...recent.map(Math.abs), 1);
  return (
    <span className="flex items-center gap-1" aria-label={`فرم اخیر: ${recent.join('، ')}`}>
      <span className="text-[6px] font-bold text-slate-600">فرم</span>
      <span className="flex h-3 items-end gap-[2px]" dir="ltr">{recent.map((value, index) => <i key={`${value}-${index}`} className={cn('block w-[3px] rounded-full', index === recent.length - 1 ? 'bg-cyan-300' : 'bg-slate-600')} style={{ height: `${Math.max(3, Math.round(Math.abs(value) / max * 12))}px` }}/>)}</span>
    </span>
  );
}

function RankingLoading() {
  return <div className="space-y-2" aria-label="در حال دریافت جدول رتبه‌بندی"><div className="broadcast-skeleton h-8 rounded-xl"/><div className="space-y-1 rounded-[1.25rem] border border-white/[.05] p-1.5">{[0,1,2,3,4,5].map(item => <div key={item} className="broadcast-skeleton h-[72px] rounded-xl"/>)}</div></div>;
}

function RankingEmpty({ mode }: { mode: RankingMode }) {
  return <section className="ranking-empty-state rounded-[1.5rem] border border-dashed border-white/[.1] px-5 py-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/[.09] text-cyan-300">{mode === 'clubValue' ? <Gem size={23}/> : <Trophy size={23}/>}</span><h2 className="mt-4 text-sm font-black">هنوز تیمی وارد جدول نشده</h2><p className="mt-1.5 text-[9px] leading-5 text-slate-500">با ثبت ترکیب فعال و کسب اولین امتیاز، رتبه‌ها اینجا نمایش داده می‌شوند.</p></section>;
}

function ClubDetailsSheet({ entry, metric, category, period, onClose }: { entry: RankingEntry; metric: RankingData['metric']; category: RankingCategory; period: RankingPeriod; onClose: () => void }) {
  const [selectedPlayer, setSelectedPlayer] = useState<RankingClubPlayer|null>(null);
  const isDemo = entry.userId.startsWith('demo-');
  const detailQuery = useQuery({
    queryKey: ['rankingClubDetails', entry.userId, period],
    queryFn: async () => (await api.get<RankingClubDetails>(`/rankings/${entry.userId}`, { params: { period } })).data,
    enabled: !isDemo,
    retry: 1
  });
  const details = useMemo(() => isDemo ? demoClubDetails(entry) : detailQuery.data, [detailQuery.data, entry, isDemo]);

  return (
    <PlayerModalFrame label={`جزئیات باشگاه ${entry.clubName}`} onClose={onClose} className="ranking-detail-sheet !h-[100dvh] !max-h-[100dvh] !rounded-none min-[520px]:!h-[96dvh] min-[520px]:!max-h-[96dvh] min-[520px]:!rounded-t-[2rem]">
      <div className="momentum-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(20px,var(--safe-bottom))] min-[390px]:px-4">
        <ClubDetailHero entry={entry} details={details} metric={metric} category={category}/>

        {detailQuery.isLoading && !isDemo ? (
          <DetailLoading/>
        ) : detailQuery.error && !details ? (
          <div className="mt-3"><ErrorState message={(detailQuery.error as Error).message} onRetry={() => detailQuery.refetch()}/></div>
        ) : details ? (
          <>
            <DetailSummary entry={entry} details={details}/>
            <Captaincy details={details}/>
            <LineupPitch details={details} onPlayer={setSelectedPlayer}/>
            <Bench players={details.substitutes} onPlayer={setSelectedPlayer}/>
            <RecentPerformance weeks={details.recentWeeks}/>
          </>
        ) : (
          <MissingLineup/>
        )}

        <button type="button" onClick={onClose} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-300 to-emerald-300 text-[10px] font-black text-[#07111f]">بازگشت به جدول<ArrowLeft size={14}/></button>
      </div>
      {selectedPlayer && <PlayerDetails player={selectedPlayer} onClose={() => setSelectedPlayer(null)}/>}
    </PlayerModalFrame>
  );
}

function ClubDetailHero({ entry, details, metric, category }: { entry: RankingEntry; details?: RankingClubDetails; metric: RankingData['metric']; category: RankingCategory }) {
  return (
    <section className="ranking-detail-hero relative isolate overflow-hidden rounded-[1.4rem] border border-cyan-200/[.1] px-3.5 pb-4 pt-2 text-center">
      <div className="ranking-detail-hero-grid absolute inset-0"/>
      <div className="relative mx-auto grid h-[88px] w-[88px] place-items-center rounded-[1.7rem] border border-white/[.08] bg-white/[.045] shadow-[0_18px_34px_rgba(0,0,0,.28)]"><ClubCrest name={entry.clubName} logo={details?.logoUrl || entry.logoUrl} className="h-[72px] w-[72px] !overflow-visible !rounded-none"/></div>
      <div className="relative mt-2"><span className="text-[6px] font-black tracking-[.2em] text-cyan-300" dir="ltr">CLUB PERFORMANCE CENTRE</span><h2 className="mt-1 text-[18px] font-black leading-6" dir="ltr">{entry.clubName}</h2><p className="mt-1 text-[8px] text-slate-400">مدیر / مالک: <strong className="text-slate-200">{entry.ownerName}</strong></p></div>
      <div className="relative mt-3 flex items-center justify-center gap-5"><span><small className="block text-[6px] text-slate-500">رتبه</small><strong className="mt-0.5 block text-sm text-amber-300">#{faNumber(entry.rank)}</strong></span><span className="h-7 w-px bg-white/[.08]"/><Score value={entry.score} metric={metric} category={category} emphasize/></div>
    </section>
  );
}

function DetailSummary({ entry, details }: { entry: RankingEntry; details: RankingClubDetails }) {
  const completePlayers = details.starters.filter(Boolean).length;
  return (
    <section className="mt-3 grid grid-cols-3 gap-1.5">
      <SummaryCard icon={<ShieldCheck size={14}/>} label="آرایش منتخب" value={details.formation || entry.formation || 'ثبت نشده'} dir="ltr"/>
      <SummaryCard icon={<Sparkles size={14}/>} label="امتیاز فانتزی" value={faNumber(details.totalFantasyPoints)}/>
      <SummaryCard icon={<Gem size={14}/>} label="ارزش کل تیم" value={details.totalSquadValue ? `${faNumber(details.totalSquadValue)} سکه` : 'ثبت نشده'}/>
      {completePlayers < 11 && <div className="col-span-3 rounded-xl border border-amber-300/[.12] bg-amber-300/[.055] px-3 py-2 text-[7.5px] leading-4 text-amber-100">اطلاعات ترکیب کامل نیست؛ {faNumber(completePlayers)} بازیکن اصلی در دسترس است.</div>}
    </section>
  );
}

function SummaryCard({ icon, label, value, dir }: { icon: React.ReactNode; label: string; value: string; dir?: 'ltr'|'rtl' }) {
  return <div className="ranking-detail-stat min-w-0 rounded-xl border border-white/[.06] p-2 text-center"><span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-cyan-300/[.08] text-cyan-300">{icon}</span><span className="mt-1.5 block truncate text-[6px] text-slate-500">{label}</span><strong className="mt-0.5 block truncate text-[8px] text-slate-100" dir={dir}>{value}</strong></div>;
}

function Captaincy({ details }: { details: RankingClubDetails }) {
  const players = [...details.starters.filter((player): player is RankingClubPlayer => Boolean(player)), ...details.substitutes];
  const captain = players.find(player => player._id === details.captainId);
  const viceCaptain = players.find(player => player._id === details.viceCaptainId);
  return (
    <section className="mt-3 grid grid-cols-2 gap-1.5">
      <CaptainCard type="C" label="کاپیتان" player={captain}/>
      <CaptainCard type="V" label="نایب‌کاپیتان" player={viceCaptain}/>
    </section>
  );
}

function CaptainCard({ type, label, player }: { type: 'C'|'V'; label: string; player?: RankingClubPlayer }) {
  return <div className="flex min-h-12 items-center gap-2 rounded-xl border border-white/[.065] bg-white/[.025] px-2.5"><span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9px] font-black', type === 'C' ? 'bg-amber-300 text-[#171006]' : 'bg-slate-300 text-slate-900')}>{type}</span><span className="min-w-0"><small className="block text-[6px] text-slate-500">{label}</small><strong className={cn('mt-0.5 block truncate text-[7.5px]', !player && 'text-slate-600')} dir="ltr">{player?.name || 'ثبت نشده'}</strong></span></div>;
}

function LineupPitch({ details, onPlayer }: { details: RankingClubDetails; onPlayer: (player: RankingClubPlayer) => void }) {
  const hasLineup = details.starters.some(Boolean);
  const positions = lineupPositions(details);
  return (
    <section className="mt-4">
      <SectionTitle eyebrow="STARTING XI" title="ترکیب اصلی" trailing={details.formation || '—'}/>
      {hasLineup ? (
        <div className="ranking-detail-pitch relative mt-2 overflow-hidden rounded-[1.25rem] border border-emerald-100/[.16]" dir="ltr">
          <PitchMarkings/>
          {details.starters.map((player, index) => {
            const position = positions[index] ?? formations['4-3-3'][index];
            if (!player) return <span key={`empty-${index}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} className="ranking-empty-slot absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-dashed border-white/20 text-[6px] text-white/30">{position.role}</span>;
            return <PitchPlayer key={player._id} player={player} position={position} captain={player._id === details.captainId} viceCaptain={player._id === details.viceCaptainId} onClick={() => onPlayer(player)}/>;
          })}
        </div>
      ) : <MissingLineup compact/>}
    </section>
  );
}

function PitchMarkings() {
  return <div className="pointer-events-none absolute inset-2 rounded-[.95rem] border border-white/[.17]"><span className="absolute left-0 right-0 top-1/2 border-t border-white/[.15]"/><span className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[.15]"/><span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[.2]"/><span className="absolute left-1/2 top-0 h-[17%] w-[45%] -translate-x-1/2 border border-t-0 border-white/[.15]"/><span className="absolute bottom-0 left-1/2 h-[17%] w-[45%] -translate-x-1/2 border border-b-0 border-white/[.15]"/></div>;
}

function PitchPlayer({ player, position, captain, viceCaptain, onClick }: { player: RankingClubPlayer; position: FormationSlot; captain: boolean; viceCaptain: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`جزئیات ${player.name}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} className="ranking-pitch-player absolute flex w-[54px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center min-[390px]:w-[60px]">
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-white/20 bg-[#101a38] shadow-[0_7px_14px_rgba(0,0,0,.35)] min-[390px]:h-9 min-[390px]:w-9">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <Shirt size={15} className="text-cyan-200"/>}{(captain || viceCaptain) && <i className={cn('absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full text-[6px] font-black not-italic', captain ? 'bg-amber-300 text-[#171006]' : 'bg-slate-200 text-slate-900')}>{captain ? 'C' : 'V'}</i>}</span>
      <strong className="mt-0.5 block w-full truncate rounded bg-[#071426]/80 px-1 py-0.5 text-[6px] font-black text-white min-[390px]:text-[6.5px]">{player.name}</strong>
      <span className="mt-px rounded-full bg-black/35 px-1 text-[5.5px] font-bold text-cyan-100">{position.role} · {faNumber(player.fantasyPoints)}</span>
    </button>
  );
}

function Bench({ players, onPlayer }: { players: RankingClubPlayer[]; onPlayer: (player: RankingClubPlayer) => void }) {
  return (
    <section className="mt-4">
      <SectionTitle eyebrow="SUBSTITUTES" title="نیمکت ذخیره" trailing={`${faNumber(players.length)} بازیکن`}/>
      {players.length ? <div className="momentum-scroll mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none" dir="ltr">{players.map(player => <button key={player._id} type="button" onClick={() => onPlayer(player)} className="ranking-bench-player flex min-h-[72px] w-[112px] shrink-0 items-center gap-2 rounded-xl border border-white/[.065] px-2 text-left transition active:scale-[.98] active:border-cyan-300/20"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[.1] bg-white/[.05]">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <Shirt size={15} className="text-slate-400"/>}</span><span className="min-w-0"><strong className="block truncate text-[7px] text-slate-100">{player.name}</strong><small className="mt-1 block text-[6px] text-slate-500">{player.position} · {faNumber(player.fantasyPoints)} امتیاز</small></span></button>)}</div> : <div className="mt-2 rounded-xl border border-dashed border-white/[.07] px-3 py-5 text-center text-[8px] text-slate-600">بازیکن ذخیره‌ای ثبت نشده است.</div>}
    </section>
  );
}

function RecentPerformance({ weeks }: { weeks: RankingClubDetails['recentWeeks'] }) {
  const max = Math.max(...weeks.map(week => Math.abs(week.points)), 1);
  return (
    <section className="mt-4">
      <SectionTitle eyebrow="LAST 5 GAMEWEEKS" title="عملکرد هفته‌های اخیر" trailing={weeks.length ? `${faNumber(weeks[weeks.length - 1].points)} امتیاز` : '—'}/>
      {weeks.length ? <div className="ranking-form-chart mt-2 flex h-[112px] items-end justify-between gap-2 rounded-[1.1rem] border border-white/[.06] px-3 pb-2.5 pt-4" dir="ltr">{weeks.map((week, index) => <div key={week.startsAt} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[6px] font-black text-slate-300">{faNumber(week.points)}</span><i className={cn('block w-full max-w-7 rounded-t-md bg-gradient-to-t not-italic', index === weeks.length - 1 ? 'from-cyan-500 to-emerald-300' : 'from-fuchsia-900/70 to-fuchsia-400/70')} style={{ height: `${Math.max(8, Math.round(Math.abs(week.points) / max * 62))}px` }}/><small className="mt-1.5 truncate text-[5.5px] text-slate-600">{formatWeek(week.startsAt)}</small></div>)}</div> : <div className="mt-2 rounded-xl border border-dashed border-white/[.07] px-3 py-6 text-center text-[8px] text-slate-600">هنوز عملکرد هفتگی ثبت نشده است.</div>}
    </section>
  );
}

function SectionTitle({ eyebrow, title, trailing }: { eyebrow: string; title: string; trailing: string }) {
  return <div className="flex items-end justify-between gap-3"><div><span className="text-[6px] font-black tracking-[.16em] text-fuchsia-300" dir="ltr">{eyebrow}</span><h3 className="mt-0.5 text-[11px] font-black">{title}</h3></div><span className="rounded-full bg-white/[.04] px-2 py-1 text-[6.5px] font-bold text-slate-500" dir="ltr">{trailing}</span></div>;
}

function MissingLineup({ compact = false }: { compact?: boolean }) {
  return <div className={cn('ranking-missing-lineup mt-2 rounded-[1.15rem] border border-dashed border-cyan-200/[.1] px-5 text-center', compact ? 'py-10' : 'py-14')}><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/[.07] text-cyan-300"><Users size={18}/></span><h3 className="mt-3 text-[10px] font-black">ترکیب در دسترس نیست</h3><p className="mx-auto mt-1 max-w-[240px] text-[7.5px] leading-4 text-slate-600">این باشگاه هنوز ترکیب خود را کامل نکرده یا اطلاعات بازیکنان برای نمایش عمومی ثبت نشده است.</p></div>;
}

function DetailLoading() {
  return <div className="mt-3 space-y-2"><div className="grid grid-cols-3 gap-1.5">{[0,1,2].map(item => <div key={item} className="broadcast-skeleton h-20 rounded-xl"/>)}</div><div className="broadcast-skeleton h-[410px] rounded-[1.25rem]"/><div className="broadcast-skeleton h-24 rounded-xl"/></div>;
}

function PlayerDetails({ player, onClose }: { player: RankingClubPlayer; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-[#02040c]/75 px-2 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section className="ranking-player-card safe-bottom relative w-full rounded-t-[1.6rem] border border-b-0 border-cyan-200/[.12] p-4" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`جزئیات ${player.name}`}>
        <button type="button" onClick={onClose} className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/[.05] text-slate-400" aria-label="بازگشت"><ArrowLeft size={15}/></button>
        <div className="flex items-center gap-3" dir="ltr"><span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/[.1] bg-white/[.045]">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <UserRound size={26} className="text-cyan-300"/>}</span><span className="min-w-0"><small className="text-[6px] font-black tracking-[.16em] text-cyan-300">PLAYER PROFILE</small><h3 className="mt-1 truncate text-sm font-black text-white">{player.name}</h3><p className="mt-1 text-[7px] text-slate-500">{player.club || 'باشگاه ثبت نشده'}</p></span></div>
        <div className="mt-4 grid grid-cols-3 gap-1.5"><PlayerInfo label="پست" value={positionLabel(player.position)}/><PlayerInfo label="امتیاز فانتزی" value={faNumber(player.fantasyPoints)}/><PlayerInfo label="ارزش" value={player.marketValue === undefined ? '—' : `${faNumber(player.marketValue)} سکه`}/></div>
        <div className="mt-2 flex min-h-10 items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] px-3 text-[7.5px]"><span className="text-slate-500">ملیت</span><strong className="text-slate-200">{player.nationality || 'ثبت نشده'}</strong></div>
        <button type="button" onClick={onClose} className="mt-3 min-h-10 w-full rounded-xl bg-white/[.065] text-[9px] font-black text-white">بستن جزئیات بازیکن</button>
      </section>
    </div>
  );
}

function PlayerInfo({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/[.06] bg-white/[.025] p-2 text-center"><small className="block text-[6px] text-slate-500">{label}</small><strong className="mt-1 block truncate text-[7.5px] text-slate-100">{value}</strong></div>;
}

function lineupPositions(details: RankingClubDetails): FormationSlot[] {
  if (details.formation === 'custom' && details.customPositions.length === 11) return details.customPositions;
  if (details.formation && details.formation in formations) return formations[details.formation as BuiltInSquadFormation];
  return formations['4-3-3'];
}

function demoRankings(category: RankingCategory, period: RankingPeriod, mode: RankingMode): RankingEntry[] {
  const periodFactor = period === 'week' ? 1 : period === 'month' ? 3.4 : 9.7;
  const categoryFactor = category === 'fantasy' ? 1 : category === 'predictions' ? .47 : category === 'quiz' ? .62 : .02;
  return demoTeams.map((entry, index) => ({
    ...entry,
    score: mode === 'clubValue' ? 98_500 - index * 4_730 : Math.max(category === 'friends' ? 1 : 0, Math.round(entry.score * periodFactor * categoryFactor)),
    form: entry.form?.map(value => Math.max(category === 'friends' ? 1 : 0, Math.round(value * categoryFactor)))
  }));
}

function demoClubDetails(entry: RankingEntry): RankingClubDetails {
  const seed = demoTeams.find(team => team.userId === entry.userId) ?? demoTeams[0];
  const formation = seed.formation && seed.formation in formations ? seed.formation as BuiltInSquadFormation : '4-3-3';
  const slots = formations[formation];
  const starters = seed.players.map((name, index): RankingClubPlayer => ({
    _id: `${seed.userId}-player-${index}`,
    name,
    position: slots[index]?.role ?? 'MID',
    club: seed.clubName,
    nationality: demoNationality(index),
    marketValue: 1_480 - index * 47,
    fantasyPoints: [6, 5, 7, 6, 5, 8, 9, 7, 8, 13, 10][index] ?? 5
  }));
  const substitutes = seed.substitutes.map((name, index): RankingClubPlayer => ({
    _id: `${seed.userId}-sub-${index}`,
    name,
    position: ['GK', 'DEF', 'MID', 'FWD', 'MID'][index],
    club: seed.clubName,
    nationality: demoNationality(index + 3),
    marketValue: 780 - index * 55,
    fantasyPoints: [3, 4, 5, 6, 4][index]
  }));
  const captainId = starters[seed.captainIndex]?._id;
  const totalFantasyPoints = starters.reduce((total, player) => total + player.fantasyPoints * (player._id === captainId ? 2 : 1), 0);
  const now = Date.now();
  return {
    userId: entry.userId,
    logoUrl: entry.logoUrl,
    formation,
    starters,
    substitutes,
    captainId,
    viceCaptainId: starters[seed.viceCaptainIndex]?._id,
    customPositions: [],
    totalSquadValue: [...starters, ...substitutes].reduce((total, player) => total + (player.marketValue ?? 0), 0),
    totalFantasyPoints,
    recentWeeks: (entry.form ?? seed.form ?? []).slice(-5).map((points, index, values) => ({ startsAt: new Date(now - (values.length - 1 - index) * 7 * 24 * 60 * 60 * 1000).toISOString(), points }))
  };
}

function demoNationality(index: number): string {
  return ['England', 'Brazil', 'Portugal', 'France', 'Spain', 'Netherlands'][index % 6];
}

function positionLabel(position: string): string {
  const labels: Record<string, string> = { GK: 'دروازه‌بان', RB: 'دفاع راست', RWB: 'وینگ‌بک راست', CB: 'دفاع میانی', LB: 'دفاع چپ', LWB: 'وینگ‌بک چپ', DM: 'هافبک دفاعی', CM: 'هافبک میانی', AM: 'هافبک هجومی', RM: 'هافبک راست', LM: 'هافبک چپ', RW: 'وینگر راست', LW: 'وینگر چپ', ST: 'مهاجم', DEF: 'مدافع', MID: 'هافبک', FWD: 'مهاجم' };
  return labels[position] ?? position;
}

function formatWeek(value: string): string {
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' }).format(new Date(value));
}
