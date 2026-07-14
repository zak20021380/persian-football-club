import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  Copy,
  Eye,
  Flag,
  Heart,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BrandMark } from '@/components/BrandMark';
import { WalletShortcut } from '@/components/WalletShortcut';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { FUN_IMAGE_ACCEPT, validateFunImageFile } from '@/lib/funImage';
import { impact, notify } from '@/lib/telegram';
import { cn, faNumber } from '@/lib/utils';
import type { FunFeedPage, FunPost, Id } from '@/types/api';

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

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${faNumber((value / 1_000_000).toFixed(1).replace(/\.0$/, ''))} میلیون`;
  if (value >= 10_000) return `${faNumber(Math.round(value / 1000))} هزار`;
  if (value >= 1_000) return `${faNumber((value / 1000).toFixed(1).replace(/\.0$/, ''))} هزار`;
  return faNumber(value);
}

type MemePost = FunPost & {
  category: MemeCategory;
  commentCount: number;
  shareCount: number;
  viewCount: number;
};

type MemeCategory = 'فوتبال ایران' | 'فان' | 'تیم ملی' | 'دربی' | 'بازیکنان' | 'لیگ برتر';

const categoryStyles: Record<MemeCategory, string> = {
  'فوتبال ایران': 'border-pitch-400/30 bg-pitch-500/10 text-pitch-300',
  'فان': 'border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200',
  'تیم ملی': 'border-amber-300/30 bg-amber-400/10 text-amber-200',
  'دربی': 'border-rose-300/30 bg-rose-400/10 text-rose-200',
  'بازیکنان': 'border-sky-300/30 bg-sky-400/10 text-sky-200',
  'لیگ برتر': 'border-violet-300/30 bg-violet-400/10 text-violet-200',
};

const imagePrompt = (text: string) =>
  encodeURIComponent(`${text}, Persian football meme illustration, vibrant colors, clean cartoon style, dramatic stadium lighting, no text overlay, high quality`);

const memeImage = (prompt: string) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${imagePrompt(prompt)}&image_size=portrait_4_3`;

