import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Flag, Laugh, LoaderCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { useBootstrap } from '@/hooks/useBootstrap';
import { api } from '@/lib/api';
import { cn, faNumber, tehranDate } from '@/lib/utils';

interface ModerationPost {
  _id: string;
  caption?: string;
  imageUrl?: string;
  reportCount: number;
  likeCount: number;
  moderationStatus: 'published' | 'hidden';
  createdAt: string;
  ownerId?: { firstName: string; lastName?: string; username?: string; photoUrl?: string };
}
interface ModerationResponse { items: ModerationPost[]; total: number; page: number; pages: number }

export function FunModerationPage() {
  const bootstrap = useBootstrap();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['funModeration'], queryFn: async () => (await api.get<ModerationResponse>('/fun/moderation/posts', { params: { reported: true, limit: 50 } })).data, enabled: Boolean(bootstrap.data?.isAdmin) });
  const moderate = useMutation({ mutationFn: async ({ id, moderationStatus }: { id: string; moderationStatus: 'published' | 'hidden' }) => api.patch(`/fun/moderation/posts/${id}`, { moderationStatus }), onSuccess: async () => { toast.success('وضعیت پست به‌روزرسانی شد'); await queryClient.invalidateQueries({ queryKey: ['funModeration'] }); await queryClient.invalidateQueries({ queryKey: ['funPosts'] }); }, onError: (error) => toast.error((error as Error).message) });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/fun/moderation/posts/${id}`), onSuccess: async () => { toast.success('پست برای همیشه حذف شد'); await queryClient.invalidateQueries({ queryKey: ['funModeration'] }); await queryClient.invalidateQueries({ queryKey: ['funPosts'] }); }, onError: (error) => toast.error((error as Error).message) });

  if (bootstrap.isLoading) return <PageSkeleton/>;
  if (!bootstrap.data?.isAdmin) return <Navigate to="/" replace/>;
  return (
    <>
      <PageHeader title="مدیریت فان" subtitle="بررسی پست‌های گزارش‌شده" back admin/>
      <main className="space-y-4 p-4">
        <Card className="flex items-center gap-3 border-fuchsia-300/15 bg-fuchsia-300/[.045]"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-fuchsia-300/[.1] text-fuchsia-300"><Flag size={19}/></span><div><p className="text-[10px] text-slate-400">صف بررسی</p><strong className="text-lg">{faNumber(query.data?.total ?? 0)} گزارش</strong></div></Card>
        {query.isLoading ? <PageSkeleton/> : query.error ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()}/> : query.data?.items.length ? query.data.items.map((post) => (
          <Card key={post._id} className="overflow-hidden p-0">
            {post.imageUrl && <img src={post.imageUrl} alt="" className="max-h-64 w-full object-contain bg-black/20"/>}
            <div className="p-4">
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-xs font-black">{post.ownerId?.firstName || 'کاربر باشگاه'} {post.ownerId?.lastName}</h2><p className="mt-1 text-[9px] text-slate-500">{tehranDate(post.createdAt)}</p></div><span className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-400/[.1] px-3 py-1.5 text-[9px] font-black text-rose-300"><Flag size={12}/>{faNumber(post.reportCount)} گزارش</span></div>
              {post.caption && <p className="mt-3 break-words whitespace-pre-wrap text-[11px] leading-6 text-slate-300">{post.caption}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: post._id, moderationStatus: post.moderationStatus === 'published' ? 'hidden' : 'published' })} className={cn('btn-secondary px-2 text-[10px]', post.moderationStatus === 'published' ? 'text-amber-300' : 'text-emerald-300')}>{moderate.isPending && moderate.variables?.id === post._id ? <LoaderCircle size={16} className="animate-spin"/> : post.moderationStatus === 'published' ? <EyeOff size={16}/> : <Eye size={16}/>} {post.moderationStatus === 'published' ? 'مخفی‌کردن' : 'بازگردانی'}</button>
                <button type="button" disabled={remove.isPending} onClick={() => { if (confirm('این پست و تصویر آن برای همیشه حذف شود؟')) remove.mutate(post._id); }} className="btn-secondary px-2 text-[10px] text-rose-300">{remove.isPending && remove.variables === post._id ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}حذف کامل</button>
              </div>
            </div>
          </Card>
        )) : <EmptyState title="صف گزارش‌ها خالی است" description="در حال حاضر پست گزارش‌شده‌ای برای بررسی وجود ندارد." action={<Laugh className="text-fuchsia-300"/>}/>} 
      </main>
    </>
  );
}
