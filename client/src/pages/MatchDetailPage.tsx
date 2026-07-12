import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BellRing, Check, CheckCircle2, Clock3, Info, LockKeyhole, Minus, Plus, Radio, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClubCrest } from '@/components/ClubCrest';
import { Card, ErrorState, LoadingButton, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { impact, notify } from '@/lib/telegram';
import { cn, faNumber, tehranDate } from '@/lib/utils';
import type { Match } from '@/types/api';

type Outcome = 'home' | 'draw' | 'away';

function kickoffTime(value: string) {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function Team({ name, logo }: { name: string; logo?: string }) {
  return <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center"><ClubCrest name={name} logo={logo} className="h-[78px] w-[70px]"/><strong className="line-clamp-2 text-sm leading-6">{name}</strong></div>;
}

function ScoreStepper({ team, score, onChange }: { team: string; score: number; onChange: (score: number) => void }) {
  return (
    <div className="rounded-[1.35rem] border border-white/[.07] bg-white/[.035] p-3 text-center">
      <span className="block truncate text-[9px] font-bold text-slate-500">گل {team}</span>
      <div className="mt-3 grid grid-cols-[36px_1fr_36px] items-center gap-1">
        <button type="button" onClick={() => { impact(); onChange(Math.max(0, score - 1)); }} disabled={score === 0} aria-label={`کم‌کردن گل ${team}`} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.06] text-slate-300 transition active:scale-90 disabled:opacity-30"><Minus size={15}/></button>
        <strong className="text-2xl font-black text-white">{faNumber(score)}</strong>
        <button type="button" onClick={() => { impact(); onChange(Math.min(99, score + 1)); }} disabled={score === 99} aria-label={`افزودن گل ${team}`} className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300 text-ink-950 transition active:scale-90 disabled:opacity-30"><Plus size={15}/></button>
      </div>
    </div>
  );
}

function statusLabel(status: Match['status']) {
  return status === 'live' ? 'زنده' : status === 'finished' ? 'پایان‌یافته' : status === 'cancelled' ? 'لغوشده' : 'بازی آینده';
}

export function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>('home');
  const [exact, setExact] = useState(false);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const query = useQuery({ queryKey: ['match', id], queryFn: async () => (await api.get<Match>(`/matches/${id}`)).data, enabled: Boolean(id), refetchInterval: 30_000 });
  const predict = useMutation({ mutationFn: async () => api.post(`/matches/${id}/prediction`, { outcome, ...(exact ? { homeScore, awayScore } : {}) }), onSuccess: async () => { notify('success'); toast.success('پیش‌بینی با موفقیت ثبت شد'); await queryClient.invalidateQueries({ queryKey: ['match', id] }); await queryClient.invalidateQueries({ queryKey: ['matches'] }); }, onError: (error) => { notify('error'); toast.error((error as Error).message); } });
  const reminder = useMutation({ mutationFn: async () => api.post(`/matches/${id}/reminder`), onSuccess: () => { notify('success'); toast.success('یادآوری ۳۰ دقیقه قبل فعال شد'); }, onError: (error) => toast.error((error as Error).message) });

  if (query.isLoading) return <PageSkeleton/>;
  if (query.error || !query.data) return <div className="p-4"><ErrorState message={(query.error as Error)?.message || 'بازی پیدا نشد'}/></div>;
  const match = query.data;
  const hasScore = match.status === 'finished' || match.status === 'live';
  const outcomes: Array<{ value: Outcome; label: string; short: string }> = [
    { value: 'home', label: `برد ${match.homeTeam}`, short: 'میزبان' },
    { value: 'draw', label: 'مساوی', short: 'بدون برنده' },
    { value: 'away', label: `برد ${match.awayTeam}`, short: 'میهمان' }
  ];
  const chooseOutcome = (value: Outcome) => {
    impact();
    setOutcome(value);
    if (!exact) return;
    if (value === 'draw') { setAwayScore(homeScore); return; }
    if (value === 'home' && homeScore <= awayScore) {
      if (awayScore < 99) setHomeScore(awayScore + 1);
      else { setHomeScore(99); setAwayScore(98); }
    }
    if (value === 'away' && awayScore <= homeScore) {
      if (homeScore < 99) setAwayScore(homeScore + 1);
      else { setAwayScore(99); setHomeScore(98); }
    }
  };
  const changeHomeScore = (score: number) => { setHomeScore(score); setOutcome(score > awayScore ? 'home' : score < awayScore ? 'away' : 'draw'); };
  const changeAwayScore = (score: number) => { setAwayScore(score); setOutcome(homeScore > score ? 'home' : homeScore < score ? 'away' : 'draw'); };

  return (
    <main className="match-detail-page min-h-screen pb-8">
      <header className="safe-top sticky top-0 z-40 border-b border-white/[.06] bg-ink-950/88 px-4 pb-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button type="button" onClick={() => navigate('/matches', { replace: true })} aria-label="بازگشت به بازی‌ها" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/[.07] bg-white/[.05] text-slate-300 transition active:scale-90"><ArrowRight size={20}/></button>
          <div className="min-w-0 flex-1 text-center"><h1 className="truncate text-sm font-black">{match.homeTeam} — {match.awayTeam}</h1><p className="mt-1 truncate text-[9px] text-slate-500">{match.competitionName}</p></div>
          <span className={cn('grid h-11 min-w-11 place-items-center rounded-2xl border px-2 text-[9px] font-black', match.status === 'live' ? 'border-rose-300/20 bg-rose-400/[.1] text-rose-300' : 'border-emerald-300/15 bg-emerald-300/[.07] text-emerald-300')}>{statusLabel(match.status)}</span>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-5 p-4">
        <section className="match-detail-hero relative overflow-hidden rounded-[1.8rem] border border-white/[.085] px-3 pb-4 pt-3 shadow-card">
          <div className="home-hero-grid absolute inset-0 opacity-35"/>
          <div className="absolute left-1/2 top-24 h-40 w-40 -translate-x-1/2 rounded-full bg-emerald-300/[.07] blur-3xl"/>
          <div className="relative flex items-center justify-between border-b border-white/[.055] px-1 pb-3">
            <span className="flex min-w-0 items-center gap-2 text-[9px] font-bold text-slate-400"><Trophy size={13} className="shrink-0 text-amber-300"/><span className="truncate">{match.competitionName}</span></span>
            <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-medium text-slate-500"><Clock3 size={12}/>{tehranDate(match.kickoffAt)}</span>
          </div>
          <div className="relative mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Team name={match.homeTeam} logo={match.homeLogo}/>
            <div className="flex min-w-[72px] flex-col items-center text-center">
              {hasScore ? <div className="whitespace-nowrap text-3xl font-black tracking-wider">{faNumber(match.homeScore ?? 0)} <span className="text-slate-600">–</span> {faNumber(match.awayScore ?? 0)}</div> : <><span className="text-[8px] font-black tracking-[.2em] text-slate-600">ساعت شروع</span><strong className="mt-1 text-xl font-black">{kickoffTime(match.kickoffAt)}</strong></>}
              {match.status === 'live' ? <span className="mt-2 flex items-center gap-1 rounded-full bg-rose-400/[.1] px-2.5 py-1 text-[8px] font-black text-rose-300"><Radio size={10}/> زنده</span> : <span className="mt-2 text-[8px] font-bold text-slate-600">وقت تهران</span>}
            </div>
            <Team name={match.awayTeam} logo={match.awayLogo}/>
          </div>
          {match.description && <div className="relative mt-4 flex gap-2.5 rounded-2xl border border-sky-300/[.08] bg-sky-300/[.045] p-3 text-[10px] leading-5 text-slate-300"><Info size={15} className="mt-0.5 shrink-0 text-sky-300"/><span>{match.description}</span></div>}
        </section>

        {match.prediction ? (
          <Card className="match-panel-animate relative overflow-hidden border-emerald-300/20 bg-gradient-to-l from-emerald-300/[.11] via-emerald-300/[.045] to-transparent p-0">
            <div className="absolute -left-10 -top-12 h-36 w-36 rounded-full border-[18px] border-emerald-300/[.035]"/>
            <div className="relative flex items-start gap-3 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-300 text-ink-950"><CheckCircle2 size={21}/></span><div className="min-w-0 flex-1"><p className="text-[9px] font-black text-emerald-300">پیش‌بینی ثبت‌شده</p><h2 className="mt-1 text-sm font-black">{outcomeLabel(match.prediction.outcome, match)}</h2>{match.prediction.homeScore !== undefined && <p className="mt-1 text-[10px] text-slate-400">نتیجه دقیق: {faNumber(match.prediction.homeScore)} – {faNumber(match.prediction.awayScore ?? 0)}</p>}</div><span className="rounded-full bg-emerald-300/[.1] px-3 py-1.5 text-[9px] font-black text-emerald-300">+{faNumber(match.prediction.pointsAwarded)} امتیاز</span></div>
            <div className="relative flex min-h-10 items-center gap-2 border-t border-white/[.055] px-4 text-[9px] text-slate-500"><ShieldCheck size={13} className="text-emerald-300"/>پیش‌بینی شما نهایی و ذخیره شده است.</div>
          </Card>
        ) : match.predictionOpen ? (
          <Card className="match-panel-animate overflow-hidden border-emerald-300/15 p-0">
            <div className="flex items-center gap-3 border-b border-white/[.06] p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/[.11] text-emerald-300"><Target size={20}/></span><div className="min-w-0 flex-1"><p className="text-[9px] font-black text-emerald-300">انتخاب شما</p><h2 className="mt-0.5 text-sm font-black">پیش‌بینی نتیجه بازی</h2></div><span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[.045] px-2.5 py-1.5 text-[8px] text-slate-400"><Clock3 size={11}/>تا {tehranDate(match.predictionDeadline)}</span></div>

            <div className="p-4">
              <span className="mb-2.5 block text-[9px] font-bold text-slate-500">برنده بازی را انتخاب کن</span>
              <div className="grid grid-cols-3 gap-2">
                {outcomes.map((item) => {
                  const selected = outcome === item.value;
                  return <button type="button" key={item.value} aria-pressed={selected} onClick={() => chooseOutcome(item.value)} className={cn('relative flex min-h-[66px] min-w-0 flex-col items-center justify-center rounded-2xl border px-1 text-center transition active:scale-95', selected ? 'border-emerald-300/35 bg-emerald-300/[.11] text-emerald-300 shadow-lg shadow-emerald-500/[.05]' : 'border-white/[.07] bg-white/[.03] text-slate-400')}><strong className="line-clamp-1 w-full text-[10px]">{item.label}</strong><span className="mt-1 text-[8px] text-slate-600">{item.short}</span>{selected && <span className="absolute left-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-300 text-ink-950"><Check size={10} strokeWidth={3}/></span>}</button>;
                })}
              </div>

              <button type="button" role="switch" aria-checked={exact} onClick={() => { impact(); const next = !exact; setExact(next); if (next && outcome === 'home' && homeScore <= awayScore) setHomeScore(Math.min(99, awayScore + 1)); if (next && outcome === 'away' && awayScore <= homeScore) setAwayScore(Math.min(99, homeScore + 1)); if (next && outcome === 'draw') setAwayScore(homeScore); }} className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] px-3 text-right transition active:scale-[.99]">
                <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300', exact ? 'bg-emerald-400' : 'bg-slate-700')}><span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-300', exact ? 'left-1' : 'left-6')}/></span>
                <span className="min-w-0 flex-1"><strong className="block text-[11px]">نتیجه دقیق هم پیش‌بینی می‌کنم</strong><span className="mt-1 block text-[8px] text-slate-500">برای امتیاز بیشتر، تعداد گل‌ها را مشخص کن</span></span>
                <Sparkles size={16} className={exact ? 'text-amber-300' : 'text-slate-600'}/>
              </button>

              {exact && <div className="exact-score-reveal mt-3 grid grid-cols-2 gap-2"><ScoreStepper team={match.homeTeam} score={homeScore} onChange={changeHomeScore}/><ScoreStepper team={match.awayTeam} score={awayScore} onChange={changeAwayScore}/></div>}

              <div className="mt-4 rounded-2xl bg-ink-950/55 p-3 text-center"><span className="text-[8px] text-slate-500">انتخاب فعلی شما</span><strong className="mt-1 block text-[11px] text-white">{outcomeLabel(outcome, match)}{exact ? ` · ${faNumber(homeScore)} – ${faNumber(awayScore)}` : ''}</strong></div>
              <LoadingButton loading={predict.isPending} onClick={() => predict.mutate()} className="mt-3 w-full bg-gradient-to-l from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/10"><LockKeyhole size={17}/>ثبت نهایی پیش‌بینی</LoadingButton>
              <p className="mt-2.5 text-center text-[8px] leading-4 text-slate-600">پس از ثبت، امکان ویرایش پیش‌بینی وجود ندارد.</p>
            </div>
          </Card>
        ) : (
          <Card className="match-panel-animate flex items-center gap-3 border-white/[.07] bg-white/[.025]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-400/[.08] text-slate-500"><LockKeyhole size={18}/></span><div><h2 className="text-xs font-black">پیش‌بینی بسته شده</h2><p className="mt-1 text-[9px] text-slate-500">مهلت پیش‌بینی این بازی به پایان رسیده است.</p></div></Card>
        )}

        {match.status === 'scheduled' && <LoadingButton loading={reminder.isPending} onClick={() => reminder.mutate()} className="match-panel-animate w-full border border-sky-300/15 bg-sky-400 text-ink-950 shadow-lg shadow-sky-500/10"><BellRing size={18}/>یادآوری ۳۰ دقیقه قبل از بازی</LoadingButton>}
      </div>
    </main>
  );
}

function outcomeLabel(value: string, match: Match) {
  return value === 'home' ? `برد ${match.homeTeam}` : value === 'away' ? `برد ${match.awayTeam}` : 'مساوی';
}
