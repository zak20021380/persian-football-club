import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ban,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  LockKeyhole,
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

type RankingSystem = 'premier'|'fantasy';
type FantasyFilter = 'week'|'month'|'season'|'friends';
type RankingPeriod = 'week'|'month'|'season';
type AuxiliaryRanking = 'predictions'|'quiz';

interface PremierLeagueStanding {
  position: number;
  teamId: number;
  teamName: string;
  logoUrl?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Array<'W'|'D'|'L'>;
  note?: string;
}

interface PremierLeagueData {
  leagueName: string;
  season: number;
  source: 'api'|'development-mock';
  updatedAt: string;
  standings: PremierLeagueStanding[];
}

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
  type: 'fantasy'|'predictions'|'quiz';
  period: RankingPeriod;
  metric: 'points';
  leaders: RankingEntry[];
  current: RankingEntry;
}

interface FantasyEntry extends RankingEntry {
  gameweekPoints: number;
  seasonPoints: number;
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
  gameweekPoints: number;
  hasPlayed: boolean;
  availability: 'available'|'injured'|'suspended'|'unavailable';
  statusNote?: string;
}

interface RankingClubDetails {
  userId: string;
  formation?: string;
  starters: Array<RankingClubPlayer|null>;
  substitutes: RankingClubPlayer[];
  captainId?: string;
  viceCaptainId?: string;
  customPositions: FormationSlot[];
  totalSquadValue: number;
  totalFantasyPoints: number;
  gameweekPoints: number;
  gameweek: { startsAt: string; endsAt: string; playersPlayed: number; playersRemaining: number };
  transfersMade: number;
  transferCost: number;
  recentWeeks: Array<{ startsAt: string; points: number }>;
}

interface DemoFantasySeed {
  userId: string;
  clubName: string;
  ownerName: string;
  weekPoints: number;
  monthPoints: number;
  seasonPoints: number;
  rankChange: number;
  isCurrent: boolean;
  formation: string;
  players: string[];
}

const fantasyFilters: Array<{ value: FantasyFilter; label: string }> = [
  { value: 'week', label: 'این هفته' },
  { value: 'month', label: 'این ماه' },
  { value: 'season', label: 'کل فصل' },
  { value: 'friends', label: 'دوستان' }
];

const demoFantasySeeds: DemoFantasySeed[] = [
  { userId: 'demo-azarakhsh', clubName: 'آذرخش پارس', ownerName: 'آرش زمانی', weekPoints: 86, monthPoints: 274, seasonPoints: 1248, rankChange: 2, isCurrent: false, formation: '4-3-3', players: ['David Raya', 'William Saliba', 'Virgil van Dijk', 'Joško Gvardiol', 'Trent Alexander-Arnold', 'Declan Rice', 'Cole Palmer', 'Bukayo Saka', 'Mohamed Salah', 'Erling Haaland', 'Alexander Isak'] },
  { userId: 'demo-toufan', clubName: 'طوفان کاسپین', ownerName: 'نیما اکبری', weekPoints: 81, monthPoints: 261, seasonPoints: 1206, rankChange: -1, isCurrent: false, formation: '3-4-3', players: ['Alisson', 'Gabriel Magalhães', 'Rúben Dias', 'Pau Torres', 'Bruno Guimarães', 'Phil Foden', 'Martin Ødegaard', 'Son Heung-min', 'Ollie Watkins', 'Darwin Núñez', 'Anthony Gordon'] },
  { userId: 'demo-sitareh', clubName: 'ستاره‌های البرز', ownerName: 'سارا محمدی', weekPoints: 77, monthPoints: 249, seasonPoints: 1179, rankChange: 3, isCurrent: false, formation: '4-2-3-1', players: ['Ederson', 'Ben White', 'Micky van de Ven', 'Lisandro Martínez', 'Pedro Porro', 'Rodri', 'Alexis Mac Allister', 'Kevin De Bruyne', 'Luis Díaz', 'Cole Palmer', 'Kai Havertz'] },
  { userId: 'demo-shahin', clubName: 'شاهین آبی', ownerName: 'مهرداد کریمی', weekPoints: 72, monthPoints: 238, seasonPoints: 1141, rankChange: 0, isCurrent: false, formation: '4-4-2', players: ['Emiliano Martínez', 'Marc Cucurella', 'Ibrahima Konaté', 'Cristian Romero', 'Kyle Walker', 'Dominik Szoboszlai', 'Bernardo Silva', 'Bruno Fernandes', 'Gabriel Martinelli', 'Nicolas Jackson', 'Jean-Philippe Mateta'] },
  { userId: 'demo-laleh', clubName: 'لاله‌های سرخ', ownerName: 'کاربر توسعه', weekPoints: 69, monthPoints: 229, seasonPoints: 1098, rankChange: 1, isCurrent: true, formation: '4-3-3', players: ['Nick Pope', 'Jurrien Timber', 'Levi Colwill', 'John Stones', 'Diogo Dalot', 'Moisés Caicedo', 'James Maddison', 'Eberechi Eze', 'Cody Gakpo', 'Rasmus Højlund', 'Bryan Mbeumo'] },
  { userId: 'demo-persian', clubName: 'پرشین گالکسی', ownerName: 'پویا احمدی', weekPoints: 64, monthPoints: 215, seasonPoints: 1034, rankChange: -2, isCurrent: false, formation: '3-5-2', players: ['Jordan Pickford', 'Dan Burn', 'Ezri Konsa', 'Nathan Aké', 'Morgan Gibbs-White', 'Youri Tielemans', 'Mikel Merino', 'Dejan Kulusevski', 'Kaoru Mitoma', 'Yoane Wissa', 'Dominic Solanke'] }
];

