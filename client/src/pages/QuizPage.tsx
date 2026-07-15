import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleHelp, Sparkles, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Quiz } from '@/types/api';
import { PageHeader } from '@/components/PageHeader';
import { QuizRunner, type SubmitResult } from '@/components/QuizRunner';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { faNumber } from '@/lib/utils';

const quizHeader = <PageHeader title="کوییز روزانه" subtitle="دانش فوتبالی‌ات را در وقت قانونی محک بزن" back tone="violet" eyebrow="DAILY QUIZ / EXTRA TIME"/>;

export function QuizPage() {
  const query = useQuery({ queryKey: ['activeQuiz'], queryFn: async () => (await api.get<Quiz>('/quizzes/active')).data, retry: 1 });
  const submit = useMutation({
    mutationFn: async (payload: { answers: { questionId: string; option: number }[]; durationMs: number }) => (await api.post<SubmitResult>(`/quizzes/${query.data?._id}/submit`, payload)).data,
    onError: error => toast.error((error as Error).message),
  });

  if (query.isLoading) return <>{quizHeader}<PageSkeleton/></>;
  if (query.error || !query.data) return <>{quizHeader}<main className="p-4"><ErrorState message={(query.error as Error)?.message || 'کوییز پیدا نشد'}/></main></>;

  const quiz = query.data;
  return <>
    <PageHeader title={quiz.title} subtitle="هر پاسخ درست، یک قدم تا صدر جدول" back tone="violet" eyebrow="DAILY QUIZ / EXTRA TIME"/>
    <main className="space-y-4 p-4">
      <div className="themed-filter flex items-center gap-3 rounded-[1.3rem] p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-300 text-[#10051d]"><CircleHelp size={19}/></span>
        <div className="min-w-0 flex-1"><span className="flex items-center gap-1 text-[7px] font-black tracking-[.15em] text-fuchsia-300" dir="ltr"><Sparkles size={10}/> KNOWLEDGE MATCH</span><p className="mt-1 truncate text-[9px] text-slate-400">با تمرکز بازی کن؛ زمان و پاسخ‌ها ثبت می‌شوند.</p></div>
      </div>
      {quiz.attempted && quiz.attempt ? <Card className="quiz-result overflow-hidden text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-cyan-300 text-[#10051d]"><Trophy size={25}/></span>
        <span className="mt-4 block text-[7px] font-black tracking-[.18em] text-violet-300" dir="ltr">FULL TIME RESULT</span>
        <p className="mt-1 text-xs text-slate-400">این کوییز را قبلاً انجام داده‌ای</p>
        <div className="mt-3 text-3xl font-black text-cyan-300">{faNumber(quiz.attempt.score)}</div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-300/[.09] px-3 py-2 text-[10px] text-emerald-200"><CheckCircle2 size={14}/>{faNumber(quiz.attempt.correctCount)} پاسخ صحیح</p>
      </Card> : <QuizRunner questions={quiz.questionIds} timerSeconds={quiz.timerSeconds} submitting={submit.isPending} onSubmit={async (answers, durationMs) => submit.mutateAsync({ answers, durationMs })}/>}
    </main>
  </>;
}
