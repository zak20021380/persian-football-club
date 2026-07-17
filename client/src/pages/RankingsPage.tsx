import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { isDemoDataEnabled } from '@/lib/featureFlags';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeDollarSign,
  Ban,
  BrainCircuit,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  HandCoins,
  Hash,
  LoaderCircle,
  LockKeyhole,
  Minus,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  WalletCards
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { FormationPitch, FormationPitchEmptySlot, FormationPitchPlayer } from '@/components/FormationPitch';
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
  source: 'api'|'demo';
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
  overall?: number;
  shirtNumber?: number;
  contractStatus?: string;
  contractEndsAt?: string;
  fantasyPoints: number;
  gameweekPoints: number;
  hasPlayed: boolean;
  availability: 'available'|'injured'|'suspended'|'unavailable';
  statusNote?: string;
  inStartingLineup: boolean;
  transfer: {
    ownedByCurrentUser: boolean;
    listingStatus: 'active'|'negotiable'|'not-listed'|'expired'|'sold'|'paused';
    askingPrice?: number;
    offerAmount?: number;
    listingExpiresAt?: string;
    activeOfferCount: number;
    hasActiveOfferFromCurrentUser: boolean;
    currentUserBalance: number;
    canBuy: boolean;
    buyDisabledReason?: string;
    canSwap: boolean;
    swapDisabledReason?: string;
  };
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
  const fantasyDemo = Boolean(isDemoDataEnabled() && selectedFantasy.data && selectedFantasy.data.leaders.length === 0);
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
        badge={source === 'api' ? 'LIVE API' : 'DEMO DATA'}
        badgeTone={source === 'api' ? 'live' : 'demo'}
      />
      {source === 'demo' && <DevelopmentNotice text="تا زمان فعال‌شدن منبع رسمی، جدول نمونه نمایش داده می‌شود."/>}
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
      <SectionHeader eyebrow="FFN FANTASY LEAGUE" title="رتبه‌بندی فانتزی" subtitle="باشگاه‌های ساخته‌شده توسط کاربران FFN" badge={demo ? 'DEMO DATA' : undefined} badgeTone="demo"/>
      {demo && <DevelopmentNotice text="تا زمان ثبت امتیازهای واقعی، باشگاه‌های نمونه نمایش داده می‌شوند."/>}
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
      <FormationPitch className="mt-2" aria-label={`ترکیب اصلی با آرایش ${details.formation || '4-3-3'}`}>
        {details.starters.map((player, index) => {
          const position = positions[index] ?? formations['4-3-3'][index];
          return player ? <PublicPitchPlayer key={player._id} player={player} position={position} captain={player._id === details.captainId} vice={player._id === details.viceCaptainId} onClick={() => onPlayer({ player, role: position.role })}/> : <FormationPitchEmptySlot key={`empty-${index}`} position={position} disabled aria-label={`جایگاه خالی ${position.role}`}/>;
        })}
      </FormationPitch>
    </section>
  );
}

