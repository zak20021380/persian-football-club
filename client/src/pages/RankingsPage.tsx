import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpLeft, Crown, Medal, Sparkles, Target, Trophy, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';
import type { User } from '@/types/api';

type RankingType = 'weekly' | 'all' | 'predictors' | 'referrals';

const tabs: Array<{ value: RankingType; label: string; hint: string; icon: typeof Medal }> = [
  { value: 'weekly', label: 'هفتگی', hint: 'این هفته', icon: Medal },
  { value: 'all', label: 'همیشگی', hint: 'کل امتیاز', icon: Crown },
  { value: 'predictors', label: 'پیش‌بینی', hint: 'نتیجه صحیح', icon: Target },
  { value: 'referrals', label: 'دعوت', hint: 'دوستان', icon: UserPlus }
];

interface RankingData {
  type: string;
  leaders: User[];
  current: User & { rank: number };
}

const podiumStyles = {
  1: { height: 'h-32', tone: 'from-amber-300/25 to-amber-400/[.04]', border: 'border-amber-300/30', badge: 'bg-amber-300 text-ink-950', ring: 'ring-amber-300/40' },
  2: { height: 'h-24', tone: 'from-slate-300/15 to-slate-400/[.03]', border: 'border-slate-300/20', badge: 'bg-slate-300 text-ink-950', ring: 'ring-slate-300/30' },
  3: { height: 'h-20', tone: 'from-orange-400/15 to-orange-500/[.03]', border: 'border-orange-400/20', badge: 'bg-orange-600 text-white', ring: 'ring-orange-400/30' }
} as const;

function Avatar({ user, className = '' }: { user: User; className?: string }) {
  return user.photoUrl ? (
    <img src={user.photoUrl} alt={`${user.firstName} ${user.lastName || ''}`} className={cn('rounded-2xl object-cover', className)}/>
  ) : (
    <div className={cn('grid place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-600 font-black text-ink-950', className)}>{user.firstName.slice(0, 1)}</div>
  );
}

