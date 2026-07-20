import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Crown,
  Gift,
  RefreshCw,
  ShieldCheck,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { LoadingButton } from '@/components/ui';
import { api } from '@/lib/api';
import { impact, notify } from '@/lib/telegram';
import { cn, faNumber } from '@/lib/utils';
import type { SubscriptionCycle, SubscriptionData, SubscriptionTransaction } from '@/types/api';

interface PurchaseIntentResponse {
  transaction: SubscriptionTransaction;
  payment: { mode: 'test'; provider: 'test'; reference: string; message: string };
}

const cycleLabels: Record<SubscriptionCycle, string> = { monthly: 'ماهانه', annual: 'سالانه' };
const toman = (value: number) => `${faNumber(value)} تومان`;
const subscriptionDate = (value: string) => new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date(value));

function daysLeft(value: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 86_400_000));
}

function PremiumLoadingCard() {
  return <div className="premium-card broadcast-skeleton h-[210px] rounded-[1.45rem]" aria-label="در حال دریافت وضعیت عضویت پریمیوم"/>;
}

export function PremiumSubscriptionSection() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<SubscriptionCycle>('annual');
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntentResponse|null>(null);
  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await api.get<SubscriptionData>('/subscription')).data
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] }),
      queryClient.invalidateQueries({ queryKey: ['store'] })
    ]);
  };
  const purchase = useMutation({
    mutationFn: async (cycle: SubscriptionCycle) => (await api.post<PurchaseIntentResponse>('/subscription/purchases', { cycle, clientRequestId: crypto.randomUUID() })).data,
    onSuccess: response => { impact('medium'); setPurchaseIntent(response); },
    onError: error => toast.error((error as Error).message)
  });
  const confirmPurchase = useMutation({
    mutationFn: async (transactionId: string) => (await api.post(`/subscription/purchases/${transactionId}/test-confirm`)).data,
    onSuccess: async () => {
      notify('success');
      setPurchaseIntent(null);
      setSheetOpen(false);
      toast.success('عضویت پریمیوم فعال شد');
      await refresh();
    },
    onError: error => toast.error((error as Error).message)
  });
  if (subscriptionQuery.isLoading) return <PremiumLoadingCard/>;
  if (subscriptionQuery.error || !subscriptionQuery.data) {
    return <button type="button" onClick={() => subscriptionQuery.refetch()} className="flex min-h-16 w-full items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-4 text-right">
      <span><strong className="block text-[11px]">عضویت پریمیوم</strong><small className="mt-1 block text-[8px] text-slate-500">برای دریافت وضعیت دوباره بزن</small></span><RefreshCw size={16} className="text-slate-500"/>
    </button>;
  }

  const data = subscriptionQuery.data;
  const active = data.subscription?.status === 'active' ? data.subscription : null;
  const openSheet = () => { impact('light'); setPurchaseIntent(null); setSheetOpen(true); };
  const closeSheet = () => { if (!confirmPurchase.isPending) { setSheetOpen(false); setPurchaseIntent(null); } };

  return <>
    <section className="profile-animate" style={{ animationDelay: '110ms' }} aria-labelledby="premium-title">
      {active ? <ActivePremiumCard subscription={active} onManage={openSheet}/> : <PremiumOfferCard data={data} onOpen={openSheet}/>} 
    </section>
    {sheetOpen && <PlayerModalFrame label={active ? 'جزئیات عضویت پریمیوم' : 'خرید عضویت پریمیوم'} onClose={closeSheet} className={cn('premium-sheet mx-auto', active ? 'max-w-md rounded-t-[1.5rem]' : 'max-w-xl')}>
      {active
        ? <ManageSubscription data={data}/>
        : <PurchaseSubscription
            data={data}
            selectedCycle={selectedCycle}
            purchaseIntent={purchaseIntent}
            purchasePending={purchase.isPending}
            confirmPending={confirmPurchase.isPending}
            onSelectCycle={cycle => { impact('light'); setSelectedCycle(cycle); }}
            onPurchase={() => purchase.mutate(selectedCycle)}
            onConfirm={() => purchaseIntent && confirmPurchase.mutate(purchaseIntent.transaction._id)}
            onBack={() => setPurchaseIntent(null)}
          />}
    </PlayerModalFrame>}
  </>;
}