function PublicPitchPlayer({ player, position, captain, vice, onClick }: { player: RankingClubPlayer; position: FormationSlot; captain: boolean; vice: boolean; onClick: () => void }) {
  const status = availabilityMeta(player.availability);
  const StatusIcon = status.icon;
  return <FormationPitchPlayer
    position={position}
    name={player.name}
    avatarUrl={player.photoUrl}
    primaryMeta={position.role}
    secondaryMeta={faNumber(player.gameweekPoints)}
    rightBadge={captain || vice ? { content: captain ? 'C' : 'V', className: captain ? 'bg-amber-300 text-[#181006]' : 'bg-slate-200 text-slate-900' } : undefined}
    leftBadge={player.availability !== 'available' ? { content: <StatusIcon size={8}/>, className: status.className, title: status.label } : undefined}
    onClick={onClick}
    aria-label={`جزئیات ${player.name}، ${position.role}، ${player.gameweekPoints} امتیاز`}
    className={player.availability !== 'available' ? 'has-status' : undefined}
  />;
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
  const queryClient = useQueryClient();
  const [successfulAction, setSuccessfulAction] = useState<'buy'|'swap'|null>(null);
  const status = availabilityMeta(player.availability);
  const StatusIcon = status.icon;
  const contract = contractPresentation(player.contractEndsAt);
  const listing = transferStatusMeta(player.transfer.listingStatus);
  const actionMutation = useMutation({
    mutationFn: async (kind: 'buy'|'swap') => {
      if (player._id.startsWith('demo-')) {
        await new Promise(resolve => window.setTimeout(resolve, 450));
        return { demo: true, kind };
      }
      const amount = player.transfer.offerAmount;
      if (!amount) throw new Error('قیمت پایه بازیکن ثبت نشده است');
      return (await api.post('/club/offers', {
        playerId: player._id,
        amount,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        clientRequestId: crypto.randomUUID(),
        note: kind === 'buy' ? 'پیشنهاد خرید از نمای عمومی تیم' : 'پیشنهاد مذاکره از نمای عمومی تیم'
      })).data;
    },
    onSuccess: async (_data, kind) => {
      setSuccessfulAction(kind);
      toast.success(kind === 'buy' ? 'پیشنهاد خرید با موفقیت ارسال شد' : 'پیشنهاد معاوضه با موفقیت ارسال شد');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rankingClubDetails'] }),
        queryClient.invalidateQueries({ queryKey: ['transferMarket'] }),
        queryClient.invalidateQueries({ queryKey: ['tradeOffers'] })
      ]);
    },
    onError: error => toast.error((error as Error).message || 'ارسال پیشنهاد انجام نشد')
  });
  const actionLocked = actionMutation.isPending || successfulAction !== null;
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-[#01030a]/85 backdrop-blur-md" onClick={() => { if (!actionMutation.isPending) onClose(); }} role="presentation">
      <section className="public-player-modal safe-bottom relative flex max-h-[calc(100dvh-10px)] min-h-0 w-full flex-col overflow-hidden rounded-t-[1.65rem] border border-b-0 border-cyan-200/[.13] min-[520px]:mx-auto min-[520px]:max-w-xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`جزئیات ${player.name}`}>
        <header className="public-player-modal-head relative flex h-11 shrink-0 items-center justify-center border-b border-white/[.055] px-3">
          <span className="h-1 w-10 rounded-full bg-white/20"/>
          <span className="absolute right-3 text-[6px] font-black tracking-[.14em] text-cyan-300" dir="ltr">PLAYER PROFILE</span>
          <button type="button" disabled={actionMutation.isPending} onClick={onClose} className="absolute left-2 grid h-9 w-9 place-items-center rounded-full border border-white/[.055] bg-white/[.04] text-slate-300 transition active:scale-90 disabled:cursor-wait" aria-label="بستن جزئیات"><ArrowLeft size={14}/></button>
        </header>

        <div className="momentum-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5">
          <section className="public-player-hero relative overflow-hidden rounded-[1.25rem] border border-white/[.075] p-3">
            <div className="public-player-hero-glow pointer-events-none absolute inset-0"/>
            <div className="relative flex min-w-0 items-center gap-3">
              <span className="public-player-photo relative grid h-[76px] w-[70px] shrink-0 place-items-center overflow-hidden rounded-[1.15rem] border border-cyan-100/[.15] bg-[#111a34]">
                {player.photoUrl ? <img src={player.photoUrl} alt={`تصویر ${player.name}`} className="h-full w-full object-cover"/> : <UserRound size={29} className="text-cyan-200"/>}
                <i className="absolute bottom-1 right-1 grid h-5 min-w-5 place-items-center rounded-md border border-white/10 bg-[#07111f]/90 px-1 text-[7px] font-black not-italic text-white">#{player.shirtNumber ? faNumber(player.shirtNumber) : '—'}</i>
              </span>
              <div className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5"><strong className="truncate text-[14px] font-black text-white min-[375px]:text-[16px]" dir="auto">{player.name}</strong><span className="shrink-0 rounded-md bg-cyan-300/[.1] px-1.5 py-1 text-[6px] font-black text-cyan-200" dir="ltr">{player.position}</span></span>
                <p className="mt-1.5 flex min-w-0 items-center gap-1.5 truncate text-[7px] text-slate-400"><Building2 size={10} className="shrink-0 text-fuchsia-300"/>{player.club || 'باشگاه ثبت نشده'}<span className="text-white/15">•</span><span>{positionLabel(player.position)}</span></p>
                <p className="mt-1 flex items-center gap-1.5 text-[6.5px] text-slate-500"><Hash size={9}/><span>شماره پیراهن {player.shirtNumber ? faNumber(player.shirtNumber) : 'ثبت نشده'}</span></p>
              </div>
            </div>
            <div className="relative mt-2.5 flex flex-wrap gap-1.5" aria-label="وضعیت بازیکن">
              <PlayerStatusChip icon={<StatusIcon size={8}/>} label={status.label} className={status.className}/>
              <PlayerStatusChip icon={<BadgeDollarSign size={8}/>} label={listing.label} className={listing.className}/>
              {player.inStartingLineup && <PlayerStatusChip icon={<Shirt size={8}/>} label="در ترکیب" className="border-cyan-300/20 bg-cyan-300/[.08] text-cyan-200"/>}
              {player.transfer.activeOfferCount > 0 && <PlayerStatusChip icon={<HandCoins size={8}/>} label={`${faNumber(player.transfer.activeOfferCount)} پیشنهاد دارد`} className="border-fuchsia-300/20 bg-fuchsia-300/[.08] text-fuchsia-200"/>}
            </div>
          </section>

          <section className="mt-2 grid grid-cols-2 gap-1.5" aria-label="مشخصات بازیکن">
            <PlayerModalInfo icon={<Shirt size={12}/>} label="پست و جایگاه" value={`${positionLabel(player.position)} · ${role}`}/>
            <PlayerModalInfo icon={<Building2 size={12}/>} label="باشگاه" value={player.club || 'ثبت نشده'}/>
            <PlayerModalInfo icon={<Hash size={12}/>} label="شماره پیراهن" value={player.shirtNumber ? faNumber(player.shirtNumber) : 'ثبت نشده'}/>
            <PlayerModalInfo icon={<ShieldCheck size={12}/>} label="وضعیت قرارداد" value={player.contractStatus || status.label}/>
          </section>

          <section className={cn('public-contract-card mt-2 rounded-[1.15rem] border p-2.5', contract.alert ? 'is-alert' : 'border-white/[.065]')} aria-label="اطلاعات قرارداد">
            <div className="flex items-center gap-2"><span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', contract.alert ? 'bg-amber-300/[.12] text-amber-200' : 'bg-cyan-300/[.08] text-cyan-200')}><CalendarClock size={15}/></span><span className="min-w-0 flex-1"><small className="block text-[6px] text-slate-500">پایان قرارداد</small><strong className="mt-0.5 block truncate text-[8px] text-slate-200">{contract.date}</strong></span><span className={cn('shrink-0 rounded-lg px-2 py-1.5 text-[6.5px] font-black', contract.alert ? 'bg-amber-300/[.12] text-amber-100' : 'bg-white/[.04] text-slate-400')}><Clock3 size={9} className="ml-1 inline"/>{contract.remaining}</span></div>
            {contract.alert && <p className="mt-2 flex items-start gap-1.5 border-t border-amber-200/[.09] pt-2 text-[6.5px] leading-4 text-amber-100/80"><AlertTriangle size={10} className="mt-0.5 shrink-0"/>{contract.expired ? 'قرارداد این بازیکن پایان یافته و وضعیت انتقال باید بررسی شود.' : 'قرارداد این بازیکن رو به پایان است.'}</p>}
          </section>

          <section className="public-player-value mt-2 grid grid-cols-2 gap-1.5 rounded-[1.15rem] border border-amber-200/[.1] p-2.5">
            <span className="min-w-0"><small className="flex items-center gap-1 text-[6px] text-slate-500"><BadgeDollarSign size={10} className="text-amber-300"/>قیمت / ارزش بازیکن</small><strong className="mt-1 block truncate text-[10px] font-black text-amber-200">{formatPlayerCoins(player.transfer.askingPrice ?? player.marketValue)}</strong></span>
            <span className="min-w-0 border-r border-white/[.06] pr-2"><small className="flex items-center gap-1 text-[6px] text-slate-500"><WalletCards size={10} className="text-cyan-300"/>موجودی شما</small><strong className="mt-1 block truncate text-[10px] font-black text-cyan-200">{formatPlayerCoins(player.transfer.currentUserBalance)}</strong></span>
          </section>

          <section className="mt-2 grid grid-cols-4 gap-1" aria-label="آمار مهم بازیکن">
            <PlayerModalStat label="امتیاز فنی" value={player.overall === undefined ? '—' : faNumber(player.overall)}/>
            <PlayerModalStat label="امتیاز هفته" value={faNumber(player.gameweekPoints)} tone="cyan"/>
            <PlayerModalStat label="امتیاز بازه" value={faNumber(player.fantasyPoints)} tone="fuchsia"/>
            <PlayerModalStat label="وضعیت بازی" value={player.hasPlayed ? 'بازی کرده' : 'باقی‌مانده'} tone={player.hasPlayed ? 'green' : undefined}/>
          </section>

          {player.statusNote && <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-300/[.11] bg-amber-300/[.045] px-2.5 py-2 text-[6.5px] leading-4 text-amber-100/80"><AlertTriangle size={10} className="mt-0.5 shrink-0"/>{player.statusNote}</p>}
        </div>

        <footer className="public-player-actions shrink-0 border-t border-white/[.07] p-2.5 pb-[max(10px,var(--safe-bottom))]">
          {successfulAction && <div className="mb-2 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/[.15] bg-emerald-300/[.07] px-2 py-2 text-[7px] font-black text-emerald-200"><CheckCircle2 size={11}/>{successfulAction === 'buy' ? 'پیشنهاد خرید ارسال شد' : 'پیشنهاد معاوضه ارسال شد'}</div>}
          <div className="grid grid-cols-2 gap-2">
            <PlayerActionButton label="خرید بازیکن" icon={<ShoppingCart size={13}/>} tone="buy" enabled={player.transfer.canBuy && !actionLocked} loading={actionMutation.isPending && actionMutation.variables === 'buy'} success={successfulAction === 'buy'} reason={successfulAction === 'buy' ? undefined : successfulAction ? 'تا تعیین وضعیت پیشنهاد فعلی غیرفعال است.' : player.transfer.buyDisabledReason} onClick={() => actionMutation.mutate('buy')}/>
            <PlayerActionButton label="پیشنهاد معاوضه" icon={<HandCoins size={13}/>} tone="swap" enabled={player.transfer.canSwap && !actionLocked} loading={actionMutation.isPending && actionMutation.variables === 'swap'} success={successfulAction === 'swap'} reason={successfulAction === 'swap' ? undefined : successfulAction ? 'تا تعیین وضعیت پیشنهاد فعلی غیرفعال است.' : player.transfer.swapDisabledReason} onClick={() => actionMutation.mutate('swap')}/>
          </div>
        </footer>
      </section>
    </div>
  );
}