export function RankingsPage() {
  const [system, setSystem] = useState<RankingSystem>('premier');
  const [filter, setFilter] = useState<FantasyFilter>('week');
  const [preview, setPreview] = useState<FantasyEntry|null>(null);
  const [auxiliary, setAuxiliary] = useState<AuxiliaryRanking|null>(null);
  const selectedPeriod: RankingPeriod = filter === 'friends' ? 'season' : filter;
  const scope = filter === 'friends' ? 'friends' : 'all';

  const standingsQuery = useQuery({
    queryKey: ['premierLeagueStandings'],
    queryFn: async () => (await api.get<PremierLeagueData>('/premier-league/standings')).data,
    enabled: system === 'premier',
    staleTime: 5 * 60_000
  });
  const selectedFantasy = useFantasyRanking(selectedPeriod, scope, system === 'fantasy');
  const weekFantasy = useFantasyRanking('week', scope, system === 'fantasy');
  const seasonFantasy = useFantasyRanking('season', scope, system === 'fantasy');
  const fantasyDemo = Boolean(import.meta.env.DEV && selectedFantasy.data && selectedFantasy.data.leaders.length === 0);
  const fantasyEntries = useMemo(
    () => fantasyDemo ? demoFantasyEntries(filter) : mergeFantasyRankings(selectedFantasy.data, weekFantasy.data, seasonFantasy.data),
    [fantasyDemo, filter, seasonFantasy.data, selectedFantasy.data, weekFantasy.data]
  );
  const fantasyError = selectedFantasy.error || weekFantasy.error || seasonFantasy.error;
  const fantasyLoading = selectedFantasy.isLoading || weekFantasy.isLoading || seasonFantasy.isLoading;

  const retryFantasy = () => {
    void Promise.all([selectedFantasy.refetch(), weekFantasy.refetch(), seasonFantasy.refetch()]);
  };

  return (
    <main className="ranking-page pb-12">
      <header className="ranking-leaderboard-hero safe-top relative isolate overflow-hidden px-4 pb-12 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-30"/>
        <div className="ranking-hero-light absolute inset-0"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10 rounded-xl"/>
            <div className="ranking-ffn-lockup" dir="ltr"><strong>FFN</strong><span>RANKINGS CENTRE</span></div>
          </div>
          <WalletShortcut/>
        </div>
        <div className="relative mt-6 max-w-[330px]">
          <span className="text-[7px] font-black tracking-[.2em] text-cyan-300" dir="ltr">TWO TABLES. TWO IDENTITIES.</span>
          <h1 className="mt-1.5 text-[24px] font-black leading-[1.4] tracking-tight">مرکز رتبه‌بندی FFN</h1>
          <p className="mt-2 max-w-[310px] text-[9px] font-medium leading-5 text-slate-400">جدول رسمی لیگ انگلیس و رقابت باشگاه‌های فانتزی کاربران، در دو فضای کاملاً مستقل.</p>
        </div>
      </header>

      <div className="relative -mt-7 px-3 min-[390px]:px-4">
        <SystemTabs value={system} onChange={setSystem}/>
      </div>

      <div className="mt-4 space-y-5 px-3 min-[390px]:px-4">
        {system === 'premier' ? (
          <PremierLeagueTable query={standingsQuery}/>
        ) : (
          <FantasyTable
            filter={filter}
            onFilter={setFilter}
            entries={fantasyEntries}
            demo={fantasyDemo}
            loading={fantasyLoading}
            error={fantasyError}
            onRetry={retryFantasy}
            onPreview={setPreview}
          />
        )}
        <AuxiliaryRankings value={auxiliary} onChange={setAuxiliary}/>
      </div>

      {preview && <SquadDetailsSheet entry={preview} period={selectedPeriod} demo={fantasyDemo} onClose={() => setPreview(null)}/>}
    </main>
  );
}

function useFantasyRanking(period: RankingPeriod, scope: 'all'|'friends', enabled: boolean) {
  return useQuery({
    queryKey: ['rankings', 'fantasy', period, scope],
    queryFn: async () => (await api.get<RankingData>('/rankings', { params: { type: 'fantasy', period, scope } })).data,
    enabled
  });
}

function SystemTabs({ value, onChange }: { value: RankingSystem; onChange: (value: RankingSystem) => void }) {
  const tabs: Array<{ value: RankingSystem; label: string; caption: string; icon: typeof Trophy }> = [
    { value: 'premier', label: 'جدول لیگ انگلیس', caption: 'باشگاه‌های واقعی', icon: Trophy },
    { value: 'fantasy', label: 'رتبه‌بندی فانتزی', caption: 'باشگاه‌های کاربران', icon: ShieldCheck }
  ];
  return (
    <div className="ranking-system-tabs grid grid-cols-2 gap-1.5 p-1.5" role="tablist" aria-label="سیستم رتبه‌بندی">
      {tabs.map(({ value: tab, label, caption, icon: Icon }) => {
        const active = value === tab;
        return (
          <button key={tab} type="button" role="tab" aria-selected={active} onClick={() => onChange(tab)} className={cn('ranking-system-tab min-w-0 rounded-[.95rem] px-1.5 py-2.5 transition active:scale-[.98]', active && 'is-active')}>
            <span className="flex items-center justify-center gap-1.5"><Icon size={14}/><strong className="truncate text-[8.5px] min-[360px]:text-[9.5px]">{label}</strong></span>
            <small className="mt-1 block text-[6px] text-slate-600">{caption}</small>
          </button>
        );
      })}
    </div>
  );
}

function PremierLeagueTable({ query }: { query: ReturnType<typeof useQuery<PremierLeagueData, Error>> }) {
  if (query.isLoading) return <TableLoading label="در حال دریافت جدول رسمی لیگ انگلیس"/>;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => query.refetch()}/>;
  if (!query.data?.standings.length) return <TableEmpty icon={<Trophy size={22}/>} title="جدول لیگ در دسترس نیست" description="هنوز ردیفی از منبع رسمی دریافت نشده است."/>;
  const { standings, season, source } = query.data;
  return (
    <section aria-labelledby="premier-table-title">
      <SectionHeader
        eyebrow="ENGLISH PREMIER LEAGUE"
        title="جدول لیگ انگلیس"
        subtitle={`فصل ${formatSeason(season)} · ${faNumber(standings.length)} باشگاه واقعی`}
        badge={source === 'api' ? 'LIVE API' : 'DEV MOCK'}
        badgeTone={source === 'api' ? 'live' : 'demo'}
      />
      {source === 'development-mock' && <DevelopmentNotice text="API فوتبال در دسترس نیست؛ این جدول نمونه فقط در محیط توسعه نمایش داده می‌شود."/>}
      <div className="ranking-table-shell mt-2 overflow-hidden rounded-[1.25rem] border border-white/[.075] p-1.5">
        <div className="px-2 pb-1.5 pt-1 text-[6px] font-bold text-slate-600" id="premier-table-title">رتبه · باشگاه · آمار فصل · فرم ۵ بازی اخیر</div>
        {standings.map(row => <PremierLeagueRow key={row.teamId} row={row}/>) }
      </div>
    </section>
  );
}

