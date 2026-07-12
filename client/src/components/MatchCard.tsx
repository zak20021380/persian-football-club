import { ArrowLeft, Bell, CheckCircle2, Clock3, Radio, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Match } from '@/types/api';
import { cn, faNumber } from '@/lib/utils';
import { ClubCrest } from './ClubCrest';

function matchDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
}

function matchTime(value: string) {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function Team({ name, logo }: { name: string; logo?: string }) {
  return <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5 text-center"><ClubCrest name={name} logo={logo} className="h-[62px] w-14"/><strong className="line-clamp-1 w-full text-xs sm:text-sm">{name}</strong></div>;
}

function MatchStatus({ status }: { status: Match['status'] }) {
  if (status === 'live') return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-400/[.11] px-2.5 py-1.5 text-[9px] font-black text-rose-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300"/>زنده</span>;
  const labels = { scheduled: 'زمان‌بندی‌شده', finished: 'پایان‌یافته', cancelled: 'لغوشده' };
  return <span className={cn('rounded-full px-2.5 py-1.5 text-[9px] font-bold', status === 'finished' ? 'bg-sky-400/[.09] text-sky-300' : status === 'cancelled' ? 'bg-rose-400/[.09] text-rose-300' : 'bg-white/[.055] text-slate-400')}>{labels[status]}</span>;
}

export function MatchCard({ match }: { match: Match }) {
  const hasScore = match.status === 'finished' || match.status === 'live';
  return (
    <Link to={`/matches/${match._id}`} className="match-card block overflow-hidden rounded-[1.7rem] border border-white/[.085] bg-ink-900/90 shadow-card transition duration-300 active:scale-[.99]">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/[.055] px-3.5">
        <div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-emerald-400/[.09] text-emerald-300"><Trophy size={13}/></span><span className="truncate text-[10px] font-bold text-slate-300">{match.competitionName}</span></div>
        <MatchStatus status={match.status}/>
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-5">
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/[.045] blur-2xl"/>
        <Team name={match.homeTeam} logo={match.homeLogo}/>
        <div className="relative flex min-w-[72px] flex-col items-center text-center">
          {hasScore ? <div className="whitespace-nowrap text-2xl font-black tracking-wider text-white">{faNumber(match.homeScore ?? 0)} <span className="text-slate-600">–</span> {faNumber(match.awayScore ?? 0)}</div> : <><span className="text-[8px] font-black tracking-[.2em] text-slate-600">شروع</span><strong className="mt-1 text-lg font-black text-white">{matchTime(match.kickoffAt)}</strong></>}
          <span className="mt-2 flex items-center gap-1 text-[8px] font-medium text-slate-500">{match.status === 'live' ? <Radio size={11}/> : <Clock3 size={11}/>} {matchDate(match.kickoffAt)}</span>
        </div>
        <Team name={match.awayTeam} logo={match.awayLogo}/>
      </div>

      {match.prediction && <div className="mx-3 mb-3 flex min-h-11 items-center justify-between rounded-2xl bg-sky-400/[.085] px-3 text-[10px] font-bold text-sky-200"><span className="flex items-center gap-2"><CheckCircle2 size={15}/>پیش‌بینی شما ثبت شده</span><span className="font-black text-white">+{faNumber(match.prediction.pointsAwarded)} امتیاز</span></div>}
      {match.predictionOpen && !match.prediction && <div className="mx-3 mb-3 flex min-h-11 items-center justify-between rounded-2xl bg-emerald-400/[.095] px-3 text-[10px] font-black text-emerald-200"><span className="flex items-center gap-2"><Bell size={15}/>پیش‌بینی این بازی بازه</span><span className="flex items-center gap-1 text-white">ثبت پیش‌بینی<ArrowLeft size={15}/></span></div>}
      {!match.predictionOpen && match.status === 'scheduled' && !match.prediction && <div className="mx-3 mb-3 flex min-h-10 items-center gap-2 rounded-2xl bg-white/[.035] px-3 text-[9px] text-slate-500"><Sparkles size={13}/>مهلت پیش‌بینی این بازی به پایان رسیده</div>}
    </Link>
  );
}
