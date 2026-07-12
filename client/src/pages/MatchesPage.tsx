import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Match } from '@/types/api';
import { MatchCard } from '@/components/MatchCard';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
const tabs = [{v:'',l:'همه'},{v:'live',l:'زنده'},{v:'scheduled',l:'آینده'},{v:'finished',l:'نتایج'}];
export function MatchesPage() { const [status,setStatus]=useState(''); const query=useQuery({queryKey:['matches',status],queryFn:async()=>(await api.get<Match[]>('/matches',{params:{status:status||undefined}})).data,refetchInterval:status==='live'?30_000:false}); return <><PageHeader title="بازی‌های مهم" subtitle="پیش‌بینی، یادآوری و نتیجه بازی‌ها"/><main className="space-y-4 p-4"><div className="flex gap-2 overflow-x-auto scrollbar-none">{tabs.map(tab=><button key={tab.v} onClick={()=>setStatus(tab.v)} className={cn('chip shrink-0',status===tab.v&&'border-pitch-400/30 bg-pitch-500/10 text-pitch-300')}>{tab.l}</button>)}</div>{query.isLoading?<PageSkeleton/>:query.error?<ErrorState message={(query.error as Error).message} onRetry={()=>query.refetch()}/>:query.data?.length?<div className="space-y-3">{query.data.map(match=><MatchCard key={match._id} match={match}/>)}</div>:<EmptyState title="بازی‌ای در این بخش نیست" description="ادمین هنوز بازی‌ای با این وضعیت منتشر نکرده است."/>}</main></>; }
