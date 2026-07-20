import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Gift,
  LockKeyhole,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CoinIcon } from '@/components/CoinIcon';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingButton, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { isDemoDataEnabled } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
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

const enNumber = (value: number) => value.toLocaleString('en-US');

function countdown(target: string | null, now: number): string {
  if (!target) return 'آماده دریافت';
  const difference = Math.max(0, new Date(target).getTime() - now);
  if (!difference) return 'آماده دریافت';
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  const seconds = Math.floor((difference % 60_000) / 1000);
  const twoDigits = (unit: number) => String(unit).padStart(2, '0');
  return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
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
  const demoMode = isDemoDataEnabled();
  const packageCards = demoMode
    ? demoCoinPackages.map(demoPackage => ({ demoPackage, availablePackage: data.packages.find(item => item.coins === demoPackage.coins) }))
    : data.packages.map(availablePackage => ({
        demoPackage: { coins: availablePackage.coins, title: availablePackage.title, description: availablePackage.badge ?? '', demoPrice: availablePackage.price },
        availablePackage
      }));
  const nextClaimTime = data.dailyReward.nextClaimAt ? new Date(data.dailyReward.nextClaimAt).getTime() : 0;
  const rewardReady = data.dailyReward.claimable || !nextClaimTime || nextClaimTime <= now;
  const rewardProgress = rewardReady || !now ? 1 : Math.max(0.03, Math.min(1, 1 - (nextClaimTime - now) / 86_400_000));
  return <>
    <PageHeader title="فروشگاه" subtitle="سکه و کیف پول باشگاه" tone="mint" eyebrow="FFN STORE / CLUB SHOP"/>
    <main className="store-page space-y-5 overflow-x-hidden p-4 pb-8">
      <section className="store-wallet" aria-labelledby="store-balance-title">
        <div className="store-wallet-glow" aria-hidden="true"/>
        <div className="relative flex items-center justify-between gap-3">
          <h1 id="store-balance-title" className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <span className="h-1 w-1 rounded-full bg-amber-300"/>کیف پول باشگاه
          </h1>
          {demoMode
            ? <span className="store-dev-chip"><Zap size={10}/>پیش‌نمایش توسعه</span>
            : <span className="store-wallet-mark" dir="ltr">FFN&nbsp;PAY</span>}
        </div>

        <div className="relative mt-6 flex items-center gap-4">
          <span className="store-coin-halo relative grid shrink-0 place-items-center"><CoinIcon size={44}/></span>
          <div className="min-w-0 flex-1">
            <span className="block text-[8px] font-bold text-slate-500">موجودی فعلی</span>
            <div className="mt-1 flex items-baseline gap-2" dir="ltr">
              <strong className="store-balance-figure text-[2.6rem] font-black leading-none tracking-tight tabular-nums">{enNumber(data.balance)}</strong>
              <span className="text-[10px] font-bold text-amber-200/70">COIN</span>
            </div>
          </div>
        </div>

        <div className="store-wallet-divider relative mt-6" aria-hidden="true"/>

        <div className="relative mt-4 flex min-w-0 items-center gap-3">
          <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition-colors', rewardReady ? 'border-amber-300/25 bg-gradient-to-b from-amber-300/[.14] to-amber-300/[.03] text-amber-300' : 'border-white/[.07] bg-white/[.03] text-slate-500')}>
            <Gift size={18}/>
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[9.5px] font-black text-slate-100">جایزه روزانه</span>
            <span className="mt-1 block truncate text-[8px] text-slate-500"><span dir="ltr" className="tabular-nums">{enNumber(data.dailyReward.amount)}</span> سکه رایگان، هر ۲۴ ساعت</span>
          </div>
          {rewardReady ? (
            <LoadingButton loading={claim.isPending} onClick={() => claim.mutate()} className="store-claim-button shrink-0">دریافت</LoadingButton>
          ) : (
            <span className="store-countdown-chip shrink-0" dir="ltr">
              <span className="block text-center text-[6.5px] font-bold tracking-[.14em] text-slate-500">NEXT CLAIM</span>
              <span className="mt-0.5 block text-center text-[12px] font-black tabular-nums text-slate-100">{countdown(data.dailyReward.nextClaimAt, now)}</span>
            </span>
          )}
        </div>
        {!rewardReady && (
          <div className="store-reward-track relative mt-3.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rewardProgress * 100)} aria-label="زمان باقی‌مانده تا جایزه بعدی">
            <span className="store-reward-fill" style={{ width: `${rewardProgress * 100}%` }}/>
          </div>
        )}

        <p className="relative mt-5 flex items-center gap-1.5 text-[8px] text-slate-600"><ShieldCheck size={12} className="text-emerald-400/60"/>پرداخت‌ها از مسیر امن انجام می‌شود</p>
      </section>

      <section aria-labelledby="coin-packages-title">
        <StoreSectionHeading id="coin-packages-title" title="بسته‌های سکه" description={demoMode ? 'قیمت‌ها نمایشی‌اند؛ فقط بستهٔ فعال قابل خرید آزمایشی است' : 'بسته‌های فعال فروشگاه'} demo={demoMode}/>
        <div className="store-coin-grid mt-3 grid grid-cols-2 gap-2.5">
          {packageCards.map(({ demoPackage, availablePackage }) => {
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
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.035] p-4"><span className="text-xs text-slate-400">{pendingPurchase.transaction.packageTitle}</span><strong className="flex items-center gap-1.5 text-amber-300" dir="ltr"><CoinIcon size={16}/><span className="tabular-nums">+{enNumber(pendingPurchase.transaction.coins)}</span></strong></div>
          <LoadingButton loading={confirm.isPending} onClick={() => confirm.mutate(pendingPurchase.transaction._id)} className="mt-4 w-full"><CheckCircle2 size={18}/>تکمیل خرید آزمایشی</LoadingButton>
          <p className="mt-3 text-center text-[9px] text-slate-500">هیچ وجه واقعی جابه‌جا نمی‌شود</p>
        </div>
      </div>
    </div>}
  </>;
}

function StoreSectionHeading({ id, title, description, demo }: { id: string; title: string; description: string; demo: boolean }) {
  return <div className="min-w-0 px-0.5">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-sm font-black tracking-tight">{title}</h2>
      {demo && <span className="text-[6.5px] font-bold tracking-[.14em] text-slate-600" dir="ltr">DEV PREVIEW</span>}
    </div>
    <p className="mt-1 truncate text-[8px] text-slate-500">{description}</p>
  </div>;
}

function CoinPackageCard({ demoPackage, availablePackage, featured = demoPackage.featured ?? false, paymentMode, pending, onPurchase }: { demoPackage: DemoCoinPackage; availablePackage?: CoinPackage; featured?: boolean; paymentMode: StoreData['paymentMode']; pending: boolean; onPurchase: (coinPackage: CoinPackage) => void }) {
  const purchasable = Boolean(availablePackage && paymentMode === 'test');
  const displayPrice = availablePackage?.price ?? demoPackage.demoPrice;
  const perCoin = Math.round(displayPrice / demoPackage.coins);
  return <article className={cn('store-coin-card group relative flex min-w-0 flex-col', featured && 'store-coin-featured col-span-2')}>
    <div className="relative flex items-center justify-between gap-2">
      <span className="text-[8.5px] font-bold text-slate-400">{demoPackage.title}</span>
      {featured
        ? <span className="store-tag store-tag-gold">پیشنهاد ویژه</span>
        : !purchasable && <span className="store-tag">به‌زودی</span>}
    </div>
    <div className="relative mt-3.5 flex flex-1 items-center gap-3" dir="ltr">
      <span className={cn('store-card-coin grid shrink-0 place-items-center', featured && 'is-gold')}><CoinIcon size={featured ? 26 : 22}/></span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <strong className={cn('font-black leading-none text-white tabular-nums tracking-tight', featured ? 'text-[2rem]' : 'text-[1.45rem]')}>{enNumber(demoPackage.coins)}</strong>
        <span className="text-[7.5px] font-bold uppercase tracking-[.12em] text-slate-500">Coins</span>
      </span>
    </div>
    <div className="relative mt-4 flex items-center justify-between gap-2">
      <span className="text-[7px] text-slate-500" dir="ltr"><span className="tabular-nums">{enNumber(perCoin)}</span> T / coin</span>
      {!availablePackage && <span className="text-[7px] text-slate-600">قیمت نمایشی</span>}
    </div>
    <button type="button" disabled={!purchasable || pending} onClick={() => availablePackage && onPurchase(availablePackage)} className={cn('store-buy-button relative mt-2.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[9px] font-black', purchasable && 'is-available', featured && purchasable && 'is-featured')}>
      {purchasable ? <>خرید<span className={cn('tabular-nums', featured ? 'opacity-90' : 'text-white')} dir="ltr">{enNumber(displayPrice)}</span>تومان</> : 'به‌زودی'}
    </button>
  </article>;
}