function PlayerStatusChip({ icon, label, className }: { icon: ReactNode; label: string; className: string }) { return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[6px] font-black', className)}>{icon}{label}</span>; }
function PlayerModalInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="public-player-info flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-white/[.055] px-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.035] text-cyan-300">{icon}</span><span className="min-w-0"><small className="block text-[5.5px] text-slate-600">{label}</small><strong className="mt-0.5 block truncate text-[6.5px] text-slate-300">{value}</strong></span></div>; }
function PlayerModalStat({ label, value, tone }: { label: string; value: string; tone?: 'cyan'|'fuchsia'|'green' }) { return <div className="public-player-stat min-w-0 rounded-xl px-1 py-2 text-center"><strong className={cn('block truncate text-[7.5px] text-slate-200', tone === 'cyan' && 'text-cyan-200', tone === 'fuchsia' && 'text-fuchsia-200', tone === 'green' && 'text-emerald-200')}>{value}</strong><small className="mt-1 block truncate text-[5px] text-slate-600">{label}</small></div>; }
function PlayerActionButton({ label, icon, tone, enabled, loading, success, reason, onClick }: { label: string; icon: ReactNode; tone: 'buy'|'swap'; enabled: boolean; loading: boolean; success: boolean; reason?: string; onClick: () => void }) { return <div className="min-w-0"><button type="button" disabled={!enabled || loading || success} onClick={onClick} className={cn('public-player-action-button flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border text-[7.5px] font-black transition active:scale-[.98]', tone === 'buy' ? 'is-buy' : 'is-swap', (!enabled || success) && 'is-disabled', success && 'is-success')} aria-describedby={!enabled && reason ? `${tone}-disabled-reason` : undefined}>{loading ? <LoaderCircle size={13} className="animate-spin"/> : success ? <CheckCircle2 size={13}/> : icon}{loading ? 'در حال ارسال…' : success ? 'ارسال شد' : label}</button>{!enabled && reason && <p id={`${tone}-disabled-reason`} className="mt-1.5 min-h-6 px-1 text-center text-[5.5px] leading-3 text-rose-200/75">{reason}</p>}</div>; }