function PremierLeagueRow({ row }: { row: PremierLeagueStanding }) {
  return (
    <article className={cn('premier-standing-row rounded-[.95rem] px-2 py-2.5', row.position <= 4 && 'is-champions', row.position >= 18 && 'is-relegation')}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="ranking-position grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[9px] font-black">{faNumber(row.position)}</span>
        <ClubCrest name={row.teamName} logo={row.logoUrl} className="h-9 w-9 shrink-0 !overflow-visible !rounded-none"/>
        <span className="min-w-0 flex-1" dir="ltr"><strong className="block truncate text-left text-[9px] font-black text-slate-100 min-[360px]:text-[10px]">{row.teamName}</strong><small className="mt-0.5 block text-left text-[6px] text-slate-600">{row.goalsFor}:{row.goalsAgainst} GOALS</small></span>
        <span className="min-w-[34px] text-left"><strong className="block text-[15px] font-black text-cyan-200">{faNumber(row.points)}</strong><small className="block text-[5.5px] font-bold text-slate-600">امتیاز</small></span>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-center gap-1 border-t border-white/[.045] pt-2">
        <MiniStat label="بازی" value={row.played}/><MiniStat label="برد" value={row.won}/><MiniStat label="مساوی" value={row.drawn}/><MiniStat label="باخت" value={row.lost}/><MiniStat label="تفاضل" value={signed(row.goalDifference)}/>
        <StandingForm values={row.form}/>
      </div>
    </article>
  );
}

function FantasyTable({ filter, onFilter, entries, demo, loading, error, onRetry, onPreview }: { filter: FantasyFilter; onFilter: (value: FantasyFilter) => void; entries: FantasyEntry[]; demo: boolean; loading: boolean; error: Error|null; onRetry: () => void; onPreview: (entry: FantasyEntry) => void }) {
  return (
    <section aria-labelledby="fantasy-table-title">
      <SectionHeader eyebrow="FFN FANTASY LEAGUE" title="رتبه‌بندی فانتزی" subtitle="باشگاه‌های ساخته‌شده توسط کاربران FFN" badge={demo ? 'DEV MOCK' : undefined} badgeTone="demo"/>
      {demo && <DevelopmentNotice text="هنوز امتیاز واقعی ثبت نشده؛ باشگاه‌های نمونه فقط در محیط توسعه فعال‌اند."/>}
      <div className="fantasy-filter-tabs mt-3 grid grid-cols-4 gap-1 p-1" role="tablist" aria-label="بازه رتبه‌بندی فانتزی">
        {fantasyFilters.map(item => <button key={item.value} type="button" role="tab" aria-selected={filter === item.value} onClick={() => onFilter(item.value)} className={cn('min-h-9 min-w-0 rounded-lg px-0.5 text-[7px] font-black transition min-[360px]:text-[8px]', filter === item.value ? 'bg-cyan-300/[.13] text-cyan-200' : 'text-slate-600')}>{item.label}</button>)}
      </div>
      {loading ? <div className="mt-3"><TableLoading label="در حال دریافت رتبه‌بندی فانتزی"/></div> : error ? <div className="mt-3"><ErrorState message={error.message} onRetry={onRetry}/></div> : entries.length ? (
        <div className="ranking-table-shell mt-3 overflow-hidden rounded-[1.25rem] border border-white/[.075] p-1.5">
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1 text-[6px] font-bold text-slate-600" id="fantasy-table-title"><span>رتبه · باشگاه فانتزی · مدیر</span><span>هفته / فصل</span></div>
          {entries.map(entry => <FantasyRow key={entry.userId} entry={entry} onPreview={onPreview} demo={demo}/>) }
        </div>
      ) : <div className="mt-3"><TableEmpty icon={<Users size={22}/>} title={filter === 'friends' ? 'دوستی در جدول نیست' : 'هنوز امتیازی ثبت نشده'} description={filter === 'friends' ? 'پس از تأیید دعوت دوستان، باشگاه‌های فانتزی آن‌ها اینجا نمایش داده می‌شود.' : 'با ثبت ترکیب و دریافت امتیاز بازی‌ها، جدول ساخته می‌شود.'}/></div>}
    </section>
  );
}

function FantasyRow({ entry, onPreview, demo }: { entry: FantasyEntry; onPreview: (entry: FantasyEntry) => void; demo: boolean }) {
  const canOpen = demo || entry.playerCount > 0;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('ranking-position grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[9px] font-black', entry.rank <= 3 && 'is-podium')}>{faNumber(entry.rank)}</span>
        <FantasyCrest name={entry.clubName}/>
        <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-1"><strong className="truncate text-[9px] font-black text-slate-100 min-[360px]:text-[10px]">{entry.clubName}</strong>{entry.isCurrent && <i className="ranking-you-badge shrink-0 not-italic">تیم شما</i>}</span><small className="mt-0.5 block truncate text-[6.5px] text-slate-500">مدیر: {entry.ownerName}</small></span>
        <Movement value={entry.rankChange}/>
        {canOpen && <ChevronLeft size={13} className="shrink-0 text-slate-700"/>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-white/[.045] pt-2">
        <FantasyScore label="امتیاز این هفته" value={entry.gameweekPoints}/><FantasyScore label="مجموع فصل" value={entry.seasonPoints} season/>
      </div>
    </>
  );
  return canOpen ? <button type="button" onClick={() => onPreview(entry)} aria-label={`مشاهده ترکیب عمومی ${entry.clubName}`} className={cn('fantasy-ranking-row block w-full rounded-[.95rem] px-2 py-2.5 text-right transition active:scale-[.992]', entry.isCurrent && 'is-current')}>{content}</button> : <div className={cn('fantasy-ranking-row rounded-[.95rem] px-2 py-2.5', entry.isCurrent && 'is-current')}>{content}</div>;
}