const mockMemes: MemePost[] = [
  {
    _id: 'mock-meme-1' as Id,
    caption: 'وقتی تیمت دقیقه ۹۰ گل می‌خوره 😭',
    imageUrl: memeImage('A Persian football fan holding head in both hands crying at a stadium, dramatic night lights, teammates losing in background, cartoon meme style, vibrant colors'),
    likeCount: 1284,
    liked: false,
    isOwner: false,
    createdAt: new Date(Date.now() - 7 * 60_000).toISOString(),
    owner: { _id: 'm-1' as Id, firstName: 'علیرضا پرسپولیسی', clubName: 'پرسپولیس' },
    category: 'فوتبال ایران',
    commentCount: 56,
    shareCount: 23,
    viewCount: 8420,
  },
  {
    _id: 'mock-meme-2' as Id,
    caption: 'من بعد از بستن میکس ۲۰ تایی 🤡',
    imageUrl: memeImage('A person sitting on a couch staring at a phone with a shocked and devastated expression, dark living room, single lamp light, Persian meme cartoon style, vibrant colors'),
    likeCount: 942,
    liked: true,
    isOwner: true,
    createdAt: new Date(Date.now() - 38 * 60_000).toISOString(),
    owner: { _id: 'm-2' as Id, firstName: 'استقلالی دربی‌کار', clubName: 'استقلال' },
    category: 'فان',
    commentCount: 31,
    shareCount: 12,
    viewCount: 5210,
  },
  {
    _id: 'mock-meme-3' as Id,
    caption: 'داور وقتی VAR به نفع تیم ماست 😎',
    imageUrl: memeImage('A referee in a black uniform pointing at a VAR monitor with a confident thumbs up, Iranian football stadium with cheering fans, cartoon meme style, vibrant colors, dynamic pose'),
    likeCount: 2104,
    liked: false,
    isOwner: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    owner: { _id: 'm-3' as Id, firstName: 'سپاهانی قدیمی', clubName: 'سپاهان' },
    category: 'دربی',
    commentCount: 88,
    shareCount: 41,
    viewCount: 12130,
  },
  {
    _id: 'mock-meme-4' as Id,
    caption: 'هوادار قبل و بعد از بازی 😅',
    imageUrl: memeImage('Split scene comic: left side a cheerful Persian football fan with team scarf smiling confidently before match, right side the same fan sitting alone looking heartbroken and tired after match, cartoon meme style, vibrant colors'),
    likeCount: 3567,
    liked: false,
    isOwner: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
    owner: { _id: 'm-4' as Id, firstName: 'تراکتوری وفادار', clubName: 'تراکتور' },
    category: 'فوتبال ایران',
    commentCount: 142,
    shareCount: 87,
    viewCount: 19840,
  },
  {
    _id: 'mock-meme-5' as Id,
    caption: 'وقتی مربی میگه تاکتیک داشتیم 🧠',
    imageUrl: memeImage('A football coach in a suit drawing chaotic arrows and shapes on a whiteboard, confused players in background scratching their heads, locker room setting, cartoon meme style, vibrant colors'),
    likeCount: 786,
    liked: false,
    isOwner: false,
    createdAt: new Date(Date.now() - 22 * 60 * 60_000).toISOString(),
    owner: { _id: 'm-5' as Id, firstName: 'فولادی خوزستانی', clubName: 'فولاد' },
    category: 'بازیکنان',
    commentCount: 24,
    shareCount: 9,
    viewCount: 3940,
  },
  {
    _id: 'mock-meme-6' as Id,
    caption: 'فقط یه بازی ساده بود... 💥',
    imageUrl: memeImage('Dramatic football match scene with the ball just crossing the goal line, goalkeeper diving, players celebrating, confetti, Persian football style cartoon illustration, vibrant colors, dynamic action'),
    likeCount: 1640,
    liked: false,
    isOwner: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
    owner: { _id: 'm-6' as Id, firstName: 'ذوب‌آهنی اصفهانی', clubName: 'ذوب‌آهن' },
    category: 'لیگ برتر',
    commentCount: 67,
    shareCount: 33,
    viewCount: 9870,
  },
];

