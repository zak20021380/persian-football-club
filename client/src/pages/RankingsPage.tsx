import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BrainCircuit,
  ChevronLeft,
  Minus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { WalletShortcut } from '@/components/WalletShortcut';
import { ErrorState } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';

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
  fantasyPoints: number;
}

interface RankingClubDetails {
  userId: string;
  formation?: string;
  starters: Array<RankingClubPlayer|null>;
  substitutes: RankingClubPlayer[];
  captainId?: string;
  viceCaptainId?: string;
  totalSquadValue: number;
  totalFantasyPoints: number;
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

function SquadDetailsSheet({ entry, period, demo, onClose }: { entry: FantasyEntry; period: RankingPeriod; demo: boolean; onClose: () => void }) {
  const isDemo = demo && entry.userId.startsWith('demo-');
  const query = useQuery({
    queryKey: ['rankingClubDetails', entry.userId, period],
    queryFn: async () => (await api.get<RankingClubDetails>(`/rankings/${entry.userId}`, { params: { period } })).data,
    enabled: !isDemo,
    retry: 1
  });
  const details = isDemo ? demoClubDetails(entry) : query.data;
  return (
    <PlayerModalFrame label={`ترکیب عمومی ${entry.clubName}`} onClose={onClose} className="ranking-detail-sheet !h-[96dvh] !max-h-[96dvh] min-[520px]:!rounded-t-[2rem]">
      <div className="momentum-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-[max(20px,var(--safe-bottom))] min-[390px]:px-4">
        <section className="ranking-squad-hero relative isolate overflow-hidden rounded-[1.35rem] border border-cyan-200/[.1] p-4 text-center">
          <div className="home-hero-grid absolute inset-0 opacity-20"/>
          <FantasyCrest name={entry.clubName} large/>
          <div className="relative mt-2"><span className="text-[6px] font-black tracking-[.18em] text-cyan-300" dir="ltr">PUBLIC FANTASY SQUAD</span><h2 className="mt-1 text-[17px] font-black">{entry.clubName}</h2><p className="mt-1 text-[7.5px] text-slate-500">مدیر: {entry.ownerName}</p></div>
          <div className="relative mt-3 grid grid-cols-3 gap-1.5"><SummaryStat label="رتبه" value={`#${faNumber(entry.rank)}`}/><SummaryStat label="هفته" value={faNumber(entry.gameweekPoints)}/><SummaryStat label="فصل" value={faNumber(entry.seasonPoints)}/></div>
        </section>
        {query.isLoading && !isDemo ? <DetailLoading/> : query.error ? <div className="mt-3"><ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/></div> : details ? <SquadContent details={details}/> : <TableEmpty icon={<Shirt size={22}/>} title="ترکیب عمومی در دسترس نیست" description="این مدیر هنوز ترکیب خود را کامل نکرده است."/>}
        <button type="button" onClick={onClose} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-300 to-emerald-300 text-[9px] font-black text-[#07111f]">بازگشت به جدول<ArrowLeft size={14}/></button>
      </div>
    </PlayerModalFrame>
  );
}

function SquadContent({ details }: { details: RankingClubDetails }) {
  const starters = details.starters.filter((player): player is RankingClubPlayer => Boolean(player));
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2"><SummaryStat label="آرایش" value={details.formation || 'ثبت نشده'}/><SummaryStat label="امتیاز بازه" value={faNumber(details.totalFantasyPoints)}/></div>
      <section><SquadSectionHead title="ترکیب اصلی" count={starters.length}/>{starters.length ? <div className="mt-2 grid grid-cols-2 gap-1.5">{starters.map(player => <SquadPlayer key={player._id} player={player} captain={player._id === details.captainId} vice={player._id === details.viceCaptainId}/>)}</div> : <p className="rounded-xl border border-dashed border-white/[.07] py-7 text-center text-[8px] text-slate-600">بازیکن اصلی ثبت نشده است.</p>}</section>
      <section><SquadSectionHead title="نیمکت" count={details.substitutes.length}/>{details.substitutes.length ? <div className="mt-2 grid grid-cols-2 gap-1.5">{details.substitutes.map(player => <SquadPlayer key={player._id} player={player}/>)}</div> : <p className="rounded-xl border border-dashed border-white/[.07] py-5 text-center text-[8px] text-slate-600">بازیکن ذخیره‌ای ثبت نشده است.</p>}</section>
    </div>
  );
}

function SquadPlayer({ player, captain, vice }: { player: RankingClubPlayer; captain?: boolean; vice?: boolean }) {
  return <div className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] px-2"><span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[.09] bg-white/[.045]">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <Shirt size={13} className="text-cyan-200"/>}{(captain || vice) && <i className="absolute left-0 top-0 grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-300 text-[5px] font-black not-italic text-slate-950">{captain ? 'C' : 'V'}</i>}</span><span className="min-w-0 flex-1" dir="ltr"><strong className="block truncate text-left text-[6.5px] text-slate-200">{player.name}</strong><small className="mt-0.5 block text-left text-[5.5px] text-slate-600">{player.position} · {faNumber(player.fantasyPoints)} PTS</small></span></div>;
}

