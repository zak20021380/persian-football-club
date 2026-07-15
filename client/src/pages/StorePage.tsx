import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Coins, Gift, History, LockKeyhole, ShieldCheck, ShoppingBag, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState, ErrorState, LoadingButton, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber, tehranDate } from '@/lib/utils';
import type { CoinPackage, CoinTransaction, StoreData } from '@/types/api';

interface PurchaseIntentResponse {
  transaction: CoinTransaction;
  payment: { mode: 'test'; provider: 'test'; reference: string; message: string };
}

const toman = (value: number) => `${faNumber(value)} تومان`;

function countdown(target: string | null, now: number): string {
  if (!target) return 'آماده دریافت';
  const difference = Math.max(0, new Date(target).getTime() - now);
  if (!difference) return 'آماده دریافت';
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  const seconds = Math.floor((difference % 60_000) / 1000);
  const twoDigits = new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
  return `${twoDigits.format(hours)}:${twoDigits.format(minutes)}:${twoDigits.format(seconds)}`;
}

export function StorePage() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(0);
  const [pendingPurchase, setPendingPurchase] = useState<PurchaseIntentResponse | null>(null);
  const store = useQuery({ queryKey: ['store'], queryFn: async () => (await api.get<StoreData>('/store')).data });

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(initialTick); window.clearInterval(interval); };
  }, []);

  const refreshStore = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['store'] }),
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] }),
    ]);
  };
  const claim = useMutation({
    mutationFn: async () => (await api.post('/store/daily-reward')).data,
    onSuccess: async () => { toast.success('جایزه روزانه به کیف پولت اضافه شد'); await refreshStore(); },
    onError: error => toast.error((error as Error).message),
  });
  const purchase = useMutation({
    mutationFn: async (coinPackage: CoinPackage) => (await api.post<PurchaseIntentResponse>('/store/purchases', { packageId: coinPackage._id, clientRequestId: crypto.randomUUID() })).data,
    onSuccess: response => setPendingPurchase(response),
    onError: error => toast.error((error as Error).message),
  });
  const confirm = useMutation({
    mutationFn: async (transactionId: string) => (await api.post(`/store/purchases/${transactionId}/test-confirm`)).data,
    onSuccess: async () => { setPendingPurchase(null); toast.success('خرید آزمایشی تکمیل و سکه‌ها اضافه شدند'); await refreshStore(); },
    onError: error => toast.error((error as Error).message),
  });

  if (store.isLoading) return <><PageHeader title="فروشگاه" subtitle="کیف پول و بسته‌های سکه" tone="amber" eyebrow="CLUB STORE / WALLET"/><PageSkeleton/></>;
  if (store.error || !store.data) return <><PageHeader title="فروشگاه" subtitle="کیف پول و بسته‌های سکه" tone="amber" eyebrow="CLUB STORE / WALLET"/><main className="p-4"><ErrorState message={(store.error as Error)?.message || 'فروشگاه در دسترس نیست'} onRetry={() => store.refetch()}/></main></>;

  const data = store.data;
  const rewardReady = data.dailyReward.claimable || !data.dailyReward.nextClaimAt || new Date(data.dailyReward.nextClaimAt).getTime() <= now;
  return <>
    <PageHeader title="فروشگاه" subtitle="سکه بیشتر، امکانات بیشتر" tone="amber" eyebrow="CLUB STORE / WALLET"/>
    <main className="store-page space-y-5 overflow-x-hidden p-4">
      <Card className="store-wallet relative overflow-hidden border-amber-300/[.18] p-5">
        <div className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-amber-300/[.12] blur-3xl"/>
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-200/70"><ShieldCheck size={13}/>موجودی امن کیف پول</span>
            <div className="mt-2 flex items-end gap-2"><strong className="text-3xl font-black tracking-tight text-white">{faNumber(data.balance)}</strong><span className="pb-1 text-xs font-bold text-amber-300">سکه</span></div>
            <p className="mt-2 text-[9px] text-slate-500">تمام تراکنش‌ها در تاریخچه ثبت می‌شوند</p>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] border border-amber-200/20 bg-gradient-to-br from-amber-200/20 to-orange-400/[.06] text-amber-300 shadow-[0_16px_35px_rgba(245,158,11,.12)]"><Coins size={30}/></div>
        </div>
      </Card>

      <Card className={cn('relative overflow-hidden p-4', rewardReady ? 'border-pitch-400/20' : 'border-white/[.08]')}>
        <div className="flex items-center gap-3">
          <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', rewardReady ? 'bg-pitch-400/10 text-pitch-300' : 'bg-white/[.045] text-slate-400')}><Gift size={23}/></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-sm font-black">هدیه روزانه</h2>{rewardReady && <span className="rounded-full bg-pitch-400/10 px-2 py-1 text-[8px] font-bold text-pitch-300">آماده</span>}</div><p className="mt-1 text-[10px] text-slate-400">هر ۲۴ ساعت، {faNumber(data.dailyReward.amount)} سکه رایگان</p></div>
        </div>
        <LoadingButton disabled={!rewardReady} loading={claim.isPending} onClick={() => claim.mutate()} className={cn('mt-4 w-full', !rewardReady && 'bg-white/[.06] text-slate-400')}>
          {rewardReady ? <><Sparkles size={17}/>دریافت {faNumber(data.dailyReward.amount)} سکه رایگان</> : <><Clock3 size={16}/>{countdown(data.dailyReward.nextClaimAt, now)}</>}
        </LoadingButton>
      </Card>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-black">بسته‌های سکه</h2><p className="mt-1 text-[9px] text-slate-500">فقط سکه؛ بدون آیتم تصادفی</p></div><ShoppingBag size={18} className="text-amber-300"/></div>
        {data.packages.length ? <div className="grid grid-cols-2 gap-2.5">
          {data.packages.map((coinPackage, packageIndex) => <CoinPackageCard key={coinPackage._id} coinPackage={coinPackage} featured={packageIndex === 1} paymentMode={data.paymentMode} pending={purchase.isPending} onPurchase={() => purchase.mutate(coinPackage)}/>) }
        </div> : <EmptyState title="بسته‌ای موجود نیست" description="بسته‌های جدید سکه به‌زودی در فروشگاه قرار می‌گیرند."/>}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><History size={17} className="text-slate-400"/><h2 className="font-black">تاریخچه تراکنش‌ها</h2></div>
        {data.transactions.length ? <Card className="divide-y divide-white/[.06] p-0">{data.transactions.map(transaction => <TransactionRow key={transaction._id} transaction={transaction}/>)}</Card> : <EmptyState title="هنوز تراکنشی نداری" description="هدیه روزانه یا خریدهای سکه اینجا نمایش داده می‌شوند."/>}
      </section>
    </main>

    {pendingPurchase && <div className="fixed inset-0 z-[80] flex items-end bg-black/75 p-0 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setPendingPurchase(null); }}>
      <div className="broadcast-sheet safe-bottom relative w-full rounded-t-[2rem] p-4">
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"><LockKeyhole size={22}/></div><button type="button" onClick={() => setPendingPurchase(null)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[.05]"><X size={18}/></button></div>
          <h2 className="mt-4 text-lg font-black">تأیید پرداخت آزمایشی</h2>
          <p className="mt-2 text-xs leading-6 text-slate-400">{pendingPurchase.payment.message}</p>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.035] p-4"><span className="text-xs text-slate-400">{pendingPurchase.transaction.packageTitle}</span><strong className="text-amber-300">+{faNumber(pendingPurchase.transaction.coins)} سکه</strong></div>
          <LoadingButton loading={confirm.isPending} onClick={() => confirm.mutate(pendingPurchase.transaction._id)} className="mt-4 w-full"><CheckCircle2 size={18}/>تکمیل خرید آزمایشی</LoadingButton>
          <p className="mt-3 text-center text-[9px] text-slate-500">هیچ وجه واقعی جابه‌جا نمی‌شود</p>
        </div>
      </div>
    </div>}
  </>;
}