function IdentityMetric({ label, value, tone, dir }: { label: string; value: string; tone?: 'cyan'|'fuchsia'|'amber'; dir?: 'ltr'|'rtl' }) { return <div className="ranking-identity-metric min-w-0 rounded-lg px-1.5 py-2 text-center"><small className="block truncate text-[5px] text-slate-600">{label}</small><strong className={cn('mt-1 block truncate text-[7.5px] text-slate-200', tone === 'cyan' && 'text-cyan-200', tone === 'fuchsia' && 'text-fuchsia-200', tone === 'amber' && 'text-amber-200')} dir={dir}>{value}</strong></div>; }
function OverviewMetric({ label, value, tone }: { label: string; value: number|string; tone?: string }) { return <div className="min-w-0 text-center"><strong className={cn('block truncate text-[8px] text-slate-200', tone)}>{typeof value === 'number' ? faNumber(value) : value}</strong><small className="mt-0.5 block truncate text-[5px] text-slate-600">{label}</small></div>; }

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
  const now = Date.now();
  const gameweekScores = [5, 6, 7, 5, 6, 8, 9, 7, 12, 10, 8];
  const currentBalance = 9_000;
  const demoTransfer = (index: number, marketValue: number): RankingClubPlayer['transfer'] => {
    const owned = seed.isCurrent;
    const mode = index % 4;
    const listingStatus = mode === 0 || mode === 3 ? 'active' : mode === 1 ? 'negotiable' : 'not-listed';
    const hasOffer = mode === 3;
    const offerAmount = marketValue + 450;
    const ownedReason = 'این بازیکن متعلق به باشگاه شماست.';
    return {
      ownedByCurrentUser: owned,
      listingStatus,
      askingPrice: listingStatus === 'not-listed' ? undefined : offerAmount,
      offerAmount: listingStatus === 'not-listed' ? undefined : offerAmount,
      listingExpiresAt: listingStatus === 'not-listed' ? undefined : new Date(now + 36 * 60 * 60 * 1000).toISOString(),
      activeOfferCount: hasOffer ? 2 : mode === 0 ? 1 : 0,
      hasActiveOfferFromCurrentUser: hasOffer,
      currentUserBalance: currentBalance,
      canBuy: !owned && listingStatus === 'active' && !hasOffer && currentBalance >= offerAmount,
      buyDisabledReason: owned ? ownedReason : hasOffer ? 'برای این بازیکن یک پیشنهاد فعال دارید.' : listingStatus === 'negotiable' ? 'این بازیکن فقط با پیشنهاد قابل مذاکره است.' : listingStatus === 'not-listed' ? 'بازیکن برای فروش قرار نگرفته است.' : currentBalance < offerAmount ? 'موجودی شما برای این خرید کافی نیست.' : undefined,
      canSwap: !owned && listingStatus === 'negotiable' && !hasOffer && currentBalance >= offerAmount,
      swapDisabledReason: owned ? 'برای بازیکن خودتان نمی‌توانید پیشنهاد ثبت کنید.' : hasOffer ? 'برای این بازیکن یک پیشنهاد فعال دارید.' : listingStatus === 'active' ? 'این آگهی با قیمت ثابت ثبت شده است.' : listingStatus === 'not-listed' ? 'بازیکن قابل مذاکره نیست.' : currentBalance < offerAmount ? 'موجودی شما برای ثبت این پیشنهاد کافی نیست.' : undefined
    };
  };
  const players = seed.players.map((name, index): RankingClubPlayer => {
    const marketValue = 7_500 - index * 280;
    return {
      _id: `${seed.userId}-${index}`,
      name,
      position: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 8 ? 'MID' : 'FWD',
      club: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'][index % 4],
      nationality: ['England', 'Spain', 'Brazil', 'France', 'Portugal'][index % 5],
      marketValue,
      overall: 88 - (index % 7),
      shirtNumber: [1, 2, 4, 5, 3, 6, 8, 10, 11, 9, 7][index],
      contractStatus: index === 3 ? 'مصدوم' : index === 9 ? 'محروم' : 'فعال',
      contractEndsAt: new Date(now + (index === 0 ? 18 : index === 4 ? -3 : 90 + index * 19) * 24 * 60 * 60 * 1000).toISOString(),
      fantasyPoints: gameweekScores[index] * 4,
      gameweekPoints: gameweekScores[index],
      hasPlayed: index < 7,
      availability: index === 3 ? 'injured' : index === 9 ? 'suspended' : 'available',
      statusNote: index === 3 ? 'مصدومیت جزئی؛ وضعیت حضور در بازی بعدی نامشخص است.' : index === 9 ? 'یک جلسه محرومیت' : undefined,
      inStartingLineup: true,
      transfer: demoTransfer(index, marketValue)
    };
  });
  const substituteNames = ['Jordan Pickford', 'Ben White', 'Bruno Fernandes', 'Ollie Watkins'];
  const substitutes = substituteNames.map((name, index): RankingClubPlayer => {
    const marketValue = 4_200 - index * 350;
    return {
      _id: `${seed.userId}-sub-${index}`,
      name,
      position: index === 0 ? 'GK' : index === 1 ? 'DEF' : index === 2 ? 'MID' : 'FWD',
      club: ['Everton', 'Arsenal', 'Manchester United', 'Aston Villa'][index],
      nationality: 'England',
      marketValue,
      overall: 79 + index,
      shirtNumber: [13, 15, 18, 20][index],
      contractStatus: 'فعال',
      contractEndsAt: new Date(now + (150 + index * 30) * 24 * 60 * 60 * 1000).toISOString(),
      fantasyPoints: [4, 5, 6, 7][index] * 4,
      gameweekPoints: [4, 5, 6, 7][index],
      hasPlayed: index < 2,
      availability: 'available',
      inStartingLineup: false,
      transfer: demoTransfer(index + 11, marketValue)
    };
  });
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

