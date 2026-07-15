import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BellRing,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Coins,
  Handshake,
  Inbox,
  Laugh,
  Play,
  Radio,
  Shield,
  Shirt,
  Tags,
  Target,
  Trophy,
  UserRound,
  WalletCards
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { MatchCard } from '@/components/MatchCard';
import { SponsorCard } from '@/components/SponsorCard';
import { Card, ErrorState, PageSkeleton, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber, remaining, tehranDate } from '@/lib/utils';
import type { HomeData, Match } from '@/types/api';

const demoManchesterDerby = {
  cityLogo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
  unitedLogo: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg'
};

const quickActions = [
  { to: '/matches', label: 'پیش‌بینی', icon: Target, tone: 'home-action-cyan' },
  { to: '/quiz', label: 'کوییز روز', icon: CircleHelp, tone: 'home-action-magenta' },
  { to: '/rankings', label: 'رتبه‌بندی', icon: Trophy, tone: 'home-action-mint' }
];

function QuickActions({ predictionsCount }: { predictionsCount: number }) {
  return (
    <div className="home-quick-actions grid grid-cols-3 gap-1.5 p-1.5">
      {quickActions.map(({ to, label, icon: Icon, tone }, index) => (
        <Link key={to} to={to} className="home-quick-action group relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 overflow-hidden px-2 transition active:scale-[.97]">
          <span className="absolute right-2 top-1.5 text-[7px] font-black tracking-[.18em] text-white/20" dir="ltr">0{index + 1}</span>
          <span className={cn('grid h-9 w-9 place-items-center transition group-active:scale-95', tone)}><Icon size={18} strokeWidth={2.3}/></span>
          <span className="text-[10px] font-extrabold text-slate-200">{label}</span>
          {index === 0 && predictionsCount > 0 && <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300 ring-[3px] ring-[#10091e]"/>}
        </Link>
      ))}
    </div>
  );
}

function FeaturedMatch({ match }: { match: Match }) {
  const hasScore = match.status === 'finished' || match.status === 'live';
  return (
    <Link to={`/matches/${match._id}`} className="block">
      <article className="featured-match group overflow-hidden border border-white/[.1] transition active:scale-[.99]">
        <div className="home-featured-stripe"/>
        <div className="relative flex items-center justify-between border-b border-white/[.07] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="home-competition-mark grid h-7 w-7 shrink-0 place-items-center text-[#10051d]"><Trophy size={13} strokeWidth={2.7}/></span>
            <div className="min-w-0"><span className="block text-[7px] font-black tracking-[.15em] text-cyan-300" dir="ltr">FEATURED MATCH</span><span className="block truncate text-[10px] font-bold text-slate-300">{match.competitionName}</span></div>
          </div>
          {match.status === 'live' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-400/10 px-2.5 py-1 text-[10px] font-black text-rose-300"><Radio size={11}/> زنده</span>
          ) : (
            <span className="rounded-full bg-white/[.05] px-2.5 py-1 text-[10px] font-bold text-slate-400">{tehranDate(match.kickoffAt)}</span>
          )}
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-7 sm:px-6">
          <div className="home-match-midline absolute inset-y-4 left-1/2 w-px -translate-x-1/2"/>
          <div className="relative flex min-w-0 flex-col items-center gap-3 text-center">
            <ClubCrest name={match.homeTeam} logo={match.homeLogo} className="h-[68px] w-[60px] sm:h-[76px] sm:w-[68px]"/>
            <strong className="line-clamp-1 w-full text-xs sm:text-sm">{match.homeTeam}</strong>
          </div>
          <div className="relative flex min-w-[58px] flex-col items-center">
            {hasScore ? (
              <div className="home-score-bug whitespace-nowrap px-3 py-2 text-2xl font-black tracking-wider">{faNumber(match.homeScore ?? 0)} <span className="text-slate-500">–</span> {faNumber(match.awayScore ?? 0)}</div>
            ) : (
              <><span className="text-[8px] font-bold uppercase tracking-[.24em] text-slate-500">مسابقه</span><span className="home-vs-bug my-1.5 grid h-10 min-w-12 place-items-center px-2 text-lg font-black text-white">VS</span></>
            )}
          </div>
          <div className="relative flex min-w-0 flex-col items-center gap-3 text-center">
            <ClubCrest name={match.awayTeam} logo={match.awayLogo} className="h-[68px] w-[60px] sm:h-[76px] sm:w-[68px]"/>
            <strong className="line-clamp-1 w-full text-xs sm:text-sm">{match.awayTeam}</strong>
          </div>
        </div>

        {match.prediction && (
          <div className="home-prediction-bar mx-3 mb-3 flex min-h-11 items-center justify-between px-3 text-[11px] font-bold text-cyan-100 sm:mx-4 sm:px-4">
            <span className="flex items-center gap-2"><Target size={15}/> پیش‌بینی شما ثبت شده</span>
            <span className="flex items-center gap-1 text-white">مشاهده <ChevronLeft size={15}/></span>
          </div>
        )}
        {match.predictionOpen && !match.prediction && (
          <div className="home-prediction-bar mx-3 mb-3 flex min-h-11 items-center justify-between px-3 text-[11px] font-bold text-emerald-200 sm:mx-4 sm:px-4">
            <span className="flex items-center gap-2"><BellRing size={15}/> پیش‌بینی این بازی فعاله</span>
            <span className="flex items-center gap-1 text-white">ثبت پیش‌بینی <ChevronLeft size={15}/></span>
          </div>
        )}
      </article>
    </Link>
  );
}

function DemoFeaturedMatch() {
  return (
    <Link to="/matches" className="block" aria-label="پیش‌بینی دربی منچستر">
      <article className="demo-featured-match group relative isolate overflow-hidden transition active:scale-[.99]">
        <div className="demo-match-atmosphere absolute inset-0" aria-hidden="true"/>

        <div className="relative flex items-center justify-between gap-3 px-3.5 pt-3.5">
          <div className="demo-match-brand flex shrink-0 items-center gap-2" dir="ltr">
            <strong>FFN</strong>
            <span>FOOTBALL FUCK NEWS</span>
          </div>
          <span className="demo-derby-chip flex min-w-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-[9px] font-extrabold">
            <Trophy size={12} strokeWidth={2.5}/>
            دربی منچستر
          </span>
        </div>

        <div className="relative mt-2 text-center">
          <span className="demo-match-kicker block text-[6px] font-black tracking-[.28em]" dir="ltr">MANCHESTER DERBY</span>
          <h3 className="mt-0.5 text-[17px] font-black tracking-tight text-white">نبرد برای شهر منچستر</h3>
        </div>

        <div className="relative mt-2 grid grid-cols-[1fr_54px_1fr] items-center gap-1.5 px-2.5" dir="ltr">
          <div className="demo-team flex min-w-0 flex-col items-center text-center" dir="rtl">
            <span className="demo-crest-stage demo-crest-city grid h-[76px] w-[76px] place-items-center">
              <ClubCrest name="منچستر سیتی" logo={demoManchesterDerby.cityLogo} className="h-[66px] w-[66px]"/>
            </span>
            <strong className="mt-1.5 whitespace-nowrap text-[11px] font-black text-white">منچستر سیتی</strong>
          </div>

          <div className="demo-kickoff flex flex-col items-center text-center" dir="rtl">
            <span className="demo-tonight-pill px-2 py-1 text-[9px] font-black">امشب</span>
            <strong className="mt-1 text-[20px] font-black leading-none" dir="ltr">۲۳:۳۰</strong>
            <span className="demo-vs mt-1.5 text-[8px] font-black tracking-[.2em]" dir="ltr">VS</span>
          </div>

          <div className="demo-team flex min-w-0 flex-col items-center text-center" dir="rtl">
            <span className="demo-crest-stage demo-crest-united grid h-[76px] w-[76px] place-items-center">
              <ClubCrest name="منچستر یونایتد" logo={demoManchesterDerby.unitedLogo} className="h-[66px] w-[66px]"/>
            </span>
            <strong className="mt-1.5 whitespace-nowrap text-[11px] font-black text-white">منچستر یونایتد</strong>
          </div>
        </div>

        <div className="demo-match-footer relative mx-3 mb-3 mt-3 flex min-h-11 items-center justify-between gap-2 px-3">
          <span className="text-[8px] font-bold text-slate-400">لیگ برتر انگلیس</span>
          <span className="demo-predict-cta flex min-h-9 shrink-0 items-center gap-2 px-4 text-[11px] font-black text-[#080b1b]">
            <Target size={15} strokeWidth={2.6}/>
            پیش‌بینی کن
            <ArrowLeft size={14} strokeWidth={2.6}/>
          </span>
        </div>
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

function CompactCompetition({ competition }: { competition: NonNullable<HomeData['activeCompetition']> }) {
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
      <header className="home-hero safe-top relative overflow-hidden px-4 pb-8 pt-3">
        <div className="home-hero-grid absolute inset-0"/>
        <div className="home-broadcast-angle absolute inset-0"/>

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="home-header-brand h-10 w-10"/>
            <div className="home-ffn-lockup min-w-0" dir="ltr" aria-label="FFN — Football Fuck News">
              <strong>FFN</strong>
              <span>Football Fuck News</span>
            </div>
          </div>
          <div className="home-header-actions flex items-center gap-2">
            <Link to="/store" aria-label="فروشگاه و کیف پول" title="فروشگاه و کیف پول" className="home-header-action home-header-wallet">
              <WalletCards size={18} strokeWidth={1.9}/>
            </Link>
            <Link to="/profile" aria-label="پروفایل من" title="پروفایل من" className="home-header-action home-header-profile">
              <UserRound size={18} strokeWidth={1.9}/>
            </Link>
          </div>
        </div>

        <div className="relative mt-5 max-w-[340px]">
          <span className="home-ffn-official inline-flex items-center gap-1.5"><Shield size={10} strokeWidth={2.4}/>مینی‌اپ رسمی FFN</span>
          <h1 className="home-hero-headline mt-2 font-black tracking-tight text-white"><span className="home-hero-setup"><span>باشگاهتو بساز،</span><span>ترکیبتو بچین،</span></span><span className="home-hero-title-accent">قهرمان شو.</span></h1>
          <p className="home-hero-copy mt-2.5 max-w-[315px] font-medium text-slate-400">پیش‌بینی، فانتزی و رقابت‌های فوتبالی؛ همه در مینی‌اپ رسمی FFN.</p>
        </div>
      </header>

      <div className="relative -mt-6 px-4"><QuickActions predictionsCount={data.predictionsCount}/></div>

      <div className="mt-5 space-y-8 px-4">
        <Link to="/fun" className="home-fun-feature group relative isolate flex min-h-[120px] items-center gap-3 overflow-hidden rounded-[1.45rem] p-4 transition active:scale-[.99]" aria-label="فان فوتبالی؛ مشاهده بخش فان">
          <span className="home-fun-pattern absolute" aria-hidden="true"/>
          <span className="home-fun-icon relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><Laugh size={23} strokeWidth={2.25}/></span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[6px] font-black tracking-[.16em] text-fuchsia-300" dir="ltr">FFN FUN / FOOTBALL HUMOR</span>
            <strong className="mt-1 block text-sm font-black tracking-tight text-white">فان فوتبالی</strong>
            <span className="mt-1 block line-clamp-2 text-[8px] leading-4 text-slate-400">میم‌ها، سوژه‌ها و لحظه‌های بامزه دنیای فوتبال</span>
            <span className="home-fun-cta mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-xl px-3 text-[8px] font-black">مشاهده فان<ArrowLeft size={13}/></span>
          </span>
        </Link>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div><span className="text-[7px] font-black tracking-[.18em] text-fuchsia-300" dir="ltr">MAIN EVENT</span><h2 className="mt-1 text-base font-black tracking-tight">بازی‌های مهم</h2></div>
            <Link to="/matches" className="flex min-h-9 items-center gap-1 text-[10px] font-bold text-cyan-300">همه بازی‌ها<ArrowLeft size={14}/></Link>
          </div>
          {firstMatch ? (
            <div className="space-y-3">
              <FeaturedMatch match={firstMatch}/>
              {data.matches.slice(1, 3).map((match) => <MatchCard key={match._id} match={match}/>)}
            </div>
          ) : (
            <DemoFeaturedMatch/>
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

        {data.activeCompetition && (
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">رقابت من</h2><Link to="/competition" className="flex items-center gap-1 text-[9px] font-bold text-emerald-300">همه رقابت‌ها<ArrowLeft size={13}/></Link></div>
            <CompactCompetition competition={data.activeCompetition}/>
          </section>
        )}

        {data.sponsor && <section><SponsorCard sponsor={data.sponsor}/></section>}
      </div>
    </main>
  );
}
