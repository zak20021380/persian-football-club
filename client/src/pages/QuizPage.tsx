import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Quiz } from '@/types/api';
import { PageHeader } from '@/components/PageHeader';
import { QuizRunner, type SubmitResult } from '@/components/QuizRunner';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { faNumber } from '@/lib/utils';
export function QuizPage(){const query=useQuery({queryKey:['activeQuiz'],queryFn:async()=>(await api.get<Quiz>('/quizzes/active')).data,retry:1});const submit=useMutation({mutationFn:async(payload:{answers:{questionId:string;option:number}[];durationMs:number})=>(await api.post<SubmitResult>(`/quizzes/${query.data?._id}/submit`,payload)).data,onError:e=>toast.error((e as Error).message)});if(query.isLoading)return <PageSkeleton/>;if(query.error||!query.data)return <><PageHeader title="کوییز روزانه" back/><div className="p-4"><ErrorState message={(query.error as Error)?.message||'کوییز پیدا نشد'}/></div></>;const quiz=query.data;return <><PageHeader title={quiz.title} subtitle="کوییز روزانه" back/><main className="space-y-4 p-4">{quiz.attempted&&quiz.attempt?<Card className="text-center"><p className="text-xs text-slate-400">این کوییز را قبلاً انجام داده‌ای</p><div className="mt-3 text-3xl font-black text-pitch-300">{faNumber(quiz.attempt.score)}</div><p className="mt-1 text-xs">{faNumber(quiz.attempt.correctCount)} پاسخ صحیح</p></Card>:<QuizRunner questions={quiz.questionIds} timerSeconds={quiz.timerSeconds} submitting={submit.isPending} onSubmit={async(answers,durationMs)=>submit.mutateAsync({answers,durationMs})}/>}</main></>}
