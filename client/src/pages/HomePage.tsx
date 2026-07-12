import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BellRing,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Coins,
  Flame,
  Gift,
  Handshake,
  Inbox,
  Medal,
  Play,
  Radio,
  Shield,
  Shirt,
  Sparkles,
  Tags,
  Target,
  Trophy,
  Zap
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { MatchCard } from '@/components/MatchCard';
import { WalletShortcut } from '@/components/WalletShortcut';
import { SponsorCard } from '@/components/SponsorCard';
import { Card, EmptyState, ErrorState, PageSkeleton, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber, remaining, tehranDate } from '@/lib/utils';
import type { HomeData, Match } from '@/types/api';

const quickActions = [
  { to: '/matches', label: 'پیش‌بینی', icon: Target, tone: 'bg-emerald-400/[.12] text-emerald-300' },
  { to: '/quiz', label: 'کوییز روز', icon: CircleHelp, tone: 'bg-violet-400/[.12] text-violet-300' },
  { to: '/rankings', label: 'رتبه‌بندی', icon: Trophy, tone: 'bg-amber-400/[.12] text-amber-300' },
  { to: '/rewards', label: 'جوایز', icon: Gift, tone: 'bg-sky-400/[.12] text-sky-300' }
];

function QuickActions({ predictionsCount }: { predictionsCount: number }) {
  return (
    <div className="home-quick-actions grid grid-cols-4 gap-1 rounded-[1.6rem] border border-white/[.08] bg-ink-900/95 p-2 shadow-2xl shadow-black/25 backdrop-blur-xl">
      {quickActions.map(({ to, label, icon: Icon, tone }, index) => (
        <Link key={to} to={to} className="group relative flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl transition active:scale-95 active:bg-white/[.04]">
          <span className={cn('grid h-10 w-10 place-items-center rounded-2xl transition group-active:scale-95', tone)}><Icon size={19}/></span>
          <span className="text-[10px] font-bold text-slate-300">{label}</span>
          {index === 0 && predictionsCount > 0 && <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-ink-900"/>}
        </Link>
      ))}
    </div>
  );
}

function HeroStat({ icon, label, value, primary = false }: { icon: ReactNode; label: string; value: string; primary?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-2xl border px-3 py-3', primary ? 'border-emerald-300/25 bg-emerald-400/[.13]' : 'border-white/[.08] bg-white/[.045]')}>
      <div className={cn('mb-2 flex items-center gap-1.5 text-[10px] font-medium', primary ? 'text-emerald-200' : 'text-slate-400')}>{icon}<span className="truncate">{label}</span></div>
      <strong className="block truncate text-base font-black text-white">{value}</strong>
    </div>
  );
}

function FeaturedMatch({ match }: { match: Match }) {
  const hasScore = match.status === 'finished' || match.status === 'live';
  return (
    <Link to={`/matches/${match._id}`} className="block">
      <article className="featured-match group overflow-hidden rounded-[1.75rem] border border-white/[.09] bg-ink-900/90 shadow-card transition active:scale-[.99]">
        <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><Trophy size={13}/></span>
            <span className="truncate text-[11px] font-bold text-slate-300">{match.competitionName}</span>
          </div>
          {match.status === 'live' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-400/10 px-2.5 py-1 text-[10px] font-black text-rose-300"><Radio size={11}/> زنده</span>
          ) : (
            <span className="rounded-full bg-white/[.05] px-2.5 py-1 text-[10px] font-bold text-slate-400">{tehranDate(match.kickoffAt)}</span>
          )}
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-6 sm:px-6">
          <div className="match-glow absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/[.07] blur-2xl"/>
          <div className="relative flex min-w-0 flex-col items-center gap-3 text-center">
            <ClubCrest name={match.homeTeam} logo={match.homeLogo} className="h-[68px] w-[60px] sm:h-[76px] sm:w-[68px]"/>
            <strong className="line-clamp-1 w-full text-xs sm:text-sm">{match.homeTeam}</strong>
          </div>
          <div className="relative flex min-w-[58px] flex-col items-center">
            {hasScore ? (
              <div className="whitespace-nowrap text-2xl font-black tracking-wider">{faNumber(match.homeScore ?? 0)} <span className="text-slate-600">–</span> {faNumber(match.awayScore ?? 0)}</div>
            ) : (
              <><span className="text-[9px] font-bold uppercase tracking-[.25em] text-slate-500">مسابقه</span><span className="my-1 text-lg font-black text-white">VS</span></>
            )}
          </div>
          <div className="relative flex min-w-0 flex-col items-center gap-3 text-center">
            <ClubCrest name={match.awayTeam} logo={match.awayLogo} className="h-[68px] w-[60px] sm:h-[76px] sm:w-[68px]"/>
            <strong className="line-clamp-1 w-full text-xs sm:text-sm">{match.awayTeam}</strong>
          </div>
        </div>

        {match.prediction && (
          <div className="mx-3 mb-3 flex min-h-11 items-center justify-between rounded-2xl bg-sky-400/[.09] px-3 text-[11px] font-bold text-sky-200 sm:mx-4 sm:px-4">
            <span className="flex items-center gap-2"><Target size={15}/> پیش‌بینی شما ثبت شده</span>
            <span className="flex items-center gap-1 text-white">مشاهده <ChevronLeft size={15}/></span>
          </div>
        )}
        {match.predictionOpen && !match.prediction && (
          <div className="mx-3 mb-3 flex min-h-11 items-center justify-between rounded-2xl bg-emerald-400/[.1] px-3 text-[11px] font-bold text-emerald-200 sm:mx-4 sm:px-4">
            <span className="flex items-center gap-2"><BellRing size={15}/> پیش‌بینی این بازی فعاله</span>
            <span className="flex items-center gap-1 text-white">ثبت پیش‌بینی <ChevronLeft size={15}/></span>
          </div>
        )}
      </article>
    </Link>
  );
}