function PremiumOfferCard({ data, onOpen }: { data: SubscriptionData; onOpen: () => void }) {
  const annual = data.plan.cycles.annual;
  const monthlyEquivalent = Math.round(annual.price / 12);
  return <article className="premium-card relative isolate overflow-hidden rounded-[1.45rem] border border-amber-200/[.16] p-4">
    <div className="premium-grid absolute inset-0" aria-hidden="true"/>
    <div className="relative flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="premium-crown grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><Crown size={22} strokeWidth={2.2}/></span>
        <div className="min-w-0"><p className="text-[7px] font-black text-amber-300" dir="ltr">FFN PREMIUM</p><h2 id="premium-title" className="mt-1 text-[15px] font-black text-white">باشگاهت را حرفه‌ای‌تر کن</h2></div>
      </div>
      <span className="premium-save-chip shrink-0">۳۳٪ به‌صرفه‌تر</span>
    </div>
    <div className="relative mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-white/[.07] border-y border-white/[.065] py-3">
      <PremiumMiniBenefit icon={<Zap size={13}/>} label="جایزه روزانه" value="۲ برابر"/>
      <PremiumMiniBenefit icon={<Gift size={13}/>} label="هدیه سالانه" value={`${faNumber(annual.bonusCoins)} سکه`}/>
      <PremiumMiniBenefit icon={<Crown size={13}/>} label="وضعیت حساب" value="نشان ویژه"/>
    </div>
    <div className="relative mt-4 flex items-end justify-between gap-3">
      <div><span className="block text-[7px] text-slate-500">پلن سالانه، ماهانه</span><strong className="mt-1 block text-sm font-black text-white">{toman(monthlyEquivalent)}</strong></div>
      <button type="button" onClick={onOpen} className="premium-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[10px] font-black">مشاهده و خرید<ChevronLeft size={15}/></button>
    </div>
  </article>;
}

