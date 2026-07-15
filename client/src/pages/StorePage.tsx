import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock3,
  Coins,
  Gift,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingButton, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';
import type { CoinPackage, CoinTransaction, StoreData } from '@/types/api';

interface PurchaseIntentResponse {
  transaction: CoinTransaction;
  payment: { mode: 'test'; provider: 'test'; reference: string; message: string };
}

interface DemoCoinPackage {
  coins: number;
  title: string;
  description: string;
  demoPrice: number;
  featured?: boolean;
}

const demoCoinPackages: DemoCoinPackage[] = [
  { coins: 500, title: 'بسته بازی‌ساز', description: 'انتخاب نمایشی متعادل برای توسعه باشگاه', demoPrice: 179_000, featured: true },
  { coins: 100, title: 'شروع سریع', description: 'بسته کوچک برای اولین خرید آزمایشی', demoPrice: 49_000 },
  { coins: 1200, title: 'خزانه قهرمان', description: 'بیشترین سکه با قیمت نمایشی بهتر', demoPrice: 349_000 },
];

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

  if (store.isLoading) return <><PageHeader title="فروشگاه" subtitle="کیف پول و امکانات باشگاه" tone="mint" eyebrow="FFN STORE / CLUB SHOP"/><PageSkeleton/></>;
  if (store.error || !store.data) return <><PageHeader title="فروشگاه" subtitle="کیف پول و امکانات باشگاه" tone="mint" eyebrow="FFN STORE / CLUB SHOP"/><main className="p-4"><ErrorState message={(store.error as Error)?.message || 'فروشگاه در دسترس نیست'} onRetry={() => store.refetch()}/></main></>;

  const data = store.data;
  const rewardReady = data.dailyReward.claimable || !data.dailyReward.nextClaimAt || new Date(data.dailyReward.nextClaimAt).getTime() <= now;
  return <>
    <PageHeader title="فروشگاه" subtitle="سکه و کیف پول باشگاه" tone="mint" eyebrow="FFN STORE / CLUB SHOP"/>
    <main className="store-page space-y-5 overflow-x-hidden p-4 pb-8">
      <section className="store-hero" aria-labelledby="store-balance-title">
        <div className="store-hero-grid" aria-hidden="true"/>
        <div className="relative z-[1] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="store-kicker" dir="ltr">MATCHDAY WALLET</span>
            <h1 id="store-balance-title" className="mt-1 text-xs font-black text-slate-100">کیف پول باشگاه</h1>
          </div>
          <span className="store-dev-chip"><Zap size={10}/>پیش‌نمایش توسعه</span>
        </div>

        <div className="relative z-[1] mt-4 flex items-center gap-3">
          <span className="store-balance-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><Coins size={23}/></span>
          <div className="min-w-0 flex-1">
            <span className="block text-[7px] font-bold text-slate-400">موجودی فعلی</span>
            <div className="mt-1 flex items-baseline gap-1.5"><strong className="text-[1.75rem] font-black leading-none tracking-tight text-white">{faNumber(data.balance)}</strong><span className="text-[9px] font-black text-amber-300">سکه</span></div>
          </div>
          <ShieldCheck size={19} className="shrink-0 text-emerald-300/65"/>
        </div>

        <div className="store-daily-reward relative z-[1] mt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', rewardReady ? 'bg-emerald-300/[.12] text-emerald-300' : 'bg-white/[.045] text-slate-400')}><Gift size={17}/></span>
            <div className="min-w-0 flex-1"><span className="block text-[8px] font-black text-slate-200">جایزه روزانه</span><span className="mt-0.5 block truncate text-[6.5px] text-slate-500">{faNumber(data.dailyReward.amount)} سکه رایگان هر ۲۴ ساعت</span></div>
            <span className={cn('shrink-0 rounded-full px-2 py-1 text-[6px] font-black', rewardReady ? 'bg-emerald-300/[.1] text-emerald-200' : 'bg-white/[.04] text-slate-500')}>{rewardReady ? 'آماده دریافت' : 'در انتظار'}</span>
          </div>
          <LoadingButton disabled={!rewardReady} loading={claim.isPending} onClick={() => claim.mutate()} className={cn('store-daily-cta mt-3 w-full', !rewardReady && 'bg-white/[.055] text-slate-400')}>
            {rewardReady ? <><Sparkles size={15}/>دریافت جایزه روزانه</> : <><Clock3 size={14}/>جایزه بعدی: {countdown(data.dailyReward.nextClaimAt, now)}</>}
          </LoadingButton>
        </div>
      </section>

      <section aria-labelledby="coin-packages-title">
        <StoreSectionHeading id="coin-packages-title" icon={Coins} title="بسته‌های سکه" description="قیمت‌ها نمایشی‌اند؛ فقط بستهٔ فعال API قابل خرید آزمایشی است"/>
        <div className="store-coin-grid mt-3 grid grid-cols-2 gap-2.5">
          {demoCoinPackages.map(demoPackage => {
            const availablePackage = data.packages.find(item => item.coins === demoPackage.coins);
            return <CoinPackageCard
              key={demoPackage.coins}
              demoPackage={demoPackage}
              availablePackage={availablePackage}
              paymentMode={data.paymentMode}
              pending={purchase.isPending}
              onPurchase={coinPackage => purchase.mutate(coinPackage)}
            />;
          })}
        </div>
      </section>
    </main>

    {pendingPurchase && <div className="fixed inset-0 z-[80] flex items-end bg-black/75 p-0 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setPendingPurchase(null); }}>
      <div className="broadcast-sheet safe-bottom relative w-full rounded-t-[2rem] p-4">
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"><LockKeyhole size={22}/></div><button type="button" onClick={() => setPendingPurchase(null)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[.05]" aria-label="بستن"><X size={18}/></button></div>
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

function StoreSectionHeading({ id, icon: Icon, title, description }: { id: string; icon: LucideIcon; title: string; description: string }) {
  return <div className="flex items-end justify-between gap-3 px-0.5">
    <div className="min-w-0"><span className="store-kicker" dir="ltr">DEVELOPMENT SHOWCASE</span><h2 id={id} className="mt-1 text-sm font-black tracking-tight">{title}</h2><p className="mt-1 truncate text-[7.5px] text-slate-500">{description}</p></div>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/[.1] bg-cyan-300/[.055] text-cyan-200"><Icon size={16}/></span>
  </div>;
}

function CoinPackageCard({ demoPackage, availablePackage, featured = demoPackage.featured ?? false, paymentMode, pending, onPurchase }: { demoPackage: DemoCoinPackage; availablePackage?: CoinPackage; featured?: boolean; paymentMode: StoreData['paymentMode']; pending: boolean; onPurchase: (coinPackage: CoinPackage) => void }) {
  const purchasable = Boolean(availablePackage && paymentMode === 'test');
  const displayPrice = availablePackage?.price ?? demoPackage.demoPrice;
  return <article className={cn('store-coin-card relative min-w-0', featured && 'store-coin-featured col-span-2')}>
    <div className="flex items-start justify-between gap-2">
      <span className="store-coin-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Coins size={19}/></span>
      <span className={cn('rounded-full px-2 py-1 text-[6px] font-black', featured ? 'bg-amber-300 text-amber-950' : purchasable ? 'bg-emerald-300/[.1] text-emerald-200' : 'bg-white/[.045] text-slate-500')}>{featured ? 'پرفروش‌ترین' : purchasable ? 'خرید آزمایشی' : 'به‌زودی'}</span>
    </div>
    <div className="mt-3"><h3 className="text-[9px] font-black text-slate-200">{demoPackage.title}</h3><div className="mt-1 flex items-baseline gap-1"><strong className="text-xl font-black leading-none text-white">{faNumber(demoPackage.coins)}</strong><span className="text-[7px] font-black text-amber-300">سکه</span></div><p className="mt-2 line-clamp-2 min-h-8 text-[6.5px] leading-4 text-slate-500">{demoPackage.description}</p></div>
    <div className="mt-2 flex items-end justify-between gap-2"><span><small className="block text-[5.5px] text-slate-600">قیمت {availablePackage ? 'فعلی' : 'نمایشی'}</small><strong className="mt-0.5 block whitespace-nowrap text-[8px] text-slate-200">{toman(displayPrice)}</strong></span><ShoppingBag size={13} className="shrink-0 text-amber-300/60"/></div>
    <button type="button" disabled={!purchasable || pending} onClick={() => availablePackage && onPurchase(availablePackage)} className={cn('store-buy-button mt-3 min-h-9 w-full rounded-xl text-[8px] font-black', purchasable && 'is-available')}>
      {purchasable ? 'خرید آزمایشی' : 'به‌زودی'}
    </button>
  </article>;
}