function MemeCard({
  post,
  index,
  onLike,
  liking,
  onDelete,
  deleting,
  onReport,
  reporting,
}: {
  post: MemePost;
  index: number;
  onLike: () => void;
  liking: boolean;
  onDelete: () => void;
  deleting: boolean;
  onReport: () => void;
  reporting: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleShare = async () => {
    setMenuOpen(false);
    const shareData = { title: 'فان فوتبالی', text: post.caption ?? 'یه میم باحال از فان فوتبالی' };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('اشتراک‌گذاری انجام شد');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(post.caption ?? '');
        toast.success('کپشن کپی شد');
      }
    } catch {
      toast('اشتراک‌گذاری لغو شد', { icon: 'ℹ️' });
    }
  };

  const handleCopy = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(post.caption ?? '');
      toast.success('متن کپی شد');
    } catch {
      toast.error('کپی انجام نشد');
    }
  };

  return (
    <article
      className="fun-card rounded-[1.4rem] border border-white/[.08] bg-ink-900/92 shadow-[0_10px_28px_rgba(0,0,0,.22)]"
      style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <PostAvatar post={post} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[11.5px] font-black leading-4 text-white">{post.owner.firstName}</h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[8.5px] text-slate-500">
            <span className="truncate">{post.owner.clubName || 'باشگاه فوتبالی'}</span>
            <span className="text-white/15">·</span>
            <span className="shrink-0">{relativeTime(post.createdAt)}</span>
          </p>
        </div>
        <span className={cn('hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[7.5px] font-black sm:inline-flex', categoryStyles[post.category])}>
          {post.category}
        </span>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            aria-label="منوی بیشتر"
            aria-expanded={menuOpen}
            className="grid h-9 w-9 place-items-center rounded-2xl text-slate-400 transition active:scale-90 active:bg-white/[.06]"
          >
            <MoreHorizontal size={17} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+4px)] z-20 w-40 origin-top-left overflow-hidden rounded-2xl border border-white/10 bg-ink-900/98 p-1 shadow-[0_18px_40px_rgba(0,0,0,.35)] backdrop-blur"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); void handleShare(); }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-slate-200 transition active:scale-[.98] active:bg-white/[.06]"
              >
                <Share2 size={13} className="text-pitch-300" />
                اشتراک‌گذاری
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { void handleCopy(); }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-slate-200 transition active:scale-[.98] active:bg-white/[.06]"
              >
                <Copy size={13} className="text-sky-300" />
                کپی متن
              </button>
              {post.isOwner ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={deleting}
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-rose-300 transition active:scale-[.98] active:bg-rose-400/10 disabled:opacity-50"
                >
                  {deleting ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  حذف پست
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={reporting}
                  onClick={() => { setMenuOpen(false); onReport(); }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-amber-200 transition active:scale-[.98] active:bg-amber-400/10 disabled:opacity-50"
                >
                  {reporting ? <LoaderCircle size={13} className="animate-spin" /> : <Flag size={13} />}
                  گزارش پست
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {post.imageUrl && (
        <div className="relative overflow-hidden border-y border-white/[.06] bg-black/35">
          <div className="relative h-[200px] w-full overflow-hidden sm:h-[230px]">
            <img
              src={post.imageUrl}
              alt={post.caption || 'تصویر میم'}
              loading="lazy"
              className="h-full w-full object-cover object-center"
            />
            <span className={cn('absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7.5px] font-black backdrop-blur-md sm:hidden', categoryStyles[post.category])}>
              {post.category}
            </span>
          </div>
        </div>
      )}

      {post.caption && (
        <p className="break-words whitespace-pre-wrap px-3.5 py-3 text-[11.5px] leading-6 text-slate-100">
          {post.caption}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-white/[.06] px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onLike}
            disabled={liking}
            aria-pressed={post.liked}
            className={cn(
              'fun-like flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black transition active:scale-90',
              post.liked ? 'bg-rose-400/[.12] text-rose-300' : 'text-slate-300 active:bg-white/[.05]'
            )}
          >
            {liking
              ? <LoaderCircle size={15} className="animate-spin" />
              : <Heart size={15} fill={post.liked ? 'currentColor' : 'none'} strokeWidth={post.liked ? 2 : 1.8} />}
            <span>{formatCount(post.likeCount)}</span>
          </button>
          <button
            type="button"
            onClick={() => toast('به‌زودی فعال می‌شود', { icon: '💬' })}
            className="flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black text-slate-300 transition active:scale-90 active:bg-white/[.05]"
            aria-label="نمایش نظرات"
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            <span>{formatCount(post.commentCount)}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black text-slate-300 transition active:scale-90 active:bg-white/[.05]"
            aria-label="اشتراک‌گذاری"
          >
            <Share2 size={14} strokeWidth={1.8} />
            <span>{formatCount(post.shareCount)}</span>
          </button>
        </div>
        <span className="flex items-center gap-1 pr-1 text-[9px] font-bold text-slate-500" title={`${faNumber(post.viewCount)} بازدید`}>
          <Eye size={12} />
          {formatCount(post.viewCount)}
        </span>
      </div>
    </article>
  );
}

function PostAvatar({ post }: { post: FunPost }) {
  return post.owner.photoUrl
    ? <img src={post.owner.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-2xl border border-white/10 object-cover" />
    : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-300 to-violet-600 text-[12px] font-black text-ink-950">
        {post.owner.firstName.slice(0, 1)}
      </div>;
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map(item => (
        <Card key={item} className="space-y-3 p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <Skeleton className="h-[200px] w-full sm:h-[230px]" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ))}
    </div>
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
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-fuchsia-300">یه چیزی برای خندیدن داری؟</p>
              <h2 className="mt-1 text-lg font-black">ارسال پست فان</h2>
            </div>
            <button type="button" disabled={publish.isPending} onClick={onClose} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[.055] text-slate-400 active:scale-90">
              <X size={19} />
            </button>
          </div>

          <label className="mt-5 block">
            <span className="label">متن یا کپشن <span className="font-normal text-slate-600">(اختیاری)</span></span>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value.slice(0, captionLimit))} className="input min-h-28 resize-none leading-6" placeholder="چی شده؟ هوادارا رو بخندون..." />
            <span className={cn('mt-1.5 block text-left text-[9px]', caption.length >= captionLimit ? 'text-amber-300' : 'text-slate-600')} dir="ltr">{faNumber(caption.length)} / {faNumber(captionLimit)}</span>
          </label>

          {preview ? (
            <div className="relative mt-3 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/25">
              <div className="w-full" style={{ aspectRatio: '4 / 5' }}>
                <img src={preview} alt="پیش‌نمایش تصویر" className="h-full w-full object-cover" />
              </div>
              <button type="button" onClick={removeImage} className="absolute left-2 top-2 flex min-h-10 items-center gap-1.5 rounded-2xl bg-black/70 px-3 text-[9px] font-bold text-white backdrop-blur">
                <Trash2 size={14} />حذف تصویر
              </button>
              <label className="absolute bottom-2 right-2 flex min-h-10 cursor-pointer items-center gap-1.5 rounded-2xl bg-white/90 px-3 text-[9px] font-black text-ink-950">
                <Camera size={14} />تعویض
                <input ref={inputRef} type="file" accept={FUN_IMAGE_ACCEPT} className="hidden" onChange={(event) => void chooseImage(event.target.files?.[0])} />
              </label>
            </div>
          ) : (
            <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-fuchsia-300/20 bg-fuchsia-300/[.035] text-center transition active:scale-[.99] active:bg-fuchsia-300/[.07]">
              <ImagePlus size={22} className="text-fuchsia-300" />
              <span className="mt-2 text-[11px] font-black">افزودن یک تصویر</span>
              <span className="mt-1 text-[8px] text-slate-500">JPG، PNG یا WEBP · حداکثر ۵ مگابایت</span>
              <input ref={inputRef} type="file" accept={FUN_IMAGE_ACCEPT} className="hidden" onChange={(event) => void chooseImage(event.target.files?.[0])} />
            </label>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-300/[.055] p-3 text-[9px] leading-5 text-amber-100/70">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
            فقط عکس و متن مجاز است؛ ویدیو، GIF، صدا و فایل پذیرفته نمی‌شود.
          </div>
          <button
            type="button"
            disabled={!canPublish || publish.isPending}
            onClick={() => publish.mutate()}
            className="btn-primary mt-4 w-full bg-gradient-to-l from-fuchsia-400 to-violet-500 text-white shadow-lg shadow-fuchsia-500/10"
          >
            {publish.isPending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
            {publish.isPending ? 'در حال انتشار...' : 'انتشار در فان'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FunPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [localLikes, setLocalLikes] = useState<Record<string, { liked: boolean; likeCount: number }>>({});

  const feed = useInfiniteQuery({
    queryKey: ['funPosts'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await api.get<FunFeedPage>('/fun/posts', { params: { cursor: pageParam || undefined, limit: 10 } })).data,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined
  });

  const like = useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => api.put(`/fun/posts/${id}/like`, { liked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funPosts'] }),
    onError: (error) => toast.error((error as Error).message)
  });
  const report = useMutation({
    mutationFn: async (id: string) => api.post(`/fun/posts/${id}/report`, { reason: 'inappropriate' }),
    onSuccess: () => toast.success('گزارش برای بررسی مدیر ارسال شد'),
    onError: (error) => toast.error((error as Error).message)
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/fun/posts/${id}`),
    onSuccess: async () => { toast.success('پست حذف شد'); await queryClient.invalidateQueries({ queryKey: ['funPosts'] }); },
    onError: (error) => toast.error((error as Error).message)
  });

  const realPosts = feed.data?.pages.flatMap(page => page.items) ?? [];
  const useMockFeed = !feed.isLoading && !feed.error && realPosts.length === 0;
  const posts: MemePost[] = useMockFeed
    ? mockMemes.map(meme => {
        const local = localLikes[meme._id];
        if (!local) return meme;
        return { ...meme, liked: local.liked, likeCount: local.likeCount };
      })
    : realPosts.map(post => ({
        ...post,
        category: 'فان' as MemeCategory,
        commentCount: 0,
        shareCount: 0,
        viewCount: Math.max(post.likeCount * 8, 24),
      }));

  const toggleLike = (post: MemePost) => {
    impact();
    if (useMockFeed) {
      setLocalLikes(prev => {
        const current = prev[post._id] ?? { liked: post.liked, likeCount: post.likeCount };
        const liked = !current.liked;
        return { ...prev, [post._id]: { liked, likeCount: Math.max(0, current.likeCount + (liked ? 1 : -1)) } };
      });
      return;
    }
    like.mutate({ id: post._id, liked: !post.liked });
  };

  return (
    <main className="fun-page pb-10">
      <header className="fun-hero safe-top relative overflow-hidden px-4 pb-7 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-35" />
        <div className="fun-orb absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/[.11] blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-11 w-11 text-fuchsia-300" />
            <div>
              <p className="text-[9px] font-bold text-fuchsia-300">رختکن هوادارا</p>
              <h1 className="mt-0.5 text-lg font-black">فان فوتبالی</h1>
            </div>
          </div>
          <WalletShortcut />
        </div>
        <div className="relative mt-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-300">
              <Sparkles size={12} /> بخند، بساز، منتشر کن
            </div>
            <h2 className="mt-1 text-xl font-black leading-8">
              فوتبال بدون کری،<br />
              <span className="text-fuchsia-300">اصلاً مزه نداره!</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => { impact(); setCreating(true); }}
            className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-l from-fuchsia-400 to-violet-500 px-4 text-[10px] font-black text-white shadow-lg shadow-fuchsia-500/15 transition active:scale-95"
          >
            <Plus size={17} />ارسال پست
          </button>
        </div>
      </header>

      <div className="space-y-4 px-3.5 pt-5 sm:px-4">
        {useMockFeed && (
          <div className="flex items-center justify-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[.06] px-3 py-1 text-[8.5px] font-black text-amber-200">
            <Sparkles size={10} />
            نمایش آزمایشی · ۶ میم نمونه برای ارزیابی ظاهر
          </div>
        )}

        {feed.isLoading ? (
          <FeedSkeleton />
        ) : feed.error ? (
          <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()} />
        ) : posts.length ? (
          <>
            {posts.map((post, index) => (
              <MemeCard
                key={post._id}
                post={post}
                index={index}
                liking={!useMockFeed && like.isPending && like.variables?.id === post._id}
                onLike={() => toggleLike(post)}
                reporting={!useMockFeed && report.isPending && report.variables === post._id}
                onReport={() => {
                  if (confirm('این پست برای بررسی مدیر گزارش شود؟')) report.mutate(post._id);
                }}
                deleting={!useMockFeed && remove.isPending && remove.variables === post._id}
                onDelete={() => {
                  if (confirm('پست فان شما حذف شود؟')) remove.mutate(post._id);
                }}
              />
            ))}
            {!useMockFeed && feed.hasNextPage && (
              <button
                type="button"
                disabled={feed.isFetchingNextPage}
                onClick={() => feed.fetchNextPage()}
                className="btn-secondary w-full"
              >
                {feed.isFetchingNextPage ? <LoaderCircle size={17} className="animate-spin" /> : null}
                {feed.isFetchingNextPage ? 'در حال دریافت...' : 'نمایش پست‌های بیشتر'}
              </button>
            )}
          </>
        ) : (
          <EmptyState
            title="فان هنوز سوت و کوره!"
            description="اولین میم فوتبالی باشگاه را تو منتشر کن."
            action={
              <button type="button" onClick={() => setCreating(true)} className="btn-primary bg-fuchsia-400 text-white">
                <ImagePlus size={17} />ارسال پست فان
              </button>
            }
          />
        )}
      </div>

      {creating && (
        <CreatePostSheet
          onClose={() => setCreating(false)}
          onPublished={async () => { await queryClient.invalidateQueries({ queryKey: ['funPosts'] }); }}
        />
      )}
    </main>
  );
}
