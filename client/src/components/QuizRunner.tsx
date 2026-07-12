import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HelpCircle,
  Play,
  ShieldCheck,
  Trophy,
  XCircle,
} from 'lucide-react';
import { cn, faNumber } from '@/lib/utils';
import type { Question } from '@/types/api';
import { Card, LoadingButton } from './ui';

export interface SubmitResult {
  rank: number;
  feedback: { questionId: string; option: number; correct: boolean; score: number }[];
  attempt?: { score?: number; correctCount?: number };
  entry?: { score?: number; correctCount?: number };
}

interface QuizRunnerProps {
  questions: Question[];
  timerSeconds?: number;
  submitting: boolean;
  onSubmit: (
    answers: { questionId: string; option: number }[],
    durationMs: number,
  ) => Promise<SubmitResult>;
}

export function QuizRunner({ questions, timerSeconds, submitting, onSubmit }: QuizRunnerProps) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(timerSeconds ?? 0);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (!startedAt || !timerSeconds || result) return;
    const id = window.setInterval(() => {
      setRemaining(value => {
        if (value <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, timerSeconds, result]);

  const feedbackMap = useMemo(
    () => new Map(result?.feedback.map(feedback => [feedback.questionId, feedback]) ?? []),
    [result],
  );

  if (result) {
    const score = result.attempt?.score ?? result.entry?.score ?? result.feedback.reduce((sum, feedback) => sum + feedback.score, 0);
    const correct = result.attempt?.correctCount ?? result.entry?.correctCount ?? result.feedback.filter(feedback => feedback.correct).length;
    return <div className="space-y-4">
      <Card className="quiz-result overflow-hidden border-pitch-400/20 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.4rem] border border-pitch-300/20 bg-pitch-500/10 text-pitch-300 shadow-[0_0_35px_rgba(16,185,129,.12)]">
          <Trophy size={28}/>
        </div>
        <p className="mt-4 text-[10px] font-bold tracking-wider text-pitch-300">رتبه شما #{faNumber(result.rank)}</p>
        <h2 className="mt-1 text-xl font-black">نتیجه نهایی</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="surface-soft p-3"><div className="text-[10px] text-slate-400">امتیاز کسب‌شده</div><strong className="mt-1 block text-xl text-pitch-300">{faNumber(score)}</strong></div>
          <div className="surface-soft p-3"><div className="text-[10px] text-slate-400">پاسخ صحیح</div><strong className="mt-1 block text-xl">{faNumber(correct)} از {faNumber(questions.length)}</strong></div>
        </div>
      </Card>
      {questions.map((question, questionIndex) => {
        const feedback = feedbackMap.get(question._id);
        return <Card key={question._id} className={feedback?.correct ? 'border-pitch-400/20' : 'border-rose-400/20'}>
          <div className="flex gap-3">
            {feedback?.correct ? <CheckCircle2 className="shrink-0 text-pitch-300"/> : <XCircle className="shrink-0 text-rose-300"/>}
            <div>
              <p className="text-sm font-bold">{faNumber(questionIndex + 1)}. {question.text}</p>
              <p className="mt-2 text-xs text-slate-400">پاسخ شما: {question.options[feedback?.option ?? 0] ?? 'بدون پاسخ'}</p>
              {question.explanation && <p className="mt-2 text-xs leading-6 text-slate-300">{question.explanation}</p>}
            </div>
          </div>
        </Card>;
      })}
    </div>;
  }

  // Keep every question out of the rendered UI until the player explicitly starts.
  if (!startedAt) {
    return <Card className="quiz-start relative overflow-hidden border-pitch-400/20 p-5 text-center">
      <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-pitch-400/[.08] blur-3xl"/>
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.4rem] border border-pitch-300/20 bg-gradient-to-br from-pitch-400/15 to-sky-400/[.04] text-pitch-300 shadow-[0_14px_35px_rgba(0,0,0,.22)]">
          <ShieldCheck size={29}/>
        </div>
        <p className="mt-4 text-[10px] font-extrabold tracking-wide text-pitch-300">آماده رقابت هستی؟</p>
        <h2 className="mt-1 text-lg font-black">سؤال‌ها هنوز مخفی هستند</h2>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-slate-400">با شروع مسابقه، سؤال اول نمایش داده می‌شود و زمان پاسخ‌گویی آغاز خواهد شد.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 text-right">
          <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-3">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><HelpCircle size={13}/>تعداد سؤال</span>
            <strong className="mt-1.5 block text-sm">{faNumber(questions.length)} سؤال</strong>
          </div>
          <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-3">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 size={13}/>زمان پاسخ</span>
            <strong className="mt-1.5 block text-sm">{timerSeconds ? `${faNumber(timerSeconds)} ثانیه` : 'بدون محدودیت'}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setRemaining(timerSeconds ?? 0);
            setStartedAt(Date.now());
          }}
          className="btn-primary mt-4 w-full shadow-[0_12px_28px_rgba(16,185,129,.18)]"
        >
          <Play size={17} fill="currentColor"/>شروع مسابقه
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-slate-500"><ShieldCheck size={12}/>پاسخ‌ها فقط پس از ثبت نهایی بررسی می‌شوند</p>
      </div>
    </Card>;
  }

  const question = questions[index];
  const selectedOption = answers[question._id];
  const progress = ((index + 1) / questions.length) * 100;
  const answered = Object.keys(answers).length;
  const canSubmit = answered === questions.length;
  const timerCritical = Boolean(timerSeconds && remaining < 20);

  return <Card className="quiz-question overflow-hidden border-white/[.09] p-0">
    <div className="border-b border-white/[.06] bg-white/[.018] px-5 pb-4 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-pitch-300">سؤال {faNumber(index + 1)}</span>
          <span className="mx-1.5 text-slate-700">/</span>
          <span className="text-[10px] text-slate-500">{faNumber(questions.length)}</span>
        </div>
        {timerSeconds && <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.04] px-2.5 py-1.5 text-[10px] font-bold text-slate-300', timerCritical && 'border-rose-400/20 bg-rose-500/10 text-rose-300')}>
          <Clock3 size={13}/>{faNumber(remaining)} ثانیه
        </span>}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.055]">
        <div className="h-full rounded-full bg-gradient-to-l from-pitch-400 to-emerald-500 transition-[width] duration-500" style={{ width: `${progress}%` }}/>
      </div>
    </div>

    <div className="p-5">
      {question.category && <span className="inline-flex rounded-lg bg-sky-400/[.07] px-2 py-1 text-[9px] font-bold text-sky-300">{question.category}</span>}
      <h2 className="mt-3 text-[15px] font-extrabold leading-8 text-slate-50">{question.text}</h2>
      <div className="mt-5 space-y-2.5">
        {question.options.map((option, optionIndex) => {
          const selected = selectedOption === optionIndex;
          return <button
            type="button"
            key={`${question._id}-${optionIndex}`}
            onClick={() => setAnswers(current => ({ ...current, [question._id]: optionIndex }))}
            aria-pressed={selected}
            className={cn(
              'group flex min-h-[3.65rem] w-full items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.03] px-3.5 text-right text-sm font-semibold text-slate-200 transition duration-200 hover:border-white/[.14] hover:bg-white/[.05] active:scale-[.99]',
              selected && 'border-pitch-400/35 bg-pitch-500/[.09] text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,.04)]',
            )}
          >
            <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.04] text-[11px] text-slate-400 transition', selected && 'border-pitch-300/20 bg-pitch-400/15 text-pitch-200')}>
              {selected ? <Check size={15} strokeWidth={3}/> : faNumber(optionIndex + 1)}
            </span>
            <span className="flex-1">{option}</span>
          </button>;
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <button type="button" disabled={index === 0} onClick={() => setIndex(current => current - 1)} className="btn-secondary">
          <ChevronRight size={17}/>قبلی
        </button>
        {index < questions.length - 1
          ? <button type="button" disabled={selectedOption === undefined} onClick={() => setIndex(current => current + 1)} className="btn-primary">
              بعدی<ChevronLeft size={17}/>
            </button>
          : <LoadingButton
              disabled={!canSubmit || Boolean(timerSeconds && remaining === 0)}
              loading={submitting}
              onClick={async () => setResult(await onSubmit(
                Object.entries(answers).map(([questionId, option]) => ({ questionId, option })),
                Date.now() - startedAt,
              ))}
            >
              ثبت نهایی<CheckCircle2 size={17}/>
            </LoadingButton>}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-slate-500">
        <span>{faNumber(answered)} از {faNumber(questions.length)} پاسخ داده شده</span>
        <span className="h-1 w-1 rounded-full bg-slate-700"/>
        <span>انتخاب‌ها قابل ویرایش‌اند</span>
      </div>
    </div>
  </Card>;
}