const clubQuickActions = [
  { to: '/club/squad', label: 'ترکیب من', icon: Shirt, tone: 'text-emerald-300 bg-emerald-400/[.1]' },
  { to: '/club/transfer-market', label: 'بازار بازیکنان', icon: Tags, tone: 'text-sky-300 bg-sky-400/[.1]' },
  { to: '/club/trade-offers', label: 'پیشنهادها', icon: Handshake, tone: 'text-violet-300 bg-violet-400/[.1]' },
  { to: '/store', label: 'فروشگاه سکه', icon: Coins, tone: 'text-amber-300 bg-amber-300/[.1]' },
];

function MyClubCard({ club, coinBalance }: { club: HomeData['club']; coinBalance: number }) {
  if (!club) return <Card className="relative overflow-hidden border-emerald-300/[.12] bg-gradient-to-l from-emerald-400/[.07] to-transparent p-5 text-center">
    <Shield size={98} strokeWidth={1} className="absolute -left-5 -top-5 rotate-6 text-emerald-300/[.07]"/>
    <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-[1.15rem] bg-emerald-400/[.1] text-emerald-300"><Shield size={25}/></div>
    <h2 className="relative mt-3 text-sm font-black">باشگاه خودت را بساز، بازیکن بخر و ترکیب بچین</h2>
    <p className="relative mx-auto mt-1 max-w-xs text-[9px] leading-5 text-slate-500">تیم اختصاصی تو از همین‌جا شروع می‌شود.</p>
    <Link to="/club" className="btn-primary relative mt-4 min-h-10 px-6 py-2.5 text-[10px]">ساخت باشگاه<ArrowLeft size={15}/></Link>
  </Card>;

  return <Card className="relative overflow-hidden border-emerald-300/[.13] p-4">
    <div className="flex items-center gap-3">
      {club.logo ? <img src={club.logo} alt={club.name} className="h-12 w-12 shrink-0 rounded-2xl object-contain"/> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/[.1] text-emerald-300"><Shield size={23}/></span>}
      <div className="min-w-0 flex-1"><p className="text-[8px] font-bold text-emerald-300">باشگاه من</p><h2 className="mt-0.5 truncate text-sm font-black">{club.name}</h2></div>
      <Link to="/club" className="flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-emerald-400/[.1] px-2.5 text-[9px] font-black text-emerald-300">ورود به باشگاه<ArrowLeft size={13}/></Link>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-white/[.035] p-3"><span className="text-[8px] text-slate-500">ارزش کل ترکیب</span><strong className="mt-1 block truncate text-xs">{faNumber(club.squadValue)} سکه</strong></div>
      <div className="rounded-2xl bg-white/[.035] p-3"><span className="text-[8px] text-slate-500">آرایش فعلی</span><strong className="mt-1 block text-xs" dir="ltr">{club.formation}</strong></div>
    </div>
    <div className="mt-2 grid grid-cols-3 divide-x divide-x-reverse divide-white/[.06] rounded-2xl bg-white/[.025] py-2.5 text-center">
      <div><strong className="block text-xs text-amber-300">{faNumber(coinBalance)}</strong><span className="mt-1 block text-[7px] text-slate-500">موجودی سکه</span></div>
      <div><strong className="block text-xs">{faNumber(club.playerCount)}</strong><span className="mt-1 block text-[7px] text-slate-500">بازیکن</span></div>
      <div><strong className="block text-xs text-violet-300">{faNumber(club.newOfferCount)}</strong><span className="mt-1 block text-[7px] text-slate-500">پیشنهاد جدید</span></div>
    </div>
  </Card>;
}

function ClubQuickActions() {
  return <div className="grid grid-cols-4 gap-1.5">{clubQuickActions.map(({ to, label, icon: Icon, tone }) => <Link key={to} to={to} className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white/[.03] px-1 text-center transition active:scale-95 active:bg-white/[.06]"><span className={cn('grid h-9 w-9 place-items-center rounded-xl', tone)}><Icon size={17}/></span><span className="line-clamp-2 text-[8px] font-bold leading-4 text-slate-300">{label}</span></Link>)}</div>;
}

function TransferStatus({ status }: { status: HomeData['transferStatus'] }) {
  const items = [
    { label: 'آگهی فعال', value: status.activeListings, icon: Tags, tone: 'text-sky-300' },
    { label: 'پیشنهاد دریافتی', value: status.receivedOffers, icon: Inbox, tone: 'text-violet-300' },
    { label: 'رو به پایان', value: status.expiringOffers, icon: Clock3, tone: 'text-amber-300' },
  ];
  return <Card className="p-3"><div className="mb-2.5 flex items-center justify-between"><h2 className="text-[10px] font-black">وضعیت نقل‌وانتقالات</h2><Link to="/club/transactions" className="flex items-center gap-1 text-[8px] font-bold text-slate-500">جزئیات<ArrowLeft size={12}/></Link></div><div className="grid grid-cols-3 gap-1">{items.map(({ label, value, icon: Icon, tone }) => <div key={label} className="min-w-0 rounded-xl bg-white/[.025] px-2 py-2.5 text-center"><Icon size={14} className={cn('mx-auto', tone)}/><strong className="mt-1.5 block text-xs">{faNumber(value)}</strong><span className="mt-1 block truncate text-[7px] text-slate-500">{label}</span></div>)}</div></Card>;
}

function CompactCompetition({ competition }: { competition: HomeData['activeCompetition'] }) {
  if (!competition) return <Link to="/competition" className="flex min-h-[78px] items-center gap-3 rounded-[1.35rem] bg-white/[.025] p-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.04] text-slate-500"><Trophy size={18}/></span><div className="min-w-0 flex-1"><h2 className="text-xs font-black">رقابت فعالی نیست</h2><p className="mt-1 text-[8px] text-slate-500">مرکز رقابت را بررسی کن</p></div><ArrowLeft size={16} className="text-slate-600"/></Link>;
  return <Link to={`/competitions/${competition._id}`} className="home-cup-card flex min-h-[92px] items-center gap-3 overflow-hidden rounded-[1.4rem] bg-gradient-to-l from-emerald-400/[.08] to-white/[.02] p-3.5 transition active:scale-[.99]">
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/[.11] text-emerald-300"><Trophy size={21}/></span>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[8px] font-black text-emerald-300">رقابت فعال</span><span className="text-[7px] text-slate-600">{remaining(competition.endsAt)}</span></div><h2 className="mt-1 truncate text-xs font-black">{competition.title}</h2><p className="mt-1 text-[8px] text-slate-500">رتبه شما: <span className="font-bold text-slate-300">{competition.rank ? `#${faNumber(competition.rank)}` : 'بدون رتبه'}</span></p></div>
    <span className="flex shrink-0 items-center gap-1 text-[9px] font-black text-emerald-300">ادامه رقابت<ArrowLeft size={14}/></span>
  </Link>;
}

export function HomePage() {
  const query = useQuery({ queryKey: ['home'], queryFn: async () => (await api.get<HomeData>('/home')).data, refetchInterval: 60_000 });
  if (query.isLoading) return <PageSkeleton/>;
  if (query.error || !query.data) return <div className="p-4"><ErrorState message={(query.error as Error)?.message ?? 'اطلاعات خانه دریافت نشد'} onRetry={() => query.refetch()}/></div>;
  const data = query.data;
  const firstMatch = data.matches[0];

  return (
    <main className="home-page pb-5">
      <header className="home-hero safe-top relative overflow-hidden px-4 pb-11 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-50"/>
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/[.09] blur-3xl"/>
        <div className="absolute -right-32 top-16 h-72 w-72 rounded-full border border-emerald-300/[.08]"/>
        <div className="absolute -right-20 top-28 h-48 w-48 rounded-full border border-emerald-300/[.07]"/>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12"/>
            <div>
              <p className="text-[10px] font-bold tracking-wide text-emerald-300">باشگاه هواداران فوتبال</p>
              <p className="mt-0.5 text-sm font-black text-white">فوتبال کلاب</p>
            </div>
          </div>
          <div className="flex items-center gap-2"><WalletShortcut/><Link to="/profile" aria-label="پروفایل من" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[.06] text-sm font-black text-emerald-200 backdrop-blur">
            {data.user.firstName.slice(0, 1)}
            <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-ink-950 bg-emerald-400"/>
          </Link></div>
        </div>

        <div className="relative mt-7">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><Sparkles size={14} className="text-amber-300"/> سلام {data.user.firstName}، خوش اومدی</div>
          <h1 className="mt-2 max-w-sm text-[1.65rem] font-black leading-[1.45] tracking-tight text-white">بازی رو دنبال کن،<br/><span className="text-emerald-300">نتیجه رو پیش‌بینی کن.</span></h1>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2">
          <HeroStat primary icon={<Zap size={13}/>} label="امتیاز کل" value={faNumber(data.user.points)}/>
          <HeroStat icon={<Medal size={13}/>} label="رتبه هفته" value={`#${faNumber(data.user.weeklyRank)}`}/>
          <HeroStat icon={<Flame size={13}/>} label="استریک" value={`${faNumber(data.user.streak)} روز`}/>
        </div>
      </header>

      <div className="relative -mt-6 px-4"><QuickActions predictionsCount={data.predictionsCount}/></div>

      <div className="mt-7 space-y-8 px-4">
        <section>
          <SectionTitle title="بازی‌های مهم" action="همه بازی‌ها" to="/matches"/>
          {firstMatch ? (
            <div className="space-y-3">
              <FeaturedMatch match={firstMatch}/>
              {data.matches.slice(1, 3).map((match) => <MatchCard key={match._id} match={match}/>)}
            </div>
          ) : (
            <EmptyState title="بازی مهمی ثبت نشده" description="به‌محض انتشار برنامه جدید، اینجا نمایش داده می‌شود."/>
          )}
        </section>

        {data.dailyQuiz && (
          <section>
            <SectionTitle title="چالش امروز"/>
            <Link to="/quiz" className="block">
              <Card className="quiz-banner group relative overflow-hidden border-violet-300/15 bg-gradient-to-l from-violet-500/[.17] via-indigo-500/[.08] to-transparent p-0">
                <div className="absolute -left-5 -top-10 h-40 w-40 rounded-full border-[22px] border-violet-300/[.035]"/>
                <div className="relative flex items-center gap-4 p-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.25rem] bg-violet-300 text-indigo-950 shadow-lg shadow-violet-500/20"><CircleHelp size={27} strokeWidth={2.5}/></div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-black tracking-wide text-violet-300">کوییز روزانه</span>
                    <h3 className="mt-1 truncate text-sm font-black">{data.dailyQuiz.title}</h3>
                    <p className="mt-1 text-[10px] text-slate-400">دانشت رو محک بزن و امتیاز بگیر</p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white"><Play size={17} fill="currentColor"/></span>
                </div>
              </Card>
            </Link>
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle title="باشگاه من" action="مشاهده باشگاه" to="/club"/>
          <MyClubCard club={data.club} coinBalance={data.user.coinBalance}/>
          <ClubQuickActions/>
        </section>

        <TransferStatus status={data.transferStatus}/>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">رقابت من</h2><Link to="/competition" className="flex items-center gap-1 text-[9px] font-bold text-emerald-300">همه رقابت‌ها<ArrowLeft size={13}/></Link></div>
          <CompactCompetition competition={data.activeCompetition}/>
        </section>

        {data.sponsor && <section><SponsorCard sponsor={data.sponsor}/></section>}
      </div>
    </main>
  );
}
