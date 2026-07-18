import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Copy,
  Eye,
  Flag,
  Heart,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  PenLine,
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
import { isDemoDataEnabled } from '@/lib/featureFlags';
import { copyText, shareMemeFallback } from '@/lib/share';
import { canUseNativeTelegramShare, impact, notify, sharePreparedTelegramMessage } from '@/lib/telegram';
import { cn, faNumber } from '@/lib/utils';
import type { FunFeedPage, FunPost, Id } from '@/types/api';

const captionLimit = 600;

type FunSort = 'newest' | 'mostLiked' | 'oldest';

const FUN_SORT_OPTIONS: ReadonlyArray<{ value: FunSort; label: string; icon: typeof ArrowDownNarrowWide }> = [
  { value: 'newest', label: 'جدیدترین', icon: ArrowDownNarrowWide },
  { value: 'mostLiked', label: 'محبوب‌ترین', icon: Heart },
  { value: 'oldest', label: 'قدیمی‌ترین', icon: ArrowUpNarrowWide }
];

function compareForSort(a: { createdAt: string; likeCount: number }, b: { createdAt: string; likeCount: number }, sort: FunSort): number {
  if (sort === 'mostLiked') {
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  const direction = sort === 'oldest' ? 1 : -1;
  return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
}

function isFunSort(value: string | null | undefined): value is FunSort {
  return value === 'newest' || value === 'mostLiked' || value === 'oldest';
}

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

type FunCategory = 'فوتبال ایران' | 'فان' | 'تیم ملی' | 'دربی' | 'بازیکنان' | 'لیگ برتر';

type FunPostWithMeta = FunPost & {
  category: FunCategory;
  commentCount: number;
  shareCount: number;
  viewCount: number;
};

const categoryStyles: Record<FunCategory, string> = {
  'فوتبال ایران': 'border-emerald-300/25 bg-emerald-400/[.08] text-emerald-200',
  'فان': 'border-fuchsia-300/25 bg-fuchsia-400/[.08] text-fuchsia-200',
  'تیم ملی': 'border-amber-300/25 bg-amber-400/[.08] text-amber-200',
  'دربی': 'border-rose-300/25 bg-rose-400/[.08] text-rose-200',
  'بازیکنان': 'border-sky-300/25 bg-sky-400/[.08] text-sky-200',
  'لیگ برتر': 'border-violet-300/25 bg-violet-400/[.08] text-violet-200',
};

function mockMemeLink(id: string): string {
  const link = new URL('/fun', window.location.origin);
  link.searchParams.set('mock', id);
  return link.toString();
}

const mockMemes: FunPostWithMeta[] = [
  {
    _id: 'mock-fun-1' as Id,
    caption: 'وقتی تیمت دقیقه ۹۰ گل می‌خوره و تو از تلویزیون فقط نگاه می‌کنی 😭\nهیچ کاری نمی‌تونی بکنی، فقط می‌شینی و تماشا می‌کنی چطور همه چیز خراب می‌شه. این حس رو فقط یه هوادار واقعی درکش می‌کنه.',
    likeCount: 1284,
    shareUrl: mockMemeLink('mock-fun-1'),
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
    _id: 'mock-fun-2' as Id,
    caption: 'من بعد از بستن میکس ۲۰ تایی 🤡\nیه لحظه فکر می‌کنی همه چیز روبلدی، یه لحظه بعد می‌بینی ۱۸ تاش غلط بوده و تنها دو تاش درست.',
    likeCount: 942,
    shareUrl: mockMemeLink('mock-fun-2'),
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
    _id: 'mock-fun-3' as Id,
    caption: 'داور وقتی VAR به نفع تیم ماست 😎\nمعلوم نیست چرا همیشه وقتی سود ما توش نیست، صدای اعتراض همه بلنده. ولی وقتی به نفع ماست، همه چیز کاملا قانونیه.',
    likeCount: 2104,
    shareUrl: mockMemeLink('mock-fun-3'),
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
    _id: 'mock-fun-4' as Id,
    caption: 'هوادار قبل و بعد از بازی 😅\nقبلش پر از انرژی و شعار. بعدش ساکت، خسته و فقط امیدوار به بازی بعد. هواداری یعنی همین رفت و برگشت بی‌پایان.',
    likeCount: 3567,
    shareUrl: mockMemeLink('mock-fun-4'),
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
    _id: 'mock-fun-5' as Id,
    caption: 'وقتی مربی میگه تاکتیک داشتیم 🧠\nیعنی نقشه‌هایی کشیده که هیچ‌کس توی زمین نمی‌فهمه. بعد بازی همه با تعجب به هم نگاه می‌کنن که واقعا چی شد.',
    likeCount: 786,
    shareUrl: mockMemeLink('mock-fun-5'),
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
    _id: 'mock-fun-6' as Id,
    caption: 'فقط یه بازی ساده بود… 💥\nولی هر دفعه که فکر می‌کنی همه چیز عادیه، یه اتفاق می‌افته که تا هفته بعد زبانزد همه می‌شه.',
    likeCount: 1640,
    shareUrl: mockMemeLink('mock-fun-6'),
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

const avatarPalette = [
  'from-fuchsia-400 to-violet-600',
  'from-sky-400 to-cyan-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-600',
  'from-rose-400 to-pink-600',
  'from-indigo-400 to-blue-600',
];

function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

function FunPostCard({
  post,
  index,
  onLike,
  liking,
  onDelete,
  deleting,
  onReport,
  reporting,
  onShare,
  sharing,
  highlighted,
}: {
  post: FunPostWithMeta;
  index: number;
  onLike: () => void;
  liking: boolean;
  onDelete: () => void;
  deleting: boolean;
  onReport: () => void;
  reporting: boolean;
  onShare: () => void;
  sharing: boolean;
  highlighted: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tone = useMemo(() => avatarTone(`${post._id}:${post.owner._id}`), [post._id, post.owner._id]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleCopy = async () => {
    setMenuOpen(false);
    try {
      await copyText(post.caption ?? '');
      toast.success('متن کپی شد');
    } catch {
      toast.error('کپی انجام نشد');
    }
  };

  const initial = post.owner.firstName.replace(/\s+/g, '').slice(0, 1) || '؟';

  return (
    <article
      id={`fun-post-${post._id}`}
      aria-label={`پست فان از ${post.owner.firstName}`}
      className={cn(
        'fun-card fun-post-card relative overflow-hidden rounded-[1.35rem] border bg-ink-900/94 transition',
        highlighted ? 'border-fuchsia-300/55 ring-1 ring-fuchsia-300/25' : 'border-white/[.07]'
      )}
      style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}
    >
      <header className="fun-post-header flex items-center gap-2.5 px-3.5 py-2.5">
        <span aria-hidden="true" className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/[.08] bg-gradient-to-br text-[12px] font-black text-ink-950', tone)}>
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[12px] font-black leading-4 text-white">{post.owner.firstName}</h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[8.5px] text-slate-500">
            <span className="truncate">{post.owner.clubName || 'باشگاه فوتبالی'}</span>
            <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-white/20"/>
            <time dateTime={post.createdAt} className="shrink-0">{relativeTime(post.createdAt)}</time>
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
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="grid h-9 w-9 place-items-center rounded-2xl text-slate-400 transition hover:bg-white/[.05] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/40 active:scale-90"
          >
            <MoreHorizontal size={17} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+4px)] z-20 w-44 origin-top-left overflow-hidden rounded-2xl border border-white/10 bg-ink-900/98 p-1 shadow-[0_18px_40px_rgba(0,0,0,.35)] backdrop-blur"
            >
              <button
                type="button"
                role="menuitem"
                disabled={sharing}
                onClick={() => { setMenuOpen(false); onShare(); }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-slate-200 transition hover:bg-white/[.05] focus-visible:outline-none focus-visible:bg-white/[.06] active:scale-[.98] disabled:opacity-50"
              >
                {sharing ? <LoaderCircle size={13} className="animate-spin text-fuchsia-300" /> : <Share2 size={13} className="text-fuchsia-300" />}
                {sharing ? 'در حال آماده‌سازی...' : 'اشتراک‌گذاری'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { void handleCopy(); }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-slate-200 transition hover:bg-white/[.05] focus-visible:outline-none focus-visible:bg-white/[.06] active:scale-[.98]"
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
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-rose-300 transition hover:bg-rose-400/10 focus-visible:outline-none focus-visible:bg-rose-400/15 active:scale-[.98] disabled:opacity-50"
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
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[9.5px] font-bold text-amber-200 transition hover:bg-amber-400/10 focus-visible:outline-none focus-visible:bg-amber-400/15 active:scale-[.98] disabled:opacity-50"
                >
                  {reporting ? <LoaderCircle size={13} className="animate-spin" /> : <Flag size={13} />}
                  گزارش پست
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {post.caption && (
        <div className="fun-post-body px-4 pt-1 pb-3">
          <span className={cn('mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7.5px] font-black sm:hidden', categoryStyles[post.category])}>
            {post.category}
          </span>
          <p className="fun-post-caption break-words whitespace-pre-wrap text-[12.5px] font-medium leading-[1.85] text-slate-100">
            {post.caption}
          </p>
        </div>
      )}

      <div className="fun-post-actions flex items-center justify-between border-t border-white/[.06] px-1.5 py-1.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onLike}
            disabled={liking}
            aria-pressed={post.liked}
            aria-label={post.liked ? 'برداشتن لایک' : 'لایک کردن'}
            className={cn(
              'fun-like flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35 active:scale-90',
              post.liked
                ? 'bg-rose-400/[.14] text-rose-200 hover:bg-rose-400/[.18]'
                : 'text-slate-300 hover:bg-white/[.05] hover:text-rose-200'
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
            aria-label="نمایش نظرات"
            className="flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black text-slate-300 transition hover:bg-white/[.05] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 active:scale-90"
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            <span>{formatCount(post.commentCount)}</span>
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={sharing}
            aria-label="اشتراک‌گذاری"
            className="flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black text-slate-300 transition hover:bg-white/[.05] hover:text-fuchsia-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/35 active:scale-90 disabled:cursor-wait disabled:opacity-60"
          >
            {sharing ? <LoaderCircle size={14} className="animate-spin" /> : <Share2 size={14} strokeWidth={1.8} />}
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

function FeedSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="در حال بارگذاری پست‌ها">
      {[0, 1].map(item => (
        <Card key={item} className="space-y-3 p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
        </Card>
      ))}
    </div>
  );
}

function CreatePostSheet({ onClose, onPublished }: { onClose: () => void; onPublished: () => Promise<void> }) {
  const [caption, setCaption] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const publish = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      if (caption.trim()) body.append('caption', caption.trim());
      body.append('clientRequestId', requestId);
      return (await api.post<FunPost>('/fun/posts', body)).data;
    },
    onSuccess: async () => { notify('success'); toast.success('پست فان منتشر شد'); await onPublished(); onClose(); },
    onError: (error) => { notify('error'); toast.error((error as Error).message); }
  });

  const remaining = captionLimit - caption.length;
  const canPublish = caption.trim().length > 0 && remaining >= 0;
  const close = () => { if (!publish.isPending) onClose(); };

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="fun-create-title" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="fun-sheet safe-bottom max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-ink-900 px-4 pb-4 pt-3">
        <div className="mx-auto max-w-xl">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true"/>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-fuchsia-300">یه چیزی برای گفتن داری؟</p>
              <h2 id="fun-create-title" className="mt-1 text-lg font-black">ارسال پست فان</h2>
            </div>
            <button type="button" disabled={publish.isPending} onClick={close} aria-label="بستن" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[.055] text-slate-400 transition hover:bg-white/[.08] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/40 active:scale-90">
              <X size={19} />
            </button>
          </div>

          <label className="mt-5 block">
            <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">متن پست</span>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value.slice(0, captionLimit))}
              className="input mt-1.5 min-h-32 resize-none leading-7 text-[12px]"
              placeholder="چی شده؟ هوادارا رو سرگرم کن…"
              maxLength={captionLimit}
            />
            <span className={cn('mt-1.5 block text-left text-[9px]', remaining <= 30 ? 'text-amber-300' : 'text-slate-500')} dir="ltr">
              {faNumber(caption.length)} / {faNumber(captionLimit)}
            </span>
          </label>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-sky-300/[.12] bg-sky-400/[.04] p-3 text-[9px] leading-5 text-sky-100/75">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-sky-300" />
            پست‌های فان فقط متنی هستند. لطفاً متنی محترمانه و مرتبط با فضای فوتبالی منتشر کنید.
          </div>
          <button
            type="button"
            disabled={!canPublish || publish.isPending}
            onClick={() => publish.mutate()}
            className="fun-create-cta mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[10.5px] font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/40 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-300 disabled:shadow-none"
          >
            {publish.isPending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
            <span>{publish.isPending ? 'در حال انتشار…' : 'انتشار در فان'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FunSortBar({ value, onChange, disabled }: { value: FunSort; onChange: (next: FunSort) => void; disabled?: boolean }) {
  return (
    <div
      role="tablist"
      aria-label="مرتب‌سازی پست‌ها"
      className="flex min-w-0 items-center gap-1 rounded-2xl border border-white/[.07] bg-ink-900/85 p-1 shadow-[0_6px_18px_rgba(0,0,0,.18)] backdrop-blur"
    >
      {FUN_SORT_OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const isActive = value === option;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => { if (!isActive) onChange(option); }}
            className={cn(
              'fun-sort-tab flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[9.5px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
              isActive
                ? 'bg-gradient-to-b from-fuchsia-400/25 to-violet-500/10 text-white shadow-[inset_0_1px_0_rgba(244,114,182,.18),0_4px_14px_rgba(217,70,239,.18)]'
                : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-200'
            )}
          >
            <Icon size={13} className={cn('shrink-0', isActive ? 'text-fuchsia-200' : 'text-slate-500')} strokeWidth={isActive ? 2.4 : 1.8} />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FunPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [localLikes, setLocalLikes] = useState<Record<string, { liked: boolean; likeCount: number }>>({});
  const [localShareCounts, setLocalShareCounts] = useState<Record<string, number>>({});
  const [sharingPostId, setSharingPostId] = useState<string | null>(null);
  const shareLock = useRef(false);
  const deepLinkedPostId = searchParams.get('post');
  const validDeepLinkedPostId = deepLinkedPostId && /^[a-f\d]{24}$/i.test(deepLinkedPostId) ? deepLinkedPostId : null;
  const sortParam = searchParams.get('sort');
  const sort: FunSort = isFunSort(sortParam) ? sortParam : 'newest';
  const setSort = (next: FunSort) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'newest') params.delete('sort');
    else params.set('sort', next);
    setSearchParams(params, { replace: true });
  };

  const feed = useInfiniteQuery({
    queryKey: ['funPosts', sort],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await api.get<FunFeedPage>('/fun/posts', { params: { cursor: pageParam || undefined, limit: 10, sort } })).data,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    placeholderData: keepPreviousData,
    staleTime: 15_000
  });
  const deepLinkedPost = useQuery({
    queryKey: ['funPost', validDeepLinkedPostId],
    enabled: Boolean(validDeepLinkedPostId),
    retry: false,
    queryFn: async () => (await api.get<FunPost>(`/fun/posts/${validDeepLinkedPostId}`)).data
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

  useEffect(() => {
    if (!validDeepLinkedPostId || !deepLinkedPost.data) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`fun-post-${validDeepLinkedPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [deepLinkedPost.data, validDeepLinkedPostId]);

  const deepLinkErrorShown = useRef<string | null>(null);
  useEffect(() => {
    if (!validDeepLinkedPostId || !deepLinkedPost.error || deepLinkErrorShown.current === validDeepLinkedPostId) return;
    deepLinkErrorShown.current = validDeepLinkedPostId;
    toast.error('این پست حذف شده یا دیگر قابل نمایش نیست');
  }, [deepLinkedPost.error, validDeepLinkedPostId]);

  const feedPosts = feed.data?.pages.flatMap(page => page.items) ?? [];
  const realPosts = deepLinkedPost.data && !feedPosts.some(post => post._id === deepLinkedPost.data._id)
    ? [deepLinkedPost.data, ...feedPosts]
    : feedPosts;
  const useMockFeed = isDemoDataEnabled() && !validDeepLinkedPostId && !feed.isLoading && !feed.error && realPosts.length === 0;
  const posts: FunPostWithMeta[] = useMockFeed
    ? mockMemes
        .map(meme => {
          const local = localLikes[meme._id];
          return {
            ...meme,
            liked: local?.liked ?? meme.liked,
            likeCount: local?.likeCount ?? meme.likeCount,
            shareCount: localShareCounts[meme._id] ?? meme.shareCount
          };
        })
        .sort((a, b) => compareForSort(a, b, sort))
    : realPosts.map(post => ({
        ...post,
        category: 'فان' as FunCategory,
        commentCount: 0,
        shareCount: localShareCounts[post._id] ?? post.shareCount,
        viewCount: Math.max(post.likeCount * 8, 24),
      }));

  const toggleLike = (post: FunPostWithMeta) => {
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

  const sharePost = async (post: FunPostWithMeta) => {
    if (shareLock.current) return;
    shareLock.current = true;
    impact('light');
    setSharingPostId(post._id);
    try {
      const isMock = post._id.startsWith('mock-fun-');
      if (!isMock && canUseNativeTelegramShare()) {
        const prepared = (await api.post<{ preparedMessageId: string; completionToken: string }>(`/fun/posts/${post._id}/share/prepare`)).data;
        const result = await sharePreparedTelegramMessage(prepared.preparedMessageId);
        if (result.status === 'cancelled') {
          toast('اشتراک‌گذاری لغو شد', { icon: 'ℹ️' });
          return;
        }
        if (result.status === 'failed') {
          notify('error');
          toast.error('اشتراک‌گذاری پست در تلگرام انجام نشد');
          return;
        }

        let completion: { shareCount: number } | undefined;
        for (let attempt = 0; attempt < 2 && !completion; attempt += 1) {
          try {
            completion = (await api.post<{ shareCount: number }>(`/fun/posts/${post._id}/share/complete`, {
              completionToken: prepared.completionToken
            })).data;
          } catch { /* Retry once; the Telegram share itself has already succeeded. */ }
        }
        if (completion) setLocalShareCounts(current => ({ ...current, [post._id]: completion.shareCount }));
        notify('success');
        toast.success('پست با موفقیت در تلگرام به اشتراک گذاشته شد');
        if (!completion) toast.error('اشتراک انجام شد، اما ثبت شمارنده ناموفق بود');
        return;
      }

      const shareData = {
        title: 'فان فوتبالی',
        text: post.caption ?? 'یک پست فان فوتبالی برای تو',
        url: post.shareUrl
      };
      const fallbackResult = await shareMemeFallback(shareData);
      if (fallbackResult === 'shared') {
        notify('success');
        toast.success('اشتراک‌گذاری پست انجام شد');
        return;
      }
      notify('success');
      toast.success('لینک پست کپی شد');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast('اشتراک‌گذاری لغو شد', { icon: 'ℹ️' });
      } else {
        notify('error');
        toast.error((error as Error).message || 'اشتراک‌گذاری پست انجام نشد');
      }
    } finally {
      shareLock.current = false;
      setSharingPostId(null);
    }
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
              <Sparkles size={12} /> بخند، بنویس، منتشر کن
            </div>
            <h2 className="mt-1 text-xl font-black leading-8">
              فوتبال بدون کری،<br />
              <span className="text-fuchsia-300">اصلاً مزه نداره!</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => { impact(); setCreating(true); }}
            className="fun-cta flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-l from-fuchsia-400 to-violet-500 px-4 text-[10.5px] font-black text-white shadow-lg shadow-fuchsia-500/15 transition active:scale-95"
          >
            <PenLine size={16} />ارسال پست
          </button>
        </div>
      </header>

      <div className="space-y-4 px-3.5 pt-5 sm:px-4">
        {useMockFeed && (
          <div className="flex items-center justify-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[.06] px-3 py-1 text-[8.5px] font-black text-amber-200">
            <Sparkles size={10} />
            نمایش آزمایشی · ۶ پست متنی نمونه برای ارزیابی ظاهر
          </div>
        )}

        <FunSortBar value={sort} onChange={setSort} disabled={feed.isFetching && !feed.data} />

        {feed.isLoading || (validDeepLinkedPostId && deepLinkedPost.isLoading) ? (
          <FeedSkeleton />
        ) : feed.error ? (
          <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()} />
        ) : posts.length ? (
          <>
            {posts.map((post, index) => (
              <FunPostCard
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
                sharing={sharingPostId === post._id}
                onShare={() => { void sharePost(post); }}
                highlighted={post._id === validDeepLinkedPostId}
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
            description="اولین پست متنی فوتبالی باشگاه را تو منتشر کن."
            action={
              <button type="button" onClick={() => setCreating(true)} className="btn-primary bg-gradient-to-l from-fuchsia-400 to-violet-500 text-white">
                <PenLine size={17} />ارسال پست فان
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
