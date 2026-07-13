import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, Heart, ImagePlus, Laugh, LoaderCircle, MoreHorizontal, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { BrandMark } from '@/components/BrandMark';
import { WalletShortcut } from '@/components/WalletShortcut';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { FUN_IMAGE_ACCEPT, validateFunImageFile } from '@/lib/funImage';
import { impact, notify } from '@/lib/telegram';
import { cn, faNumber } from '@/lib/utils';
import type { FunFeedPage, FunPost } from '@/types/api';

const captionLimit = 600;

function relativeTime(value: string): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return 'همین الان';
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, 'day');
  return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function PostAvatar({ post }: { post: FunPost }) {
  return post.owner.photoUrl ? <img src={post.owner.photoUrl} alt="" className="h-10 w-10 rounded-2xl object-cover"/> : <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-300 to-violet-600 text-sm font-black text-ink-950">{post.owner.firstName.slice(0, 1)}</div>;
}

function FeedSkeleton() {
  return <div className="space-y-4">{[0, 1].map((item) => <Card key={item} className="space-y-3 p-3"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10"/><div className="flex-1 space-y-2"><Skeleton className="h-3 w-28"/><Skeleton className="h-2 w-16"/></div></div><Skeleton className="h-52 w-full"/><Skeleton className="h-10 w-full"/></Card>)}</div>;
}

function FunPostCard({ post, index, onLike, liking, onReport, reporting, onDelete, deleting }: { post: FunPost; index: number; onLike: () => void; liking: boolean; onReport: () => void; reporting: boolean; onDelete: () => void; deleting: boolean }) {
  return (
    <article className="fun-card overflow-hidden rounded-[1.65rem] border border-white/[.085] bg-ink-900/92 shadow-card" style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <PostAvatar post={post}/>
        <div className="min-w-0 flex-1"><h2 className="truncate text-xs font-black">{post.owner.firstName}</h2><p className="mt-1 truncate text-[9px] text-slate-500">{post.owner.clubName || 'باشگاه فوتبالی'} · {relativeTime(post.createdAt)}</p></div>
        {post.isOwner ? <button type="button" disabled={deleting} onClick={onDelete} aria-label="حذف پست" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-slate-500 transition active:scale-90 active:bg-rose-400/10 active:text-rose-300">{deleting ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button> : <button type="button" disabled={reporting} onClick={onReport} aria-label="گزارش پست" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-slate-500 transition active:scale-90 active:bg-white/[.05]">{reporting ? <LoaderCircle size={16} className="animate-spin"/> : <MoreHorizontal size={18}/>}</button>}
      </div>

      {post.caption && <p className="break-words whitespace-pre-wrap px-4 pb-3 text-[12px] leading-6 text-slate-200">{post.caption}</p>}
      {post.imageUrl && <div className="border-y border-white/[.055] bg-black/20"><img src={post.imageUrl} alt={post.caption || 'تصویر پست فان'} loading="lazy" className="max-h-[520px] w-full object-contain"/></div>}

      <div className="flex min-h-13 items-center justify-between px-3 py-2">
        <button type="button" onClick={onLike} disabled={liking} aria-pressed={post.liked} className={cn('fun-like flex min-h-10 items-center gap-2 rounded-2xl px-3 text-[10px] font-black transition active:scale-90', post.liked ? 'bg-rose-400/[.11] text-rose-300' : 'text-slate-400 active:bg-white/[.04]')}>
          {liking ? <LoaderCircle size={18} className="animate-spin"/> : <Heart size={18} fill={post.liked ? 'currentColor' : 'none'}/>}<span>{faNumber(post.likeCount)}</span>
        </button>
        <span className="flex items-center gap-1.5 text-[9px] text-slate-600"><Laugh size={13}/> فقط برای خنده</span>
      </div>
    </article>
  );
}

function CreatePostSheet({ onClose, onPublished }: { onClose: () => void; onPublished: () => Promise<void> }) {
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const publish = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      if (caption.trim()) body.append('caption', caption.trim());
      if (image) body.append('image', image);
      body.append('clientRequestId', requestId);
      return (await api.post<FunPost>('/fun/posts', body)).data;
    },
    onSuccess: async () => { notify('success'); toast.success('پست فان منتشر شد'); await onPublished(); onClose(); },
    onError: (error) => { notify('error'); toast.error((error as Error).message); }
  });

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const chooseImage = async (file?: File) => {
    if (!file) return;
    const error = await validateFunImageFile(file);
    if (error) { notify('error'); toast.error(error); if (inputRef.current) inputRef.current.value = ''; return; }
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };
  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null); setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };
  const canPublish = Boolean(caption.trim() || image) && caption.length <= captionLimit;

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ارسال پست فان" onMouseDown={(event) => { if (event.target === event.currentTarget && !publish.isPending) onClose(); }}>
      <div className="fun-sheet safe-bottom max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-ink-900 px-4 pb-4 pt-3">
        <div className="mx-auto max-w-xl">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15"/>
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black text-fuchsia-300">یه چیزی برای خندیدن داری؟</p><h2 className="mt-1 text-lg font-black">ارسال پست فان</h2></div><button type="button" disabled={publish.isPending} onClick={onClose} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[.055] text-slate-400 active:scale-90"><X size={19}/></button></div>

          <label className="mt-5 block"><span className="label">متن یا کپشن <span className="font-normal text-slate-600">(اختیاری)</span></span><textarea value={caption} onChange={(event) => setCaption(event.target.value.slice(0, captionLimit))} className="input min-h-28 resize-none leading-6" placeholder="چی شده؟ هوادارا رو بخندون..."/><span className={cn('mt-1.5 block text-left text-[9px]', caption.length >= captionLimit ? 'text-amber-300' : 'text-slate-600')} dir="ltr">{faNumber(caption.length)} / {faNumber(captionLimit)}</span></label>

          {preview ? (
            <div className="relative mt-3 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/25"><img src={preview} alt="پیش‌نمایش تصویر" className="max-h-72 w-full object-contain"/><button type="button" onClick={removeImage} className="absolute left-2 top-2 flex min-h-10 items-center gap-1.5 rounded-2xl bg-black/70 px-3 text-[9px] font-bold text-white backdrop-blur"><Trash2 size={14}/>حذف تصویر</button><label className="absolute bottom-2 right-2 flex min-h-10 cursor-pointer items-center gap-1.5 rounded-2xl bg-white/90 px-3 text-[9px] font-black text-ink-950"><Camera size={14}/>تعویض<input ref={inputRef} type="file" accept={FUN_IMAGE_ACCEPT} className="hidden" onChange={(event) => void chooseImage(event.target.files?.[0])}/></label></div>
          ) : (
            <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-fuchsia-300/20 bg-fuchsia-300/[.035] text-center transition active:scale-[.99] active:bg-fuchsia-300/[.07]"><ImagePlus size={22} className="text-fuchsia-300"/><span className="mt-2 text-[11px] font-black">افزودن یک تصویر</span><span className="mt-1 text-[8px] text-slate-500">JPG، PNG یا WEBP · حداکثر ۵ مگابایت</span><input ref={inputRef} type="file" accept={FUN_IMAGE_ACCEPT} className="hidden" onChange={(event) => void chooseImage(event.target.files?.[0])}/></label>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-300/[.055] p-3 text-[9px] leading-5 text-amber-100/70"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300"/>فقط عکس و متن مجاز است؛ ویدیو، GIF، صدا و فایل پذیرفته نمی‌شود.</div>
          <button type="button" disabled={!canPublish || publish.isPending} onClick={() => publish.mutate()} className="btn-primary mt-4 w-full bg-gradient-to-l from-fuchsia-400 to-violet-500 text-white shadow-lg shadow-fuchsia-500/10">{publish.isPending ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>} {publish.isPending ? 'در حال انتشار...' : 'انتشار در فان'}</button>
        </div>
      </div>
    </div>
  );
}