function AuxiliaryRankings({ value, onChange }: { value: AuxiliaryRanking|null; onChange: (value: AuxiliaryRanking|null) => void }) {
  const query = useQuery({
    queryKey: ['rankings', value, 'season'],
    queryFn: async () => (await api.get<RankingData>('/rankings', { params: { type: value, period: 'season' } })).data,
    enabled: Boolean(value)
  });
  return (
    <aside className="auxiliary-rankings rounded-[1.25rem] border border-white/[.065] p-3" aria-label="رتبه‌بندی‌های پیش‌بینی و کوییز">
      <div><span className="text-[6px] font-black tracking-[.16em] text-fuchsia-300" dir="ltr">SEPARATE LEADERBOARDS</span><h2 className="mt-0.5 text-[11px] font-black">رتبه‌بندی‌های دیگر</h2><p className="mt-1 text-[7px] leading-4 text-slate-600">امتیاز پیش‌بینی و کوییز مستقل از لیگ و فانتزی محاسبه می‌شود.</p></div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <AuxButton icon={<Target size={14}/>} label="پیش‌بینی" active={value === 'predictions'} onClick={() => onChange(value === 'predictions' ? null : 'predictions')}/>
        <AuxButton icon={<BrainCircuit size={14}/>} label="کوییز" active={value === 'quiz'} onClick={() => onChange(value === 'quiz' ? null : 'quiz')}/>
      </div>
      {value && <div className="mt-2.5 border-t border-white/[.055] pt-2.5">{query.isLoading ? <div className="broadcast-skeleton h-20 rounded-xl"/> : query.error ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/> : query.data?.leaders.length ? <div className="space-y-1">{query.data.leaders.slice(0, 5).map(entry => <div key={entry.userId} className="flex min-h-9 items-center gap-2 rounded-lg bg-white/[.025] px-2"><span className="text-[8px] font-black text-fuchsia-200">{faNumber(entry.rank)}</span><span className="min-w-0 flex-1 truncate text-[7.5px] font-bold">{entry.ownerName}</span><strong className="text-[8px] text-cyan-200">{faNumber(entry.score)}</strong></div>)}</div> : <p className="py-4 text-center text-[8px] text-slate-600">هنوز امتیازی در این جدول ثبت نشده است.</p>}</div>}
    </aside>
  );
}

interface SelectedPublicPlayer { player: RankingClubPlayer; role: string; }

function SquadDetailsSheet({ entry, period, demo, onClose }: { entry: FantasyEntry; period: RankingPeriod; demo: boolean; onClose: () => void }) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPublicPlayer|null>(null);
  const isDemo = demo && entry.userId.startsWith('demo-');
  const query = useQuery({
    queryKey: ['rankingClubDetails', entry.userId, period],
    queryFn: async () => (await api.get<RankingClubDetails>(`/rankings/${entry.userId}`, { params: { period } })).data,
    enabled: !isDemo,
    retry: 1
  });
  const details = isDemo ? demoClubDetails(entry) : query.data;
  return (
    <PlayerModalFrame label={`ترکیب عمومی ${entry.clubName}`} onClose={onClose} swipeDisabled className="ranking-detail-sheet !h-[100dvh] !max-h-[100dvh] !rounded-none min-[520px]:!h-[96dvh] min-[520px]:!max-h-[96dvh] min-[520px]:!rounded-t-[2rem]">
      <div className="momentum-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-[max(18px,var(--safe-bottom))] min-[375px]:px-3.5">
        <PublicSquadIdentity entry={entry} details={details}/>
        {query.isLoading && !isDemo ? <DetailLoading/> : query.error ? <div className="mt-3"><ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/></div> : details ? <SquadContent details={details} onPlayer={setSelectedPlayer}/> : <TableEmpty icon={<Shirt size={22}/>} title="ترکیب عمومی در دسترس نیست" description="این مدیر هنوز ترکیب خود را کامل نکرده است."/>}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[6px] text-slate-600"><LockKeyhole size={9}/><span>نمای عمومی فقط‌خواندنی؛ امکان ویرایش این تیم وجود ندارد.</span></div>
        <button type="button" onClick={onClose} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-300 to-emerald-300 text-[9px] font-black text-[#07111f]">بازگشت به جدول<ArrowLeft size={14}/></button>
      </div>
      {selectedPlayer && <PublicPlayerDetails selection={selectedPlayer} onClose={() => setSelectedPlayer(null)}/>}
    </PlayerModalFrame>
  );
}

function PublicSquadIdentity({ entry, details }: { entry: FantasyEntry; details?: RankingClubDetails }) {
  return (
    <section className="ranking-squad-identity relative isolate overflow-hidden rounded-[1.25rem] border border-cyan-200/[.11] p-3">
      <div className="home-hero-grid absolute inset-0 opacity-20"/>
      <div className="ranking-stadium-light absolute inset-0"/>
      <div className="relative flex min-w-0 items-center gap-2.5">
        <FantasyCrest name={entry.clubName} large/>
        <div className="min-w-0 flex-1"><span className="flex items-center gap-1 text-[5.5px] font-black tracking-[.14em] text-cyan-300" dir="ltr"><LockKeyhole size={8}/>PUBLIC FANTASY SQUAD</span><h2 className="mt-1 truncate text-[14px] font-black min-[375px]:text-[16px]">{entry.clubName}</h2><p className="mt-0.5 truncate text-[7px] text-slate-500">مدیر: <strong className="font-bold text-slate-300">{entry.ownerName}</strong></p></div>
        <div className="ranking-identity-rank shrink-0 rounded-xl px-2 py-1.5 text-center"><small className="block text-[5.5px] text-slate-500">رتبه فعلی</small><strong className="mt-0.5 block text-[14px] font-black text-amber-300">#{faNumber(entry.rank)}</strong><Movement value={entry.rankChange}/></div>
      </div>
      <div className="relative mt-3 grid grid-cols-4 gap-1">
        <IdentityMetric label="امتیاز هفته" value={faNumber(details?.gameweekPoints ?? entry.gameweekPoints)} tone="cyan"/>
        <IdentityMetric label="مجموع فصل" value={faNumber(entry.seasonPoints)} tone="fuchsia"/>
        <IdentityMetric label="ارزش تیم" value={details ? compactValue(details.totalSquadValue) : '—'} tone="amber"/>
        <IdentityMetric label="آرایش" value={details?.formation || entry.formation || '—'} dir="ltr"/>
      </div>
    </section>
  );
}

