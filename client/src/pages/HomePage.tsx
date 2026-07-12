import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Flame, Medal, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { faNumber, remaining } from '@/lib/utils';
import type { HomeData } from '@/types/api';
import { MatchCard } from '@/components/MatchCard';
import { SponsorCard } from '@/components/SponsorCard';
import { Card, EmptyState, ErrorState, PageSkeleton, SectionTitle, Stat } from '@/components/ui';

export function HomePage() {
  const query = useQuery({ queryKey: ['home'], queryFn: async () => (await api.get<HomeData>('/home')).data, refetchInterval: 60_000 });
  if (query.isLoading) return <PageSkeleton/>;
  if (query.error || !query.data) return <div className="p-4"><ErrorState message={(query.error as Error)?.message ?? 'اطلاعات خانه دریافت نشد'} onRetry={() => query.refetch()}/></div>;
  const data = query.data;
  return <main className="space-y-6 px-4 pb-4">
    <section className="safe-top relative -mx-4 overflow-hidden border-b border-white/[.06] px-4 pb-6 pt-2">
      <div className="absolute -left-16 -top-20 h-48 w-48 rounded-full border border-pitch-400/10"/><div className="absolute -left-7 -top-11 h-28 w-28 rounded-full border border-pitch-400/10"/>
      <div className="relative flex items-start justify-between"><div><p className="text-xs font-semibold text-pitch-300">باشگاه فوتبالی</p><h1 className="mt-1 text-2xl font-black">سلام {data.user.firstName} 👋</h1><p className="mt-1 text-xs text-slate-400">امروز هم برای صدر جدول آماده‌ای؟</p></div><Link to="/profile" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[.05]"><Sparkles size={20} className="text-pitch-300"/></Link></div>
      <div className="relative mt-5 grid grid-cols-3 gap-2"><Stat label="امتیاز کل" value={faNumber(data.user.points)} icon={<Zap size={14}/>}/><Stat label="رتبه هفتگی" value={`#${faNumber(data.user.weeklyRank)}`} icon={<Medal size={14}/>}/><Stat label="استریک" value={`${faNumber(data.user.streak)} روز`} icon={<Flame size={14}/>}/></div>
    </section>

    <section><SectionTitle title="بازی‌های مهم" action="مشاهده همه" to="/matches"/>{data.matches.length ? <div className="space-y-3">{data.matches.map((match) => <MatchCard key={match._id} match={match}/>)}</div> : <EmptyState title="بازی مهمی ثبت نشده" description="به‌محض انتشار برنامه جدید، اینجا نمایش داده می‌شود."/>}</section>

    {data.competitions.length > 0 && <section><SectionTitle title="مسابقات فعال" action="همه مسابقات" to="/competitions"/><div className="flex snap-x gap-3 overflow-x-auto pb-1 scrollbar-none">{data.competitions.map((competition) => <Link key={competition._id} to={`/competitions/${competition._id}`} className="surface min-w-[82%] snap-center overflow-hidden p-0"><div className="relative h-28 bg-gradient-to-l from-pitch-500/20 to-blue-500/15">{competition.coverImage && <img src={competition.coverImage} alt="" className="h-full w-full object-cover opacity-60"/>}<div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink-950 p-4"><span className="text-[10px] font-bold text-pitch-300">{remaining(competition.endsAt)}</span><h3 className="mt-1 font-black">{competition.title}</h3></div></div><div className="flex items-center justify-between p-4 text-xs text-slate-400"><span>{competition.prize || 'رقابت برای امتیاز'}</span><ArrowLeft size={17} className="text-pitch-300"/></div></Link>)}</div></section>}

    {data.dailyQuiz && <section><SectionTitle title="کوییز روزانه"/><Link to="/quiz" className="block"><Card className="relative overflow-hidden border-pitch-400/20 bg-gradient-to-l from-pitch-500/15 to-transparent"><div className="absolute -left-7 -bottom-12 text-pitch-400/10"><Target size={140}/></div><div className="relative"><span className="chip border-pitch-400/20 text-pitch-300">چالش امروز</span><h3 className="mt-4 text-lg font-black">{data.dailyQuiz.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-400">{data.dailyQuiz.description || 'دانش فوتبالی‌ات را محک بزن و امتیاز بگیر.'}</p><div className="btn-primary mt-5 w-full">{data.dailyQuiz.attempted ? 'مشاهده نتیجه' : 'شروع کوییز'}<ArrowLeft size={18}/></div></div></Card></Link></section>}

    {data.sponsor && <section><SponsorCard sponsor={data.sponsor}/></section>}

    <section><SectionTitle title="صدرنشین‌های هفته" action="جدول کامل" to="/rankings"/><Card className="p-2">{data.leaders.map((user, index) => <div key={user._id} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 even:bg-white/[.025]"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.06] text-xs font-black">{faNumber(index+1)}</div>{user.photoUrl ? <img src={user.photoUrl} alt="" className="h-9 w-9 rounded-xl object-cover"/> : <div className="grid h-9 w-9 place-items-center rounded-xl bg-pitch-500/10 font-bold text-pitch-300">{user.firstName.slice(0,1)}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.firstName} {user.lastName}</p><p className="text-[10px] text-slate-500">@{user.username || 'footballer'}</p></div><span className="text-xs font-extrabold text-pitch-300">{faNumber(user.weeklyPoints)} امتیاز</span></div>)}</Card></section>

    {data.rewards.length > 0 && <section><SectionTitle title="جوایز نزدیک" action="همه جوایز" to="/rewards"/><div className="grid grid-cols-2 gap-3">{data.rewards.slice(0,2).map((reward) => <Link to="/rewards" key={reward._id}><Card className="h-full"><Trophy size={22} className="text-amber-300"/><h3 className="mt-3 line-clamp-1 text-sm font-extrabold">{reward.title}</h3><p className="mt-1 text-[10px] text-slate-400">{remaining(reward.endsAt)}</p></Card></Link>)}</div></section>}
  </main>;
}