function PremiumMiniBenefit({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="min-w-0 px-2 text-center"><span className="mx-auto flex items-center justify-center gap-1 text-amber-300">{icon}<strong className="truncate text-[8px]">{value}</strong></span><span className="mt-1 block truncate text-[6.5px] text-slate-500">{label}</span></div>;
}

function ActivePremiumCard({ subscription, onManage }: { subscription: NonNullable<SubscriptionData['subscription']>; onManage: () => void }) {
  const [renderedAt] = useState(() => Date.now());
  const remainingDays = daysLeft(subscription.currentPeriodEnd, renderedAt);
  const total = Math.max(1, new Date(subscription.currentPeriodEnd).getTime() - new Date(subscription.currentPeriodStart).getTime());
  const elapsed = Math.max(0, renderedAt - new Date(subscription.currentPeriodStart).getTime());
  const progress = Math.min(100, Math.max(3, elapsed / total * 100));
  return <article className="premium-card premium-card-active relative isolate overflow-hidden rounded-[1.45rem] border border-amber-200/[.2] p-4">
    <div className="premium-grid absolute inset-0" aria-hidden="true"/>
    <div className="relative flex items-start gap-3">
      <span className="premium-crown grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><Crown size={22}/></span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.7)]"/><p className="text-[7px] font-black text-emerald-300">عضویت فعال</p></div><h2 id="premium-title" className="mt-1 text-[15px] font-black">پریمیوم {cycleLabels[subscription.cycle]}</h2><p className="mt-1 text-[8px] text-slate-400">دسترسی پریمیوم فعال است</p></div>
      <button type="button" onClick={onManage} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[.08] bg-white/[.045] text-slate-300" aria-label="مدیریت عضویت"><ChevronLeft size={17}/></button>
    </div>
    <div className="relative mt-4 flex items-end justify-between gap-3"><div><span className="text-[7px] text-slate-500">پایان دوره</span><strong className="mt-1 block text-[10px] text-white">{subscriptionDate(subscription.currentPeriodEnd)}</strong></div><strong className="text-xs font-black text-amber-300">{faNumber(remainingDays)} روز مانده</strong></div>
    <div className="premium-period-track relative mt-3"><span style={{ width: `${progress}%` }}/></div>
    <button type="button" onClick={onManage} className="relative mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/[.13] bg-amber-200/[.055] text-[10px] font-black text-amber-100">مدیریت عضویت و پرداخت‌ها<ChevronLeft size={15}/></button>
  </article>;
}

interface PurchaseProps {
  data: SubscriptionData;
  selectedCycle: SubscriptionCycle;
  purchaseIntent: PurchaseIntentResponse|null;
  purchasePending: boolean;
  confirmPending: boolean;
  onSelectCycle: (cycle: SubscriptionCycle) => void;
  onPurchase: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

function PurchaseSubscription({ data, selectedCycle, purchaseIntent, purchasePending, confirmPending, onSelectCycle, onPurchase, onConfirm, onBack }: PurchaseProps) {
  const option = data.plan.cycles[selectedCycle];
  if (purchaseIntent) return <div className="premium-sheet-scroll overflow-y-auto px-4 pb-[max(24px,var(--safe-bottom))]">
    <div className="mx-auto max-w-md py-3">
      <button type="button" onClick={onBack} disabled={confirmPending} className="mb-5 inline-flex items-center gap-1 text-[9px] text-slate-400"><ChevronLeft size={14} className="rotate-180"/>بازگشت به انتخاب دوره</button>
      <span className="premium-confirm-icon mx-auto grid h-16 w-16 place-items-center rounded-2xl"><ShieldCheck size={28}/></span>
      <p className="mt-4 text-center text-[8px] font-black text-amber-300" dir="ltr">SECURE CHECKOUT</p>
      <h2 className="mt-1 text-center text-lg font-black">بازبینی و تأیید پرداخت</h2>
      <div className="mt-6 divide-y divide-white/[.06] border-y border-white/[.07]">
        <ReceiptRow label="محصول" value={purchaseIntent.transaction.planTitle}/>
        <ReceiptRow label="دوره پرداخت" value={cycleLabels[purchaseIntent.transaction.cycle]}/>
        <ReceiptRow label="هدیه فعال‌سازی" value={`${faNumber(purchaseIntent.transaction.bonusCoins)} سکه`} accent/>
        <ReceiptRow label="مبلغ نهایی" value={toman(purchaseIntent.transaction.price)} strong/>
      </div>
      <p className="mt-4 flex items-start gap-2 text-[8px] leading-5 text-slate-500"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-300"/>{purchaseIntent.payment.message}</p>
      <LoadingButton loading={confirmPending} onClick={onConfirm} className="mt-5 w-full"><CheckCircle2 size={18}/>تکمیل پرداخت آزمایشی</LoadingButton>
      <p className="mt-3 text-center text-[8px] text-slate-600">هیچ وجه واقعی جابه‌جا نمی‌شود</p>
    </div>
  </div>;

  const unavailable = data.paymentMode === 'unavailable';
  return <div className="premium-sheet-scroll overflow-y-auto px-4 pb-[max(24px,var(--safe-bottom))]">
    <div className="mx-auto max-w-md py-2">
      <div className="text-center"><span className="premium-crown mx-auto grid h-14 w-14 place-items-center rounded-2xl"><Crown size={25}/></span><p className="mt-4 text-[7px] font-black text-amber-300" dir="ltr">FFN PREMIUM MEMBERSHIP</p><h2 className="mt-1 text-xl font-black">عضویت پریمیوم</h2><p className="mx-auto mt-2 max-w-xs text-[9px] leading-5 text-slate-400">دوره دلخواهت را انتخاب کن؛ مزایا بلافاصله پس از پرداخت فعال می‌شوند.</p></div>
      <div className="premium-cycle-control mt-5 grid grid-cols-2 p-1" role="tablist" aria-label="دوره عضویت">
        {(['monthly', 'annual'] as const).map(cycle => <button key={cycle} type="button" role="tab" aria-selected={selectedCycle === cycle} onClick={() => onSelectCycle(cycle)} className={cn('relative min-h-11 rounded-xl text-[10px] font-black transition', selectedCycle === cycle ? 'is-active' : 'text-slate-500')}>{cycleLabels[cycle]}{cycle === 'annual' && <span className="mr-1 text-[6px] text-emerald-300">۳۳٪ تخفیف</span>}</button>)}
      </div>
      <div className="mt-5 flex items-end justify-between border-b border-white/[.07] pb-5">
        <div><span className="text-[8px] text-slate-500">مبلغ {cycleLabels[selectedCycle]}</span><div className="mt-1 flex items-baseline gap-1"><strong className="text-[1.65rem] font-black text-white">{faNumber(option.price)}</strong><span className="text-[9px] text-slate-400">تومان</span></div>{option.originalPrice && <span className="text-[8px] text-slate-600 line-through">{toman(option.originalPrice)}</span>}</div>
        <span className="premium-bonus-chip"><Gift size={12}/>+{faNumber(option.bonusCoins)} سکه</span>
      </div>
      <div className="mt-5 space-y-4">{data.plan.benefits.map((benefit, index) => <div key={benefit.id} className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-200/[.08] text-amber-300">{index === 0 ? <Zap size={15}/> : index === 1 ? <Coins size={15}/> : <Crown size={15}/>}</span><div><strong className="block text-[10px] text-slate-100">{benefit.title}</strong><p className="mt-1 text-[8px] leading-4 text-slate-500">{benefit.description}</p></div><Check size={14} className="mr-auto mt-2 shrink-0 text-emerald-300"/></div>)}</div>
      <LoadingButton loading={purchasePending} disabled={unavailable} onClick={onPurchase} className="mt-6 w-full">{unavailable ? 'درگاه پرداخت در حال آماده‌سازی' : <><ShieldCheck size={18}/>ادامه و پرداخت امن</>}</LoadingButton>
    </div>
  </div>;
}

function ReceiptRow({ label, value, accent, strong }: { label: string; value: string; accent?: boolean; strong?: boolean }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 text-[10px]"><span className="text-slate-500">{label}</span><strong className={cn(accent ? 'text-amber-300' : 'text-slate-200', strong && 'text-sm text-white')}>{value}</strong></div>;
}

function ManageSubscription({ data }: { data: SubscriptionData }) {
  const subscription = data.subscription!;
  return <div className="px-4 pb-[max(20px,var(--safe-bottom))]">
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-3 pb-4">
        <span className="premium-crown grid h-11 w-11 shrink-0 place-items-center rounded-xl"><Crown size={20}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,.55)]"/>عضویت فعال</div>
          <h2 className="mt-1 text-base font-black text-white">پریمیوم</h2>
          <p className="mt-0.5 text-[7.5px] text-slate-500">فعال از {subscriptionDate(subscription.startedAt)}</p>
        </div>
        <ShieldCheck size={19} className="shrink-0 text-emerald-300/80" aria-hidden="true"/>
      </div>
      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[.07] border-y border-white/[.07] py-3.5">
        <div className="flex min-w-0 items-center gap-2.5 px-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-300/[.08] text-cyan-300"><CalendarDays size={14}/></span>
          <div className="min-w-0"><span className="block text-[7px] text-slate-500">اعتبار تا</span><strong className="mt-1 block text-[9px] leading-4 text-slate-100">{subscriptionDate(subscription.currentPeriodEnd)}</strong></div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 px-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-200/[.08] text-amber-300"><Gift size={14}/></span>
          <div className="min-w-0"><span className="block text-[7px] text-slate-500">هدیه این دوره</span><strong className="mt-1 block text-[9px] leading-4 text-amber-200">{faNumber(subscription.bonusCoins)} سکه</strong></div>
        </div>
      </div>
    </div>
  </div>;
}