function SquadContent({ details, onPlayer }: { details: RankingClubDetails; onPlayer: (selection: SelectedPublicPlayer) => void }) {
  const starters = details.starters.filter((player): player is RankingClubPlayer => Boolean(player));
  if (!starters.length) return <TableEmpty icon={<Shirt size={22}/>} title="ترکیب اصلی خالی است" description="آرایش ذخیره شده، اما هنوز بازیکنی در ترکیب اصلی قرار نگرفته است."/>;
  return (
    <div className="mt-3">
      <CaptaincyStrip details={details} onPlayer={onPlayer}/>
      <GameweekOverview details={details}/>
      <PublicFormationPitch details={details} onPlayer={onPlayer}/>
      <PublicBench details={details} onPlayer={onPlayer}/>
    </div>
  );
}

function CaptaincyStrip({ details, onPlayer }: { details: RankingClubDetails; onPlayer: (selection: SelectedPublicPlayer) => void }) {
  const players = [...details.starters.filter((player): player is RankingClubPlayer => Boolean(player)), ...details.substitutes];
  const captain = players.find(player => player._id === details.captainId);
  const vice = players.find(player => player._id === details.viceCaptainId);
  return <section className="grid grid-cols-2 gap-1.5"><CaptainIdentity type="C" label="کاپیتان" player={captain} onClick={() => captain && onPlayer({ player: captain, role: captain.position })}/><CaptainIdentity type="V" label="نایب‌کاپیتان" player={vice} onClick={() => vice && onPlayer({ player: vice, role: vice.position })}/></section>;
}