function SectionHeader({ eyebrow, title, subtitle, badge, badgeTone }: { eyebrow: string; title: string; subtitle: string; badge?: string; badgeTone?: 'live'|'demo' }) {
  return <div className="flex items-end justify-between gap-2"><div className="min-w-0"><span className="text-[6px] font-black tracking-[.16em] text-cyan-300" dir="ltr">{eyebrow}</span><h2 className="mt-0.5 text-[14px] font-black">{title}</h2><p className="mt-1 truncate text-[7px] text-slate-600">{subtitle}</p></div>{badge && <span className={cn('ranking-source-badge shrink-0', badgeTone === 'live' ? 'is-live' : 'is-demo')} dir="ltr">{badge}</span>}</div>;
}

function TableLoading({ label }: { label: string }) {
  return <div className="space-y-2" aria-label={label}><div className="broadcast-skeleton h-9 rounded-xl"/><div className="space-y-1 rounded-[1.25rem] border border-white/[.05] p-1.5">{[0,1,2,3,4,5].map(item => <div key={item} className="broadcast-skeleton h-[86px] rounded-xl"/>)}</div></div>;
}

function DetailLoading() { return <div className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-2"><div className="broadcast-skeleton h-14 rounded-xl"/><div className="broadcast-skeleton h-14 rounded-xl"/></div><div className="broadcast-skeleton h-64 rounded-[1.25rem]"/></div>; }
function TableEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) { return <section className="ranking-empty-state mt-3 rounded-[1.4rem] border border-dashed border-white/[.1] px-5 py-9 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/[.08] text-cyan-300">{icon}</span><h2 className="mt-3 text-[11px] font-black">{title}</h2><p className="mx-auto mt-1.5 max-w-[250px] text-[8px] leading-4 text-slate-600">{description}</p></section>; }
function DevelopmentNotice({ text }: { text: string }) { return <div className="mt-2 flex items-start gap-2 rounded-xl border border-fuchsia-300/[.1] bg-fuchsia-300/[.045] px-2.5 py-2 text-[6.5px] leading-4 text-fuchsia-100/70"><Sparkles size={11} className="mt-0.5 shrink-0 text-fuchsia-300"/><span>{text}</span></div>; }
function MiniStat({ label, value }: { label: string; value: number|string }) { return <span className="min-w-0 text-center"><strong className="block truncate text-[8px] text-slate-300">{typeof value === 'number' ? faNumber(value) : value}</strong><small className="mt-0.5 block text-[5px] text-slate-600">{label}</small></span>; }
function StandingForm({ values }: { values: PremierLeagueStanding['form'] }) { return <span className="flex items-center gap-[2px]" dir="ltr" aria-label={`فرم اخیر ${values.join('، ')}`}>{values.length ? values.map((value, index) => <i key={`${value}-${index}`} className={cn('grid h-3.5 w-3.5 place-items-center rounded-full text-[5px] font-black not-italic', value === 'W' ? 'bg-emerald-300/15 text-emerald-300' : value === 'L' ? 'bg-rose-300/15 text-rose-300' : 'bg-slate-300/10 text-slate-400')}>{value}</i>) : <small className="text-[6px] text-slate-600">—</small>}</span>; }
function FantasyScore({ label, value, season }: { label: string; value: number; season?: boolean }) { return <span className={cn('flex min-h-9 items-center justify-between rounded-lg px-2', season ? 'bg-fuchsia-300/[.055]' : 'bg-cyan-300/[.055]')}><small className="text-[6px] text-slate-500">{label}</small><strong className={cn('text-[10px] font-black', season ? 'text-fuchsia-200' : 'text-cyan-200')}>{faNumber(value)}</strong></span>; }
function Movement({ value }: { value: number }) { const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus; return <span className={cn('flex shrink-0 items-center gap-0.5 text-[6px] font-black', value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-600')}><Icon size={8}/>{value ? faNumber(Math.abs(value)) : 'ثابت'}</span>; }
function FantasyCrest({ name, large = false }: { name: string; large?: boolean }) { const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join(''); return <span className={cn('fantasy-user-crest relative grid shrink-0 place-items-center rounded-xl font-black text-white', large ? 'mx-auto h-16 w-16 text-base' : 'h-9 w-9 text-[9px]')} aria-label={`نشان فانتزی ${name}`}>{initials}<ShieldCheck className="absolute -bottom-1 -left-1 rounded-full bg-[#0a1224] p-0.5 text-cyan-300" size={large ? 17 : 13}/></span>; }
function SummaryStat({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-white/[.06] bg-white/[.025] p-2 text-center"><small className="block text-[6px] text-slate-600">{label}</small><strong className="mt-1 block truncate text-[8px] text-slate-100">{value}</strong></div>; }
function SquadSectionHead({ title, count }: { title: string; count: number }) { return <div className="flex items-center justify-between"><h3 className="text-[10px] font-black">{title}</h3><span className="rounded-full bg-white/[.04] px-2 py-1 text-[6px] text-slate-600">{faNumber(count)} بازیکن</span></div>; }
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
  const players = seed.players.map((name, index): RankingClubPlayer => ({ _id: `${seed.userId}-${index}`, name, position: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 8 ? 'MID' : 'FWD', fantasyPoints: [5, 6, 7, 5, 6, 8, 9, 7, 12, 10, 8][index] }));
  return { userId: seed.userId, formation: seed.formation, starters: players, substitutes: [], captainId: players[8]?._id, viceCaptainId: players[6]?._id, totalSquadValue: 0, totalFantasyPoints: entry.score, recentWeeks: [] };
}

function signed(value: number): string { return value > 0 ? `+${faNumber(value)}` : faNumber(value); }
function formatSeason(season: number): string { return `${faNumber(season)}–${faNumber((season + 1) % 100).padStart(2, '۰')}`; }
