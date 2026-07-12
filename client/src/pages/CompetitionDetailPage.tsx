import { useMutation, useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, Clock3, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Competition } from '@/types/api';
import { PageHeader } from '@/components/PageHeader';
import { QuizRunner, type SubmitResult } from '@/components/QuizRunner';
import { Card, ErrorState, PageSkeleton, StatusPill } from '@/components/ui';
import { faNumber, remaining } from '@/lib/utils';

export function CompetitionDetailPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['competition', id],
    queryFn: async () => (await api.get<Competition>(`/competitions/${id}`)).data,
    enabled: Boolean(id),
  });
  const submit = useMutation({
    mutationFn: async (payload: { answers: { questionId: string; option: number }[]; durationMs: number }) =>
      (await api.post<SubmitResult>(`/competitions/${id}/submit`, payload)).data,
    onError: error => toast.error((error as Error).message),
  });

  if (query.isLoading) return <PageSkeleton/>;
  if (query.error || !query.data) return <div className="p-4"><ErrorState message={(query.error as Error)?.message || 'مسابقه پیدا نشد'}/></div>;

  const competition = query.data;
  const attemptCount = competition.attempts?.length ?? 0;
  const available = competition.status === 'active' && attemptCount < competition.attemptLimit;

  return <>
    <PageHeader title={competition.title} subtitle="مسابقه باشگاه" back/>
    <main className="competition-detail space-y-4 p-4">
      <Card className="competition-hero relative overflow-hidden border-pitch-400/[.13] p-0">
        <div className="relative min-h-[10.5rem] overflow-hidden">
          {competition.coverImage
            ? <img src={competition.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55"/>
            : <><div className="absolute inset-0 bg-gradient-to-br from-emerald-400/[.13] via-transparent to-sky-400/[.06]"/><Trophy size={145} strokeWidth={1} className="absolute -left-5 -top-8 rotate-12 text-pitch-300/[.12]"/></>}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/55 to-ink-950/10"/>
          <div className="relative flex min-h-[10.5rem] flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <StatusPill status={competition.status}/>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md"><Clock3 size={13} className="text-pitch-300"/>{remaining(competition.endsAt)}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-pitch-300">جام ویژه فوتبال</span>
              <h1 className="mt-1 text-xl font-black leading-8 text-white">{competition.title}</h1>
            </div>
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs leading-6 text-slate-400">{competition.description}</p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-300/[.12] bg-amber-300/[.055] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><Award size={18}/></span>
            <div className="min-w-0"><span className="block text-[9px] text-slate-500">جایزه این رقابت</span><strong className="mt-0.5 block truncate text-xs text-amber-100">{competition.prize || 'امتیاز ویژه باشگاه'}</strong></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3">
              <span className="flex items-center gap-1.5 text-[9px] text-slate-500"><Target size={13}/>تلاش مجاز</span>
              <strong className="mt-1.5 block text-sm">{faNumber(competition.attemptLimit)} بار</strong>
            </div>
            <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3">
              <span className="flex items-center gap-1.5 text-[9px] text-slate-500"><CheckCircle2 size={13}/>تلاش انجام‌شده</span>
              <strong className="mt-1.5 block text-sm">{faNumber(attemptCount)} بار</strong>
            </div>
          </div>
        </div>
      </Card>

      {available && competition.questionIds?.length
        ? <QuizRunner
            questions={competition.questionIds}
            submitting={submit.isPending}
            onSubmit={async (answers, durationMs) => submit.mutateAsync({ answers, durationMs })}
          />
        : <Card className="border-white/[.07] py-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[.045] text-slate-400">{competition.status !== 'active' ? <ShieldCheck size={22}/> : <Sparkles size={22}/>}</div>
            <h2 className="mt-3 text-sm font-extrabold">{competition.status !== 'active' ? 'مسابقه فعال نیست' : 'همه تلاش‌ها استفاده شده'}</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{competition.status !== 'active' ? 'زمان شروع رقابت از همین صفحه اعلام می‌شود.' : 'نتیجه تلاش‌های شما در پروفایل قابل مشاهده است.'}</p>
          </Card>}
    </main>
  </>;
}