function transferStatusMeta(status: RankingClubPlayer['transfer']['listingStatus']): { label: string; className: string } {
  if (status === 'active') return { label: 'قابل فروش', className: 'border-emerald-300/20 bg-emerald-300/[.08] text-emerald-200' };
  if (status === 'negotiable') return { label: 'قابل معاوضه', className: 'border-amber-300/20 bg-amber-300/[.08] text-amber-200' };
  if (status === 'sold') return { label: 'فروخته شده', className: 'border-slate-300/15 bg-slate-300/[.07] text-slate-300' };
  if (status === 'expired') return { label: 'آگهی منقضی', className: 'border-rose-300/20 bg-rose-300/[.08] text-rose-200' };
  if (status === 'paused') return { label: 'انتقال متوقف', className: 'border-slate-300/15 bg-slate-300/[.06] text-slate-400' };
  return { label: 'غیرقابل انتقال', className: 'border-slate-300/15 bg-slate-300/[.06] text-slate-400' };
}

function contractPresentation(value?: string): { date: string; remaining: string; alert: boolean; expired: boolean } {
  if (!value) return { date: 'ثبت نشده', remaining: 'نامشخص', alert: false, expired: false };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: 'ثبت نشده', remaining: 'نامشخص', alert: false, expired: false };
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const expired = days <= 0;
  const remaining = expired ? 'پایان یافته' : days < 60 ? `${faNumber(days)} روز` : `${faNumber(Math.floor(days / 30))} ماه`;
  return {
    date: new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }).format(date),
    remaining,
    alert: days <= 30,
    expired
  };
}

function positionLabel(position: string): string {
  const labels: Record<string, string> = { GK: 'دروازه‌بان', RB: 'دفاع راست', CB: 'مدافع میانی', LB: 'دفاع چپ', DM: 'هافبک دفاعی', CM: 'هافبک میانی', AM: 'هافبک هجومی', RW: 'وینگر راست', LW: 'وینگر چپ', ST: 'مهاجم', DEF: 'مدافع', MID: 'هافبک', FWD: 'مهاجم' };
  return labels[position] ?? position;
}

function formatPlayerCoins(value?: number): string {
  return value === undefined ? 'ثبت نشده' : `${faNumber(value)} سکه`;
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
