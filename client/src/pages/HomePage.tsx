import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BellRing,
  ChevronLeft,
  CircleHelp,
  Flame,
  Gift,
  Medal,
  Play,
  Radio,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { MatchCard } from '@/components/MatchCard';
import { SponsorCard } from '@/components/SponsorCard';
import { Card, EmptyState, ErrorState, PageSkeleton, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber, remaining, tehranDate } from '@/lib/utils';
import type { Competition, HomeData, Match } from '@/types/api';

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

function CompetitionCard({ competition }: { competition: Competition }) {
  return (
    <Link to={`/competitions/${competition._id}`} className="home-cup-card block w-full overflow-hidden rounded-[1.75rem] border border-emerald-300/[.13] bg-ink-900/95 shadow-card transition duration-300 active:scale-[.99]">
      <div className="relative min-h-[176px] overflow-hidden p-4">
        {competition.coverImage ? <img src={competition.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45"/> : <><div className="absolute -left-10 inset-y-0 w-[58%] -skew-x-12 bg-gradient-to-br from-emerald-400/[.18] to-sky-400/[.045]"/><Trophy size={132} strokeWidth={1.2} className="absolute -left-2 -top-5 rotate-12 text-emerald-300/[.2]"/></>}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/45 to-ink-950/10"/>
        <div className="relative flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300 px-3 py-1.5 text-[9px] font-black text-ink-950"><span className="h-1.5 w-1.5 rounded-full bg-ink-950"/>جام فعال</span>
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[9px] font-bold text-white backdrop-blur">{remaining(competition.endsAt)}</span>
        </div>
        <div className="relative mt-12 max-w-[78%]">
          <p className="text-[9px] font-black text-emerald-300">رقابت ویژه باشگاه</p>
          <h3 className="mt-1.5 line-clamp-2 text-lg font-black leading-7 text-white">{competition.title}</h3>
        </div>
      </div>
      <div className="flex min-h-[58px] items-center gap-3 border-t border-white/[.06] px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-300/[.11] text-amber-300"><Trophy size={16}/></span>
        <div className="min-w-0 flex-1"><span className="block text-[8px] text-slate-500">جایزه این رقابت</span><strong className="mt-0.5 block truncate text-[10px] text-slate-300">{competition.prize || 'امتیاز ویژه باشگاه'}</strong></div>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-black text-emerald-300">ورود به جام <ArrowLeft size={16}/></span>
      </div>
    </Link>
  );
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
          <Link to="/profile" aria-label="پروفایل من" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[.06] text-sm font-black text-emerald-200 backdrop-blur">
            {data.user.firstName.slice(0, 1)}
            <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-ink-950 bg-emerald-400"/>
          </Link>
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

        {data.competitions.length > 0 && (
          <section>
            <SectionTitle title="جام‌های فعال" action="مشاهده همه" to="/competitions"/>
            <div className="space-y-3">{data.competitions.map((competition) => <CompetitionCard key={competition._id} competition={competition}/>)}</div>
          </section>
        )}

        {data.sponsor && <section><SponsorCard sponsor={data.sponsor}/></section>}

        <section>
          <SectionTitle title="ستاره‌های این هفته" action="جدول کامل" to="/rankings"/>
          {data.leaders.length ? (
            <Card className="overflow-hidden p-2">
              {data.leaders.slice(0, 5).map((user, index) => (
                <div key={user._id} className="flex min-h-[58px] items-center gap-3 rounded-2xl px-2.5 even:bg-white/[.025]">
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black', index === 0 ? 'bg-amber-300 text-ink-950' : index === 1 ? 'bg-slate-300 text-ink-950' : index === 2 ? 'bg-orange-600 text-white' : 'bg-white/[.05] text-slate-400')}>{faNumber(index + 1)}</span>
                  {user.photoUrl ? <img src={user.photoUrl} alt="" className="h-9 w-9 rounded-xl object-cover"/> : <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10 text-xs font-black text-emerald-300">{user.firstName.slice(0, 1)}</div>}
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{user.firstName} {user.lastName}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500"><Users size={10}/>@{user.username || 'footballer'}</p></div>
                  <span className="whitespace-nowrap text-[10px] font-black text-emerald-300">{faNumber(user.weeklyPoints)} امتیاز</span>
                </div>
              ))}
            </Card>
          ) : <EmptyState title="جدول هنوز خالی است" description="با اولین امتیاز، رقابت هفتگی شروع می‌شود."/>}
        </section>

        {data.rewards.length > 0 && (
          <section>
            <SectionTitle title="جایزه‌های نزدیک" action="همه جوایز" to="/rewards"/>
            <div className="grid grid-cols-2 gap-3">
              {data.rewards.slice(0, 2).map((reward, index) => (
                <Link to="/rewards" key={reward._id}>
                  <Card className={cn('h-full min-h-36 overflow-hidden p-4', index === 0 ? 'border-amber-300/15 bg-amber-300/[.05]' : 'border-sky-300/15 bg-sky-300/[.05]')}>
                    <div className={cn('grid h-10 w-10 place-items-center rounded-2xl', index === 0 ? 'bg-amber-300/15 text-amber-300' : 'bg-sky-300/15 text-sky-300')}><Trophy size={20}/></div>
                    <h3 className="mt-3 line-clamp-2 text-xs font-extrabold leading-5">{reward.title}</h3>
                    <p className="mt-1 text-[9px] text-slate-500">{remaining(reward.endsAt)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