function RankingTabs({ value, onChange }: { value: RankingType; onChange: (value: RankingType) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-[1.6rem] border border-white/[.08] bg-ink-900/95 p-2 shadow-2xl shadow-black/25 backdrop-blur-xl">
      {tabs.map(({ value: tabValue, label, icon: Icon }) => {
        const active = value === tabValue;
        return (
          <button key={tabValue} type="button" aria-pressed={active} onClick={() => onChange(tabValue)} className={cn('relative flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[9px] font-bold transition active:scale-95', active ? 'bg-emerald-400/[.12] text-emerald-300' : 'text-slate-500')}>
            <Icon size={18} strokeWidth={active ? 2.6 : 1.8}/>
            <span>{label}</span>
            {active && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-emerald-300"/>}
          </button>
        );
      })}
    </div>
  );
}

function CurrentRank({ user, type }: { user: RankingData['current']; type: RankingType }) {
  return (
    <Card className="relative overflow-hidden border-emerald-300/20 bg-gradient-to-l from-emerald-400/[.13] via-emerald-400/[.05] to-transparent p-0">
      <div className="absolute -left-9 -top-12 h-36 w-36 rounded-full border-[18px] border-emerald-300/[.035]"/>
      <div className="relative flex items-center gap-3 p-4">
        <div className="relative shrink-0">
          <Avatar user={user} className="h-14 w-14 ring-4 ring-emerald-300/10"/>
          <span className="absolute -bottom-1 -left-1 grid h-6 min-w-6 place-items-center rounded-lg bg-emerald-300 px-1 text-[9px] font-black text-ink-950">#{faNumber(user.rank)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300"><Sparkles size={12}/> جایگاه فعلی شما</div>
          <h2 className="mt-1 truncate text-sm font-black">{user.firstName} {user.lastName}</h2>
          <p className="mt-1 truncate text-[9px] text-slate-500">@{user.username || 'footballer'}</p>
        </div>
        <div className="shrink-0 text-left">
          <strong className="block text-sm font-black text-white">{rankingValue(user, type)}</strong>
          <span className="mt-1 block text-[9px] text-slate-500">{metricHint(type)}</span>
        </div>
      </div>
      <div className="relative flex min-h-9 items-center justify-between border-t border-white/[.06] px-4 text-[9px] text-slate-400">
        <span>هر فعالیت، یک قدم تا صدر جدول</span>
        <Trophy size={14} className="text-amber-300"/>
      </div>
    </Card>
  );
}

function Podium({ leaders, type }: { leaders: User[]; type: RankingType }) {
  const slots: Array<{ user?: User; rank: 1 | 2 | 3 }> = [
    { user: leaders[1], rank: 2 },
    { user: leaders[0], rank: 1 },
    { user: leaders[2], rank: 3 }
  ];

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[.08] bg-ink-900/80 px-2 pb-3 pt-11">
      <div className="absolute left-1/2 top-0 h-28 w-52 -translate-x-1/2 rounded-full bg-amber-300/[.07] blur-3xl"/>
      <div className="relative grid grid-cols-3 items-end gap-1.5">
        {slots.map(({ user, rank }) => {
          if (!user) return <div key={rank} className="h-20"/>;
          const style = podiumStyles[rank];
          return (
            <div key={user._id} className="flex min-w-0 flex-col items-center">
              <div className="relative z-10 mb-[-18px]">
                {rank === 1 && <Crown size={22} className="absolute -top-7 left-1/2 -translate-x-1/2 rotate-[-6deg] fill-amber-300 text-amber-300"/>}
                <Avatar user={user} className={cn('h-12 w-12 ring-4 sm:h-14 sm:w-14', style.ring)}/>
                <span className={cn('absolute -bottom-1 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-lg text-[10px] font-black shadow-lg', style.badge)}>{faNumber(rank)}</span>
              </div>
              <div className={cn('flex w-full flex-col items-center justify-end rounded-t-[1.4rem] border border-b-0 bg-gradient-to-b px-1 pb-3 pt-6 text-center', style.height, style.tone, style.border)}>
                <h3 className="line-clamp-1 w-full text-[10px] font-black sm:text-xs">{user.firstName}</h3>
                <p className="mt-1 line-clamp-1 w-full text-[8px] text-slate-500">@{user.username || 'footballer'}</p>
                <strong className={cn('mt-2 whitespace-nowrap text-[9px] font-black', rank === 1 ? 'text-amber-300' : 'text-emerald-300')}>{rankingValue(user, type)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderRow({ user, index, type }: { user: User; index: number; type: RankingType }) {
  const rank = index + 4;
  return (
    <div className="flex min-h-[68px] items-center gap-3 rounded-2xl px-3 transition active:bg-white/[.04] even:bg-white/[.022]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.035] text-xs font-black text-slate-400">{faNumber(rank)}</span>
      <Avatar user={user} className="h-10 w-10"/>
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{user.firstName} {user.lastName}</p><p className="mt-1 truncate text-[9px] text-slate-500">@{user.username || 'footballer'}</p></div>
      <strong className="shrink-0 text-[10px] font-black text-emerald-300">{rankingValue(user, type)}</strong>
    </div>
  );
}

export function RankingsPage() {
  const [type, setType] = useState<RankingType>('weekly');
  const query = useQuery({ queryKey: ['rankings', type], queryFn: async () => (await api.get<RankingData>('/rankings', { params: { type } })).data });
  const activeTab = tabs.find((tab) => tab.value === type)!;

  return (
    <main className="ranking-page pb-5">
      <header className="ranking-hero safe-top relative overflow-hidden px-4 pb-10 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-40"/>
        <div className="absolute -left-16 -top-24 h-56 w-56 rounded-full bg-amber-300/[.08] blur-3xl"/>
        <div className="absolute -right-20 top-16 h-52 w-52 rounded-full border border-emerald-300/[.07]"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-11 w-11"/>
            <div><p className="text-[9px] font-bold text-emerald-300">تالار افتخارات</p><h1 className="mt-0.5 text-lg font-black">جدول قهرمانان</h1></div>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[.08] text-amber-300"><Trophy size={21}/></div>
        </div>
        <div className="relative mt-6">
          <p className="text-[10px] font-bold text-slate-400">رقابت، پیش‌بینی، قهرمانی</p>
          <h2 className="mt-1 text-2xl font-black leading-10">بین بهترین‌های باشگاه،<br/><span className="text-emerald-300">جایگاهت رو پیدا کن.</span></h2>
        </div>
      </header>

      <div className="relative -mt-6 px-4"><RankingTabs value={type} onChange={setType}/></div>

      <div className="mt-6 space-y-6 px-4">
        {query.isLoading ? <PageSkeleton/> : query.error ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/> : query.data && (
          <>
            <CurrentRank user={query.data.current} type={type}/>

            {query.data.leaders.length > 0 ? (
              <section>
                <div className="mb-3 flex items-end justify-between">
                  <div><p className="text-[9px] font-bold text-emerald-300">{activeTab.hint}</p><h2 className="mt-0.5 text-base font-black">صدرنشین‌ها</h2></div>
                  <span className="rounded-full border border-white/[.07] bg-white/[.035] px-3 py-1.5 text-[9px] font-bold text-slate-400">به‌روزرسانی زنده</span>
                </div>
                <Podium leaders={query.data.leaders} type={type}/>
              </section>
            ) : (
              <Card className="py-8 text-center"><Trophy className="mx-auto text-slate-600"/><h3 className="mt-3 text-sm font-black">هنوز صدرنشینی نداریم</h3><p className="mt-1 text-[10px] text-slate-500">اولین امتیاز این جدول را تو ثبت کن.</p></Card>
            )}

            {query.data.leaders.length > 3 && (
              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">ادامه جدول</h2><span className="text-[9px] text-slate-500">{faNumber(query.data.leaders.length)} بازیکن برتر</span></div>
                <Card className="p-1.5">{query.data.leaders.slice(3).map((user, index) => <LeaderRow key={user._id} user={user} index={index} type={type}/>)}</Card>
              </section>
            )}

            {query.data.leaders.length <= 3 && (
              <Link to="/profile" className="flex min-h-16 items-center gap-3 rounded-[1.4rem] border border-dashed border-white/10 bg-white/[.025] px-4">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"><UserPlus size={18}/></span>
                <div className="min-w-0 flex-1"><h3 className="text-xs font-black">رقابت رو داغ‌تر کن</h3><p className="mt-1 text-[9px] text-slate-500">دوستات رو دعوت کن و امتیاز بگیر</p></div>
                <ArrowUpLeft size={17} className="text-emerald-300"/>
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function rankingValue(user: User, type: RankingType) {
  const value = type === 'referrals' ? user.successfulReferrals : type === 'predictors' ? user.correctPredictions : type === 'all' ? user.points : user.weeklyPoints;
  return `${faNumber(value ?? 0)} ${type === 'referrals' ? 'دعوت' : type === 'predictors' ? 'صحیح' : 'امتیاز'}`;
}

function metricHint(type: RankingType) {
  return type === 'referrals' ? 'دعوت موفق' : type === 'predictors' ? 'پیش‌بینی صحیح' : type === 'all' ? 'از شروع عضویت' : 'در این هفته';
}