function CaptainIdentity({ type, label, player, onClick }: { type: 'C'|'V'; label: string; player?: RankingClubPlayer; onClick: () => void }) {
  return <button type="button" disabled={!player} onClick={onClick} className="ranking-captain-card flex min-h-12 min-w-0 items-center gap-2 rounded-xl px-2 text-right disabled:opacity-55"><span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[8px] font-black', type === 'C' ? 'bg-amber-300 text-[#161006]' : 'bg-slate-300 text-slate-900')}>{type}</span><span className="min-w-0"><small className="block text-[5.5px] text-slate-500">{label}</small><strong className="mt-0.5 block truncate text-[7px] text-slate-200" dir="ltr">{player ? shortPlayerName(player.name) : 'انتخاب نشده'}</strong></span></button>;
}

function GameweekOverview({ details }: { details: RankingClubDetails }) {
  return (
    <section className="ranking-gameweek-panel mt-2.5 rounded-[1rem] border border-white/[.06] p-2.5">
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[8px] font-black"><CalendarDays size={12} className="text-cyan-300"/>هفته جاری</span><span className="text-[6px] text-slate-500">{formatGameweek(details.gameweek.startsAt, details.gameweek.endsAt)}</span></div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        <OverviewMetric label="بازی کرده" value={details.gameweek.playersPlayed} tone="text-emerald-300"/>
        <OverviewMetric label="باقی‌مانده" value={details.gameweek.playersRemaining} tone="text-cyan-200"/>
        <OverviewMetric label="نقل‌وانتقال" value={details.transfersMade}/>
        <OverviewMetric label="هزینه انتقال" value={details.transferCost ? compactValue(details.transferCost) : '—'} tone="text-amber-200"/>
      </div>
    </section>
  );
}

function PublicFormationPitch({ details, onPlayer }: { details: RankingClubDetails; onPlayer: (selection: SelectedPublicPlayer) => void }) {
  const positions = publicLineupPositions(details);
  return (
    <section className="mt-3">
      <SquadSectionHead title="ترکیب اصلی" count={details.starters.filter(Boolean).length} trailing={details.formation || '4-3-3'}/>
      <div className="public-fantasy-pitch relative mt-2 overflow-hidden rounded-[1.35rem] border border-emerald-100/[.18]" dir="ltr" aria-label={`ترکیب اصلی با آرایش ${details.formation || '4-3-3'}`}>
        <div className="public-pitch-atmosphere absolute inset-0"/>
        <PitchMarkings/>
        {details.starters.map((player, index) => {
          const position = positions[index] ?? formations['4-3-3'][index];
          return player ? <PublicPitchPlayer key={player._id} player={player} position={position} captain={player._id === details.captainId} vice={player._id === details.viceCaptainId} onClick={() => onPlayer({ player, role: position.role })}/> : <span key={`empty-${index}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} className="public-empty-slot absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-dashed border-white/25 text-[5px] text-white/35">{position.role}</span>;
        })}
      </div>
    </section>
  );
}

function PitchMarkings() {
  return <div className="pointer-events-none absolute inset-2.5 rounded-[1rem] border border-white/[.23]"><span className="absolute inset-x-0 top-1/2 border-t border-white/[.2]"/><span className="absolute left-1/2 top-1/2 h-[20%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[.2]"/><span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35"/><span className="absolute left-1/2 top-0 h-[17%] w-[48%] -translate-x-1/2 border border-t-0 border-white/[.2]"/><span className="absolute bottom-0 left-1/2 h-[17%] w-[48%] -translate-x-1/2 border border-b-0 border-white/[.2]"/><span className="absolute left-1/2 top-0 h-[7%] w-[22%] -translate-x-1/2 border border-t-0 border-white/[.18]"/><span className="absolute bottom-0 left-1/2 h-[7%] w-[22%] -translate-x-1/2 border border-b-0 border-white/[.18]"/></div>;
}

function PublicPitchPlayer({ player, position, captain, vice, onClick }: { player: RankingClubPlayer; position: FormationSlot; captain: boolean; vice: boolean; onClick: () => void }) {
  const status = availabilityMeta(player.availability);
  const StatusIcon = status.icon;
  return (
    <button type="button" onClick={onClick} aria-label={`جزئیات ${player.name}، ${position.role}، ${player.gameweekPoints} امتیاز`} style={{ left: `${position.x}%`, top: `${position.y}%` }} className={cn('public-pitch-player absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center', player.availability !== 'available' && 'has-status')}>
      <span className="relative grid h-8 w-8 place-items-center overflow-visible rounded-full border border-white/25 bg-[#101a38] shadow-[0_7px_14px_rgba(0,0,0,.38)] min-[375px]:h-9 min-[375px]:w-9 min-[430px]:h-10 min-[430px]:w-10">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full rounded-full object-cover"/> : <UserRound size={15} className="text-cyan-100"/>}{(captain || vice) && <i className={cn('absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-black/25 text-[6px] font-black not-italic shadow-md', captain ? 'bg-amber-300 text-[#181006]' : 'bg-slate-200 text-slate-900')}>{captain ? 'C' : 'V'}</i>}{player.availability !== 'available' && <i className={cn('absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-black/20 not-italic', status.className)} title={status.label}><StatusIcon size={8}/></i>}</span>
      <strong className="mt-0.5 block w-full truncate rounded-md bg-[#061324]/90 px-1 py-0.5 text-[5.5px] font-black leading-3 text-white min-[375px]:text-[6px] min-[430px]:text-[6.5px]">{shortPlayerName(player.name)}</strong>
      <span className="mt-px flex items-center gap-0.5 rounded-full bg-black/45 px-1 py-0.5 text-[5px] font-bold text-cyan-50"><b className="text-cyan-300">{position.role}</b><i className="not-italic text-white/25">·</i>{faNumber(player.gameweekPoints)}</span>
    </button>
  );
}

function PublicBench({ details, onPlayer }: { details: RankingClubDetails; onPlayer: (selection: SelectedPublicPlayer) => void }) {
  return (
    <section className="mt-3">
      <SquadSectionHead title="نیمکت ذخیره" count={details.substitutes.length} trailing="BENCH"/>
      {details.substitutes.length ? <div className="public-bench mt-2 grid grid-cols-4 gap-1.5 rounded-[1.15rem] border border-white/[.065] p-2" dir="ltr">{details.substitutes.map((player, index) => <BenchPlayer key={player._id} player={player} order={index + 1} onClick={() => onPlayer({ player, role: player.position })}/>)}</div> : <div className="mt-2 rounded-xl border border-dashed border-white/[.07] py-5 text-center text-[7px] text-slate-600">بازیکن ذخیره‌ای ثبت نشده است.</div>}
    </section>
  );
}

function BenchPlayer({ player, order, onClick }: { player: RankingClubPlayer; order: number; onClick: () => void }) {
  const status = availabilityMeta(player.availability);
  const StatusIcon = status.icon;
  return <button type="button" onClick={onClick} aria-label={`ذخیره ${order}: ${player.name}`} className="public-bench-player relative min-w-0 rounded-xl border border-white/[.06] px-1 pb-1.5 pt-2 text-center"><i className="absolute left-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-white/[.08] px-0.5 text-[5px] font-black not-italic text-slate-300">{faNumber(order)}</i><span className="relative mx-auto grid h-8 w-8 place-items-center rounded-full border border-white/[.1] bg-white/[.04]">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full rounded-full object-cover"/> : <UserRound size={13} className="text-cyan-200"/>}{player.availability !== 'available' && <i className={cn('absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full not-italic', status.className)}><StatusIcon size={7}/></i>}</span><strong className="mt-1 block truncate text-[5.5px] text-slate-200">{shortPlayerName(player.name)}</strong><small className="mt-0.5 block truncate text-[5px] text-slate-600">{player.position} · {faNumber(player.gameweekPoints)}</small></button>;
}

function PublicPlayerDetails({ selection, onClose }: { selection: SelectedPublicPlayer; onClose: () => void }) {
  const { player, role } = selection;
  const status = availabilityMeta(player.availability);
  const StatusIcon = status.icon;
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-[#02040c]/80 px-2 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section className="public-player-modal safe-bottom relative w-full rounded-t-[1.5rem] border border-b-0 border-cyan-200/[.13] p-3.5" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`جزئیات ${player.name}`}>
        <button type="button" onClick={onClose} className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/[.055] text-slate-300" aria-label="بستن جزئیات"><ArrowLeft size={14}/></button>
        <div className="flex items-center gap-3" dir="ltr"><span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/[.1] bg-white/[.045]">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <UserRound size={25} className="text-cyan-200"/>}</span><span className="min-w-0"><small className="text-[5.5px] font-black tracking-[.16em] text-cyan-300">READ-ONLY PLAYER</small><h3 className="mt-1 truncate text-[13px] font-black text-white">{player.name}</h3><p className="mt-1 truncate text-[6.5px] text-slate-500">{player.club || 'باشگاه ثبت نشده'}</p><span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[6px] font-black', status.className)}><StatusIcon size={8}/>{status.label}</span></span></div>
        <div className="mt-3 grid grid-cols-4 gap-1"><PlayerMetric label="جایگاه" value={role}/><PlayerMetric label="پست" value={player.position}/><PlayerMetric label="امتیاز هفته" value={faNumber(player.gameweekPoints)}/><PlayerMetric label="امتیاز بازه" value={faNumber(player.fantasyPoints)}/></div>
        <div className="mt-2 grid grid-cols-2 gap-1.5"><PlayerInfoLine label="ارزش" value={player.marketValue === undefined ? 'ثبت نشده' : `${faNumber(player.marketValue)} سکه`}/><PlayerInfoLine label="ملیت" value={player.nationality || 'ثبت نشده'}/></div>
        {player.statusNote && <p className="mt-2 rounded-xl border border-amber-300/[.1] bg-amber-300/[.045] px-2.5 py-2 text-[6.5px] leading-4 text-amber-100/75">{player.statusNote}</p>}
        <button type="button" onClick={onClose} className="mt-3 min-h-10 w-full rounded-xl bg-white/[.065] text-[8px] font-black text-white">بستن</button>
      </section>
    </div>
  );
}

function IdentityMetric({ label, value, tone, dir }: { label: string; value: string; tone?: 'cyan'|'fuchsia'|'amber'; dir?: 'ltr'|'rtl' }) { return <div className="ranking-identity-metric min-w-0 rounded-lg px-1.5 py-2 text-center"><small className="block truncate text-[5px] text-slate-600">{label}</small><strong className={cn('mt-1 block truncate text-[7.5px] text-slate-200', tone === 'cyan' && 'text-cyan-200', tone === 'fuchsia' && 'text-fuchsia-200', tone === 'amber' && 'text-amber-200')} dir={dir}>{value}</strong></div>; }
function OverviewMetric({ label, value, tone }: { label: string; value: number|string; tone?: string }) { return <div className="min-w-0 text-center"><strong className={cn('block truncate text-[8px] text-slate-200', tone)}>{typeof value === 'number' ? faNumber(value) : value}</strong><small className="mt-0.5 block truncate text-[5px] text-slate-600">{label}</small></div>; }
function PlayerMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-white/[.035] p-2 text-center"><small className="block truncate text-[5px] text-slate-600">{label}</small><strong className="mt-1 block truncate text-[7px] text-slate-200" dir="ltr">{value}</strong></div>; }
function PlayerInfoLine({ label, value }: { label: string; value: string }) { return <div className="flex min-h-9 min-w-0 items-center justify-between gap-2 rounded-lg border border-white/[.05] px-2"><small className="text-[5.5px] text-slate-600">{label}</small><strong className="truncate text-[6.5px] text-slate-300">{value}</strong></div>; }

function SectionHeader({ eyebrow, title, subtitle, badge, badgeTone }: { eyebrow: string; title: string; subtitle: string; badge?: string; badgeTone?: 'live'|'demo' }) {
  return <div className="flex items-end justify-between gap-2"><div className="min-w-0"><span className="text-[6px] font-black tracking-[.16em] text-cyan-300" dir="ltr">{eyebrow}</span><h2 className="mt-0.5 text-[14px] font-black">{title}</h2><p className="mt-1 truncate text-[7px] text-slate-600">{subtitle}</p></div>{badge && <span className={cn('ranking-source-badge shrink-0', badgeTone === 'live' ? 'is-live' : 'is-demo')} dir="ltr">{badge}</span>}</div>;
}

function TableLoading({ label }: { label: string }) {
  return <div className="space-y-2" aria-label={label}><div className="broadcast-skeleton h-9 rounded-xl"/><div className="space-y-1 rounded-[1.25rem] border border-white/[.05] p-1.5">{[0,1,2,3,4,5].map(item => <div key={item} className="broadcast-skeleton h-[86px] rounded-xl"/>)}</div></div>;
}

function DetailLoading() { return <div className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-1.5"><div className="broadcast-skeleton h-12 rounded-xl"/><div className="broadcast-skeleton h-12 rounded-xl"/></div><div className="broadcast-skeleton h-[445px] rounded-[1.35rem]"/><div className="grid grid-cols-4 gap-1.5">{[0,1,2,3].map(item => <div key={item} className="broadcast-skeleton h-16 rounded-xl"/>)}</div></div>; }
function TableEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) { return <section className="ranking-empty-state mt-3 rounded-[1.4rem] border border-dashed border-white/[.1] px-5 py-9 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/[.08] text-cyan-300">{icon}</span><h2 className="mt-3 text-[11px] font-black">{title}</h2><p className="mx-auto mt-1.5 max-w-[250px] text-[8px] leading-4 text-slate-600">{description}</p></section>; }
function DevelopmentNotice({ text }: { text: string }) { return <div className="mt-2 flex items-start gap-2 rounded-xl border border-fuchsia-300/[.1] bg-fuchsia-300/[.045] px-2.5 py-2 text-[6.5px] leading-4 text-fuchsia-100/70"><Sparkles size={11} className="mt-0.5 shrink-0 text-fuchsia-300"/><span>{text}</span></div>; }
function MiniStat({ label, value }: { label: string; value: number|string }) { return <span className="min-w-0 text-center"><strong className="block truncate text-[8px] text-slate-300">{typeof value === 'number' ? faNumber(value) : value}</strong><small className="mt-0.5 block text-[5px] text-slate-600">{label}</small></span>; }
function StandingForm({ values }: { values: PremierLeagueStanding['form'] }) { return <span className="flex items-center gap-[2px]" dir="ltr" aria-label={`فرم اخیر ${values.join('، ')}`}>{values.length ? values.map((value, index) => <i key={`${value}-${index}`} className={cn('grid h-3.5 w-3.5 place-items-center rounded-full text-[5px] font-black not-italic', value === 'W' ? 'bg-emerald-300/15 text-emerald-300' : value === 'L' ? 'bg-rose-300/15 text-rose-300' : 'bg-slate-300/10 text-slate-400')}>{value}</i>) : <small className="text-[6px] text-slate-600">—</small>}</span>; }
function FantasyScore({ label, value, season }: { label: string; value: number; season?: boolean }) { return <span className={cn('flex min-h-9 items-center justify-between rounded-lg px-2', season ? 'bg-fuchsia-300/[.055]' : 'bg-cyan-300/[.055]')}><small className="text-[6px] text-slate-500">{label}</small><strong className={cn('text-[10px] font-black', season ? 'text-fuchsia-200' : 'text-cyan-200')}>{faNumber(value)}</strong></span>; }
function Movement({ value }: { value: number }) { const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus; return <span className={cn('flex shrink-0 items-center gap-0.5 text-[6px] font-black', value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-600')}><Icon size={8}/>{value ? faNumber(Math.abs(value)) : 'ثابت'}</span>; }
function FantasyCrest({ name, large = false }: { name: string; large?: boolean }) { const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join(''); return <span className={cn('fantasy-user-crest relative grid shrink-0 place-items-center rounded-xl font-black text-white', large ? 'mx-auto h-16 w-16 text-base' : 'h-9 w-9 text-[9px]')} aria-label={`نشان فانتزی ${name}`}>{initials}<ShieldCheck className="absolute -bottom-1 -left-1 rounded-full bg-[#0a1224] p-0.5 text-cyan-300" size={large ? 17 : 13}/></span>; }
function SquadSectionHead({ title, count, trailing }: { title: string; count: number; trailing?: string }) { return <div className="flex items-center justify-between gap-2"><div><span className="text-[5px] font-black tracking-[.15em] text-cyan-300" dir="ltr">{trailing}</span><h3 className="mt-0.5 text-[10px] font-black">{title}</h3></div><span className="rounded-full bg-white/[.04] px-2 py-1 text-[6px] text-slate-600">{faNumber(count)} بازیکن</span></div>; }
function AuxButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) { return <button type="button" aria-expanded={active} onClick={onClick} className={cn('flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-[8px] font-black transition', active ? 'border-fuchsia-300/20 bg-fuchsia-300/[.09] text-fuchsia-200' : 'border-white/[.055] bg-white/[.025] text-slate-500')}>{icon}{label}</button>; }

function mergeFantasyRankings(selected?: RankingData, week?: RankingData, season?: RankingData): FantasyEntry[] {
  if (!selected?.leaders.length) return [];
  const selectedEntries = entriesWithCurrent(selected);
  const weekScores = new Map(entriesWithCurrent(week).map(entry => [entry.userId, entry.score]));
  const seasonScores = new Map(entriesWithCurrent(season).map(entry => [entry.userId, entry.score]));
  return selectedEntries.map(entry => ({ ...entry, gameweekPoints: weekScores.get(entry.userId) ?? 0, seasonPoints: seasonScores.get(entry.userId) ?? 0 }));
}

function entriesWithCurrent(data?: RankingData): RankingEntry[] {
  if (!data) return [];
  if (!data.current || data.leaders.some(entry => entry.userId === data.current.userId)) return data.leaders;
  return [...data.leaders, data.current].sort((a, b) => a.rank - b.rank);
}

function demoFantasyEntries(filter: FantasyFilter): FantasyEntry[] {
  const seeds = filter === 'friends' ? demoFantasySeeds.slice(0, 5) : demoFantasySeeds;
  const metric = (seed: DemoFantasySeed) => filter === 'week' ? seed.weekPoints : filter === 'month' ? seed.monthPoints : seed.seasonPoints;
  return [...seeds].sort((a, b) => metric(b) - metric(a)).map((seed, index) => ({ userId: seed.userId, clubName: seed.clubName, ownerName: seed.ownerName, score: metric(seed), rank: index + 1, rankChange: seed.rankChange, isCurrent: seed.isCurrent, formation: seed.formation, playerCount: 11, gameweekPoints: seed.weekPoints, seasonPoints: seed.seasonPoints }));
}

function demoClubDetails(entry: FantasyEntry): RankingClubDetails {
  const seed = demoFantasySeeds.find(item => item.userId === entry.userId) ?? demoFantasySeeds[0];
  const gameweekScores = [5, 6, 7, 5, 6, 8, 9, 7, 12, 10, 8];
  const players = seed.players.map((name, index): RankingClubPlayer => ({
    _id: `${seed.userId}-${index}`,
    name,
    position: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 8 ? 'MID' : 'FWD',
    club: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'][index % 4],
    nationality: ['England', 'Spain', 'Brazil', 'France', 'Portugal'][index % 5],
    marketValue: 7_500 - index * 280,
    fantasyPoints: gameweekScores[index] * 4,
    gameweekPoints: gameweekScores[index],
    hasPlayed: index < 7,
    availability: index === 3 ? 'injured' : index === 9 ? 'suspended' : 'available',
    statusNote: index === 3 ? 'مصدومیت جزئی؛ وضعیت حضور در بازی بعدی نامشخص است.' : index === 9 ? 'یک جلسه محرومیت' : undefined
  }));
  const substituteNames = ['Jordan Pickford', 'Ben White', 'Bruno Fernandes', 'Ollie Watkins'];
  const substitutes = substituteNames.map((name, index): RankingClubPlayer => ({
    _id: `${seed.userId}-sub-${index}`,
    name,
    position: index === 0 ? 'GK' : index === 1 ? 'DEF' : index === 2 ? 'MID' : 'FWD',
    club: ['Everton', 'Arsenal', 'Manchester United', 'Aston Villa'][index],
    nationality: 'England',
    marketValue: 4_200 - index * 350,
    fantasyPoints: [4, 5, 6, 7][index] * 4,
    gameweekPoints: [4, 5, 6, 7][index],
    hasPlayed: index < 2,
    availability: 'available'
  }));
  const now = Date.now();
  return {
    userId: seed.userId,
    formation: seed.formation,
    starters: players,
    substitutes,
    captainId: players[8]?._id,
    viceCaptainId: players[6]?._id,
    customPositions: [],
    totalSquadValue: [...players, ...substitutes].reduce((sum, player) => sum + (player.marketValue ?? 0), 0),
    totalFantasyPoints: entry.score,
    gameweekPoints: entry.gameweekPoints,
    gameweek: { startsAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), endsAt: new Date(now + 4 * 24 * 60 * 60 * 1000).toISOString(), playersPlayed: 7, playersRemaining: 4 },
    transfersMade: 2,
    transferCost: 8,
    recentWeeks: []
  };
}

function publicLineupPositions(details: RankingClubDetails): FormationSlot[] {
  if (details.formation === 'custom' && details.customPositions.length === 11) return details.customPositions;
  if (details.formation && details.formation in formations) return formations[details.formation as BuiltInSquadFormation];
  return formations['4-3-3'];
}

function availabilityMeta(status: RankingClubPlayer['availability']): { label: string; className: string; icon: typeof AlertTriangle } {
  if (status === 'injured') return { label: 'مصدوم', className: 'bg-rose-400 text-white', icon: AlertTriangle };
  if (status === 'suspended') return { label: 'محروم', className: 'bg-amber-300 text-slate-950', icon: Ban };
  if (status === 'unavailable') return { label: 'غیرفعال', className: 'bg-slate-400 text-slate-950', icon: Ban };
  return { label: 'آماده', className: 'bg-emerald-300/15 text-emerald-200', icon: ShieldCheck };
}

function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function compactValue(value: number): string {
  if (!value) return '—';
  return new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatGameweek(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' });
  return `${formatter.format(new Date(startsAt))} تا ${formatter.format(new Date(endsAt))}`;
}

function signed(value: number): string { return value > 0 ? `+${faNumber(value)}` : faNumber(value); }
function formatSeason(season: number): string { return `${faNumber(season)}–${faNumber((season + 1) % 100).padStart(2, '۰')}`; }