function CoinPackageCard({ coinPackage, featured, paymentMode, pending, onPurchase }: { coinPackage: CoinPackage; featured: boolean; paymentMode: StoreData['paymentMode']; pending: boolean; onPurchase: () => void }) {
  const discount = coinPackage.originalPrice && coinPackage.originalPrice > coinPackage.price ? Math.round((1 - coinPackage.price / coinPackage.originalPrice) * 100) : 0;
  return <Card className={cn('relative min-w-0 overflow-hidden p-3.5', featured && 'border-amber-300/25 bg-gradient-to-b from-amber-300/[.07] to-ink-900')}>
    {(coinPackage.badge || discount > 0) && <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-amber-300 px-2 py-1 text-[8px] font-black text-amber-950">{coinPackage.badge || `${faNumber(discount)}٪ تخفیف`}</span>}
    <div className="mt-5 grid h-11 w-11 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><Coins size={21}/></div>
    <h3 className="mt-3 truncate text-xs font-extrabold text-slate-200">{coinPackage.title}</h3>
    <div className="mt-1 flex items-baseline gap-1"><strong className="text-xl font-black text-white">{faNumber(coinPackage.coins)}</strong><span className="text-[9px] font-bold text-amber-300">سکه</span></div>
    <div className="mt-3 min-h-9"><strong className="block text-[11px]">{toman(coinPackage.price)}</strong>{coinPackage.originalPrice && coinPackage.originalPrice > coinPackage.price && <del className="mt-0.5 block text-[8px] text-slate-600">{toman(coinPackage.originalPrice)}</del>}</div>
    <button type="button" disabled={pending || paymentMode === 'unavailable'} onClick={onPurchase} className={cn('btn-primary mt-3 min-h-10 w-full px-2 py-2 text-[10px]', featured && 'bg-amber-300 text-amber-950')}>
      {paymentMode === 'test' ? 'خرید آزمایشی' : 'درگاه به‌زودی'}
    </button>
  </Card>;
}

function TransactionRow({ transaction }: { transaction: CoinTransaction }) {
  const completed = transaction.status === 'completed';
  const label = transaction.type === 'daily_reward' ? 'هدیه روزانه' : transaction.packageTitle || 'خرید سکه';
  const status = ({ pending: 'در انتظار پرداخت', processing: 'در حال پردازش', completed: 'تکمیل‌شده', failed: 'ناموفق' } as const)[transaction.status];
  return <div className="flex min-w-0 items-center gap-3 p-4">
    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', transaction.type === 'daily_reward' ? 'bg-pitch-400/10 text-pitch-300' : 'bg-amber-300/10 text-amber-300')}>{transaction.type === 'daily_reward' ? <Gift size={18}/> : <Coins size={18}/>}</span>
    <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold">{label}</h3><p className="mt-1 truncate text-[8px] text-slate-500">{tehranDate(transaction.createdAt)} · {status}</p></div>
    <strong className={cn('shrink-0 text-xs', completed ? 'text-pitch-300' : 'text-slate-500')}>+{faNumber(transaction.coins)}</strong>
  </div>;
}