export function FunPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const feed = useInfiniteQuery({
    queryKey: ['funPosts'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await api.get<FunFeedPage>('/fun/posts', { params: { cursor: pageParam || undefined, limit: 10 } })).data,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined
  });
  const like = useMutation({ mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => api.put(`/fun/posts/${id}/like`, { liked }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funPosts'] }), onError: (error) => toast.error((error as Error).message) });
  const report = useMutation({ mutationFn: async (id: string) => api.post(`/fun/posts/${id}/report`, { reason: 'inappropriate' }), onSuccess: () => toast.success('گزارش برای بررسی مدیر ارسال شد'), onError: (error) => toast.error((error as Error).message) });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/fun/posts/${id}`), onSuccess: async () => { toast.success('پست حذف شد'); await queryClient.invalidateQueries({ queryKey: ['funPosts'] }); }, onError: (error) => toast.error((error as Error).message) });
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="fun-page pb-5">
      <header className="fun-hero safe-top relative overflow-hidden px-4 pb-7 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-35"/><div className="fun-orb absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/[.11] blur-3xl"/>
        <div className="relative flex items-center justify-between"><div className="flex items-center gap-3"><BrandMark className="h-11 w-11 text-fuchsia-300"/><div><p className="text-[9px] font-bold text-fuchsia-300">رختکن هوادارا</p><h1 className="mt-0.5 text-lg font-black">فان فوتبالی</h1></div></div><WalletShortcut/></div>
        <div className="relative mt-6 flex items-end justify-between gap-4"><div><div className="flex items-center gap-1.5 text-[9px] font-black text-amber-300"><Sparkles size={12}/> بخند، بساز، منتشر کن</div><h2 className="mt-1 text-xl font-black leading-8">فوتبال بدون کری،<br/><span className="text-fuchsia-300">اصلاً مزه نداره!</span></h2></div><button type="button" onClick={() => { impact(); setCreating(true); }} className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-l from-fuchsia-400 to-violet-500 px-4 text-[10px] font-black text-white shadow-lg shadow-fuchsia-500/15 transition active:scale-95"><Plus size={17}/>ارسال پست</button></div>
      </header>

      <div className="space-y-4 px-4 pt-5">
        {feed.isLoading ? <FeedSkeleton/> : feed.error ? <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()}/> : posts.length ? <>{posts.map((post, index) => <FunPostCard key={post._id} post={post} index={index} liking={like.isPending && like.variables?.id === post._id} onLike={() => { impact(); like.mutate({ id: post._id, liked: !post.liked }); }} reporting={report.isPending && report.variables === post._id} onReport={() => { if (confirm('این پست برای بررسی مدیر گزارش شود؟')) report.mutate(post._id); }} deleting={remove.isPending && remove.variables === post._id} onDelete={() => { if (confirm('پست فان شما حذف شود؟')) remove.mutate(post._id); }}/>) }{feed.hasNextPage && <button type="button" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()} className="btn-secondary w-full">{feed.isFetchingNextPage ? <LoaderCircle size={17} className="animate-spin"/> : null}{feed.isFetchingNextPage ? 'در حال دریافت...' : 'نمایش پست‌های بیشتر'}</button>}</> : <EmptyState title="فان هنوز سوت و کوره!" description="اولین میم فوتبالی باشگاه را تو منتشر کن." action={<button type="button" onClick={() => setCreating(true)} className="btn-primary bg-fuchsia-400 text-white"><ImagePlus size={17}/>ارسال پست فان</button>}/>} 
      </div>
      {creating && <CreatePostSheet onClose={() => setCreating(false)} onPublished={async () => { await queryClient.invalidateQueries({ queryKey: ['funPosts'] }); }}/>} 
    </main>
  );
}
