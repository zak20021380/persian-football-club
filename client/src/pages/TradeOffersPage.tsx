import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { isDemoDataEnabled } from '@/lib/featureFlags';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeDollarSign,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Flag,
  HandCoins,
  Handshake,
  Inbox,
  LoaderCircle,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
  Timer,
  UserRound,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { ErrorState, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber, remaining, tehranDate } from '@/lib/utils';
import type { ClubPlayer, TradeOffersData, TradeOfferView, TransferOfferStatus } from '@/types/api';

type OfferStatus = TransferOfferStatus;
type OfferDirection = 'received' | 'sent';
type OfferKind = 'buy' | 'sell';

type Counterparty = { id: string; name: string; shortName: string; color: string; initials: string; photoUrl?: string };

type DisplayOffer = {
  id: string;
  direction: OfferDirection;
  kind: OfferKind;
  status: OfferStatus;
  amount: number;
  createdAt: string;
  expiresAt: string;
  note?: string;
  counterAmount?: number;
  player: {
    id: string;
    name: string;
    position: ClubPlayer['position'];
    nationality: string;
    club: string;
    marketValue: number;
    photoUrl?: string;
    demoIndex?: number;
    contractStatus?: string;
  };
  counterparty: Counterparty;
  listingAskingPrice?: number;
  isDemo: boolean;
};

const demoClubs: Counterparty[] = [
  { id: 'persepolis', name: 'پرسپولیس', shortName: 'پرسپولیس', color: '#dc2626', initials: 'پ' },
  { id: 'esteghlal', name: 'استقلال', shortName: 'استقلال', color: '#1d4ed8', initials: 'ا' },
  { id: 'sepahan', name: 'سپاهان', shortName: 'سپاهان', color: '#f59e0b', initials: 'س' },
  { id: 'tractor', name: 'تراکتور', shortName: 'تراکتور', color: '#7c2d12', initials: 'ت' },
  { id: 'foolad', name: 'فولاد', shortName: 'فولاد', color: '#64748b', initials: 'ف' },
  { id: 'golgohar', name: 'گل‌گهر', shortName: 'گل‌گهر', color: '#a16207', initials: 'گ' },
  { id: 'zob-ahan', name: 'ذوب‌آهن', shortName: 'ذوب‌آهن', color: '#0f766e', initials: 'ذ' },
  { id: 'malavan', name: 'ملوان', shortName: 'ملوان', color: '#0369a1', initials: 'م' },
];

const demoPlayerPool: Array<DisplayOffer['player'] & { demoIndex: number }> = [
  { id: 'demo-target-1', name: 'مهدی طارمی', position: 'ST', nationality: 'ایران', club: 'اینتر', marketValue: 8600, demoIndex: 9, contractStatus: 'آماده بازی' },
  { id: 'demo-target-2', name: 'سامان قدوس', position: 'AM', nationality: 'ایران', club: 'برنتفورد', marketValue: 5900, demoIndex: 6, contractStatus: 'آماده بازی' },
  { id: 'demo-target-3', name: 'شجاع خلیل‌زاده', position: 'CB', nationality: 'ایران', club: 'تراکتور', marketValue: 4300, demoIndex: 2, contractStatus: 'آماده بازی' },
  { id: 'demo-target-4', name: 'محمدمهدی احمدی', position: 'GK', nationality: 'ایران', club: 'پرسپولیس', marketValue: 3200, demoIndex: 0, contractStatus: 'آماده بازی' },
  { id: 'demo-target-5', name: 'علیرضا جهانبخش', position: 'RW', nationality: 'ایران', club: 'فاینورد', marketValue: 5400, demoIndex: 11, contractStatus: 'آماده بازی' },
  { id: 'demo-target-6', name: 'کریم انصاری‌فرد', position: 'ST', nationality: 'ایران', club: 'المپیاکوس', marketValue: 3400, demoIndex: 10, contractStatus: 'آماده بازی' },
];

const baseDate = new Date('2026-07-13T15:30:00.000Z').getTime();
const minutesFromNow = (minutes: number) => new Date(baseDate + minutes * 60_000).toISOString();
const hoursFromNow = (hours: number) => new Date(baseDate + hours * 3_600_000).toISOString();
const daysFromNow = (days: number) => new Date(baseDate + days * 86_400_000).toISOString();

const buildDemoReceivedOffers = (): DisplayOffer[] => [
  {
    id: 'demo-rec-1',
    direction: 'received',
    kind: 'buy',
    status: 'active',
    amount: 9150,
    listingAskingPrice: 9400,
    createdAt: minutesFromNow(-95),
    expiresAt: hoursFromNow(20),
    note: 'پیشنهاد ویژه برای جذب فوری',
    player: { ...demoPlayerPool[0] },
    counterparty: demoClubs[0],
    isDemo: true,
  },
  {
    id: 'demo-rec-2',
    direction: 'received',
    kind: 'buy',
    status: 'active',
    amount: 8800,
    listingAskingPrice: 9400,
    createdAt: minutesFromNow(-310),
    expiresAt: hoursFromNow(2),
    note: 'آماده مذاکره برای پرداخت قسطی',
    player: { ...demoPlayerPool[0] },
    counterparty: demoClubs[1],
    isDemo: true,
  },
  {
    id: 'demo-rec-3',
    direction: 'received',
    kind: 'buy',
    status: 'active',
    amount: 6300,
    listingAskingPrice: 6400,
    createdAt: minutesFromNow(-50),
    expiresAt: hoursFromNow(46),
    player: { ...demoPlayerPool[1] },
    counterparty: demoClubs[2],
    isDemo: true,
  },
  {
    id: 'demo-rec-4',
    direction: 'received',
    kind: 'buy',
    status: 'accepted',
    amount: 4600,
    listingAskingPrice: 4300,
    createdAt: hoursFromNow(-30),
    expiresAt: hoursFromNow(18),
    note: 'توافق نهایی شد',
    player: { ...demoPlayerPool[2] },
    counterparty: demoClubs[3],
    isDemo: true,
  },
  {
    id: 'demo-rec-5',
    direction: 'received',
    kind: 'buy',
    status: 'rejected',
    amount: 3700,
    listingAskingPrice: 4300,
    createdAt: hoursFromNow(-72),
    expiresAt: hoursFromNow(-12),
    note: 'پیشنهاد کمتر از قیمت پایه',
    player: { ...demoPlayerPool[2] },
    counterparty: demoClubs[4],
    isDemo: true,
  },
  {
    id: 'demo-rec-6',
    direction: 'received',
    kind: 'buy',
    status: 'expired',
    amount: 5400,
    listingAskingPrice: 5900,
    createdAt: daysFromNow(-3),
    expiresAt: hoursFromNow(-2),
    player: { ...demoPlayerPool[1] },
    counterparty: demoClubs[5],
    isDemo: true,
  },
];

const buildDemoSentOffers = (): DisplayOffer[] => [
  {
    id: 'demo-sent-1',
    direction: 'sent',
    kind: 'buy',
    status: 'active',
    amount: 3450,
    listingAskingPrice: 3600,
    createdAt: minutesFromNow(-140),
    expiresAt: hoursFromNow(28),
    note: 'پیشنهاد اولیه به همراه بند پاداش',
    player: { ...demoPlayerPool[3] },
    counterparty: demoClubs[0],
    isDemo: true,
  },
  {
    id: 'demo-sent-2',
    direction: 'sent',
    kind: 'buy',
    status: 'active',
    amount: 5600,
    listingAskingPrice: 5900,
    createdAt: minutesFromNow(-220),
    expiresAt: hoursFromNow(4),
    note: 'قابل افزایش در صورت توافق',
    player: { ...demoPlayerPool[4] },
    counterparty: demoClubs[1],
    isDemo: true,
  },
  {
    id: 'demo-sent-3',
    direction: 'sent',
    kind: 'buy',
    status: 'active',
    amount: 3500,
    listingAskingPrice: 3800,
    createdAt: minutesFromNow(-60),
    expiresAt: hoursFromNow(50),
    player: { ...demoPlayerPool[5] },
    counterparty: demoClubs[2],
    isDemo: true,
  },
  {
    id: 'demo-sent-4',
    direction: 'sent',
    kind: 'buy',
    status: 'accepted',
    amount: 9400,
    listingAskingPrice: 9400,
    createdAt: hoursFromNow(-50),
    expiresAt: hoursFromNow(12),
    note: 'پذیرفته شد، منتظر تسویه باشگاه مقصد',
    player: { ...demoPlayerPool[0] },
    counterparty: demoClubs[3],
    isDemo: true,
  },
  {
    id: 'demo-sent-5',
    direction: 'sent',
    kind: 'buy',
    status: 'rejected',
    amount: 2900,
    listingAskingPrice: 3600,
    createdAt: hoursFromNow(-100),
    expiresAt: hoursFromNow(-3),
    note: 'پیشنهاد رد شد',
    player: { ...demoPlayerPool[3] },
    counterparty: demoClubs[5],
    isDemo: true,
  },
  {
    id: 'demo-sent-6',
    direction: 'sent',
    kind: 'buy',
    status: 'expired',
    amount: 4200,
    listingAskingPrice: 4500,
    createdAt: daysFromNow(-2),
    expiresAt: hoursFromNow(-1),
    player: { ...demoPlayerPool[2] },
    counterparty: demoClubs[6],
    isDemo: true,
  },
];

const statusMeta: Record<OfferStatus, { label: string; className: string; dot: string }> = {
  active: {
    label: 'فعال',
    className: 'border-emerald-300/25 bg-emerald-400/[.12] text-emerald-200',
    dot: 'bg-emerald-300 shadow-[0_0_0_3px_rgba(52,211,153,.18)]',
  },
  accepted: {
    label: 'پذیرفته‌شده',
    className: 'border-sky-300/25 bg-sky-400/[.12] text-sky-200',
    dot: 'bg-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,.18)]',
  },
  rejected: {
    label: 'ردشده',
    className: 'border-rose-300/25 bg-rose-400/[.12] text-rose-200',
    dot: 'bg-rose-300 shadow-[0_0_0_3px_rgba(253,164,175,.18)]',
  },
  cancelled: {
    label: 'لغوشده',
    className: 'border-rose-300/20 bg-rose-400/[.08] text-rose-200',
    dot: 'bg-rose-300 shadow-[0_0_0_3px_rgba(253,164,175,.14)]',
  },
  countered: {
    label: 'پیشنهاد متقابل',
    className: 'border-amber-300/25 bg-amber-400/[.1] text-amber-200',
    dot: 'bg-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,.16)]',
  },
  expired: {
    label: 'منقضی',
    className: 'border-slate-400/20 bg-slate-500/[.14] text-slate-300',
    dot: 'bg-slate-400 shadow-[0_0_0_3px_rgba(148,163,184,.16)]',
  },
};

const kindMeta: Record<OfferKind, { label: string; className: string; icon: typeof HandCoins }> = {
  buy: {
    label: 'خرید',
    className: 'border-amber-300/25 bg-amber-400/[.1] text-amber-200',
    icon: HandCoins,
  },
  sell: {
    label: 'فروش',
    className: 'border-violet-300/25 bg-violet-400/[.1] text-violet-200',
    icon: BadgeDollarSign,
  },
};

export function TradeOffersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<OfferDirection>('received');
  const [statusFilter, setStatusFilter] = useState<'all' | OfferStatus>('all');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [demoStatuses, setDemoStatuses] = useState<Record<string, OfferStatus>>({});
  const [counterAmounts, setCounterAmounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number>(() => Date.now());

  const offersQuery = useQuery({
    queryKey: ['tradeOffers'],
    queryFn: async () => (await api.get<TradeOffersData>('/club/offers')).data,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { receivedOffers, sentOffers, hasRealData, demoMode } = useMemo(() => {
    const realReceived = (offersQuery.data?.received ?? []).map(toDisplayOffer);
    const realSent = (offersQuery.data?.sent ?? []).map(toDisplayOffer);
    const hasRealOffers = realReceived.length + realSent.length > 0;
    const useDemoPreview = isDemoDataEnabled() && !hasRealOffers;
    return {
      receivedOffers: useDemoPreview ? buildDemoReceivedOffers() : realReceived,
      sentOffers: useDemoPreview ? buildDemoSentOffers() : realSent,
      hasRealData: hasRealOffers,
      demoMode: useDemoPreview,
    };
  }, [offersQuery.data]);

  const sourceList = tab === 'received' ? receivedOffers : sentOffers;
  const list = useMemo(() => {
    const filtered = sourceList.filter(offer => {
      const effectiveStatus = offer.isDemo ? demoStatuses[offer.id] ?? offer.status : offer.status;
      if (statusFilter === 'all') return true;
      return effectiveStatus === statusFilter;
    });
    return filtered
      .map(offer => ({ offer, effectiveStatus: offer.isDemo ? demoStatuses[offer.id] ?? offer.status : offer.status }))
      .sort((a, b) => {
        const aTime = new Date(a.offer.expiresAt).getTime() - now;
        const bTime = new Date(b.offer.expiresAt).getTime() - now;
        return aTime - bTime;
      })
      .map(item => ({ ...item.offer, status: item.effectiveStatus }));
  }, [sourceList, statusFilter, demoStatuses, now]);

  const selectedOffer = useMemo(() => {
    if (!selectedOfferId) return null;
    const pool = [...receivedOffers, ...sentOffers];
    const match = pool.find(offer => offer.id === selectedOfferId);
    return match ? { ...match, status: match.isDemo ? demoStatuses[match.id] ?? match.status : match.status } : null;
  }, [selectedOfferId, receivedOffers, sentOffers, demoStatuses]);
  const selectedCounterAmount = selectedOfferId ? counterAmounts[selectedOfferId] : undefined;

  const actionMutation = useMutation({
    mutationFn: async ({ offer, action, amount }: { offer: DisplayOffer; action: 'accept'|'reject'|'cancel'|'counter'; amount?: number }) => {
      if (offer.isDemo) return { demo: true };
      if (action === 'counter') {
        return (await api.post(`/club/offers/${offer.id}/counter`, {
          amount,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          clientRequestId: crypto.randomUUID(),
        })).data;
      }
      return (await api.post(`/club/offers/${offer.id}/${action}`)).data;
    },
    onSuccess: async (_data, variables) => {
      const { offer, action, amount } = variables;
      if (offer.isDemo) {
        if (action === 'counter' && amount !== undefined) setCounterAmounts(prev => ({ ...prev, [offer.id]: amount }));
        else setDemoStatuses(prev => ({ ...prev, [offer.id]: action === 'accept' ? 'accepted' : 'rejected' }));
        toast.success('تغییر فقط در پیش‌نمایش اعمال شد');
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tradeOffers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubPlayers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubSquad'] }),
        queryClient.invalidateQueries({ queryKey: ['bootstrap'] }),
      ]);
      const successMessages = { accept: 'پیشنهاد با موفقیت پذیرفته شد', reject: 'پیشنهاد رد شد', cancel: 'پیشنهاد لغو شد', counter: 'پیشنهاد متقابل ثبت شد' };
      toast.success(successMessages[action]);
      if (action !== 'counter') setSelectedOfferId(null);
    },
    onError: error => toast.error((error as Error).message || 'عملیات پیشنهاد انجام نشد'),
  });

  const runAction = (offer: DisplayOffer, action: 'accept'|'reject'|'cancel'|'counter', amount?: number) => {
    if (actionMutation.isPending) return;
    actionMutation.mutate({ offer, action, amount });
  };

  const counts = useMemo(() => {
    const counter: Record<OfferDirection, Record<OfferStatus | 'all', number>> = {
      received: { all: 0, active: 0, accepted: 0, rejected: 0, cancelled: 0, countered: 0, expired: 0 },
      sent: { all: 0, active: 0, accepted: 0, rejected: 0, cancelled: 0, countered: 0, expired: 0 },
    };
    const visit = (offer: DisplayOffer) => {
      const effective = offer.isDemo ? demoStatuses[offer.id] ?? offer.status : offer.status;
      counter[offer.direction].all += 1;
      counter[offer.direction][effective] = (counter[offer.direction][effective] ?? 0) + 1;
    };
    receivedOffers.forEach(visit);
    sentOffers.forEach(visit);
    return counter;
  }, [receivedOffers, sentOffers, demoStatuses]);

  if (offersQuery.isLoading) {
    return <>
      <PageHeader title="پیشنهادهای خریدوفروش" subtitle="میز مذاکره باشگاه" back backTo="/club" tone="violet" eyebrow="TRANSFER DESK / OFFERS"/>
      <PageSkeleton/>
    </>;
  }

  if (offersQuery.error || !offersQuery.data) {
    return <>
      <PageHeader title="پیشنهادهای خریدوفروش" subtitle="میز مذاکره باشگاه" back backTo="/club" tone="violet" eyebrow="TRANSFER DESK / OFFERS"/>
      <main className="p-4">
        <ErrorState message={(offersQuery.error as Error)?.message || 'پیشنهادها دریافت نشدند'} onRetry={() => offersQuery.refetch()}/>
      </main>
    </>;
  }

  return <>
    <PageHeader title="پیشنهادهای خریدوفروش" subtitle="میز مذاکره باشگاه" back backTo="/club" tone="violet" eyebrow="TRANSFER DESK / OFFERS"/>
    <main className="space-y-3 px-3 pb-6 pt-3 sm:px-4">
      <HeroSummary hasRealData={hasRealData} demoMode={demoMode} receivedCount={counts.received.all} sentCount={counts.sent.all} activeReceived={counts.received.active} activeSent={counts.sent.active}/>

      <section aria-label="انتخاب نوع پیشنهاد" className="rounded-[1.45rem] border border-white/[.07] bg-ink-900/90 p-1.5">
        <div role="tablist" className="grid grid-cols-2 gap-1.5">
          <TabButton active={tab === 'received'} onClick={() => { setTab('received'); setStatusFilter('all'); }} icon={ArrowDownToLine} label="پیشنهادهای دریافتی" count={counts.received.all}/>
          <TabButton active={tab === 'sent'} onClick={() => { setTab('sent'); setStatusFilter('all'); }} icon={ArrowUpFromLine} label="پیشنهادهای ارسالی" count={counts.sent.all}/>
        </div>
      </section>

      <section aria-label="فیلتر وضعیت" className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {(['all', 'active', 'accepted', 'rejected', 'cancelled', 'countered', 'expired'] as const).map(value => {
          const isActive = statusFilter === value;
          const label = value === 'all' ? 'همه' : statusMeta[value].label;
          const count = counts[tab][value] ?? 0;
          return <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[8.5px] font-black transition active:scale-95',
              isActive
                ? 'border-emerald-300/35 bg-emerald-400/[.13] text-emerald-100'
                : 'border-white/[.08] bg-white/[.04] text-slate-400'
            )}
          >
            <span>{label}</span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[7px]', isActive ? 'bg-emerald-300/30 text-emerald-50' : 'bg-white/[.08] text-slate-400')}>{faNumber(count)}</span>
          </button>;
        })}
      </section>

      {list.length === 0 ? (
        <EmptyState direction={tab}/>
      ) : (
        <section aria-label="فهرست پیشنهادها" className={tab === 'received' ? 'space-y-3' : 'space-y-2.5'}>
          {list.map((offer, index) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              index={index}
              now={now}
              pending={actionMutation.isPending && actionMutation.variables?.offer.id === offer.id}
              onOpen={() => setSelectedOfferId(offer.id)}
              onAccept={() => runAction(offer, 'accept')}
              onReject={() => runAction(offer, 'reject')}
              onCancel={() => runAction(offer, 'cancel')}
            />
          ))}
        </section>
      )}
    </main>
    {selectedOffer && (
      <OfferDetailsSheet
        offer={selectedOffer}
        counterAmount={selectedCounterAmount}
        now={now}
        transferFeePercent={offersQuery.data?.transferFeePercent ?? 0}
        pending={actionMutation.isPending && actionMutation.variables?.offer.id === selectedOffer.id}
        onClose={() => setSelectedOfferId(null)}
        onAccept={() => runAction(selectedOffer, 'accept')}
        onReject={() => runAction(selectedOffer, 'reject')}
        onCancel={() => runAction(selectedOffer, 'cancel')}
        onCounter={(amount) => runAction(selectedOffer, 'counter', amount)}
      />
    )}
  </>;
}

function HeroSummary({ hasRealData, demoMode, receivedCount, sentCount, activeReceived, activeSent }: { hasRealData: boolean; demoMode: boolean; receivedCount: number; sentCount: number; activeReceived: number; activeSent: number }) {
  return <section className="relative overflow-hidden rounded-[1.55rem] border border-emerald-300/[.1] bg-[linear-gradient(150deg,rgba(15,39,48,.96),rgba(7,17,31,.99)_58%,rgba(10,25,39,.98))] p-3.5">
    <div className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-emerald-400/[.09] blur-3xl"/>
    <div className="pointer-events-none absolute -right-8 bottom-[-40px] h-28 w-28 rounded-full bg-amber-300/[.07] blur-3xl"/>
    <div className="relative flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/[.12] text-emerald-300"><Handshake size={20}/></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h1 className="text-xs font-black text-white">مدیریت پیشنهادهای خریدوفروش</h1>
          {demoMode && <span className="rounded-full border border-amber-300/20 bg-amber-300/[.09] px-2 py-0.5 text-[6.5px] font-black text-amber-200">نمایش آزمایشی</span>}
          {!demoMode && hasRealData && <span className="rounded-full border border-emerald-300/20 bg-emerald-400/[.1] px-2 py-0.5 text-[6.5px] font-black text-emerald-200">داده‌های واقعی</span>}
        </div>
        <p className="mt-1 text-[8.5px] leading-5 text-slate-400">پیشنهادهای دریافتی و ارسالی باشگاهت را در یک نگاه ببین، پاسخ بده و پیشنهاد متقابل ثبت کن.</p>
      </div>
    </div>
    <div className="relative mt-3 grid grid-cols-2 gap-2">
      <SummaryStat icon={Inbox} label="دریافتی" value={`${faNumber(receivedCount)} پیشنهاد`} accent="emerald" footnote={`${faNumber(activeReceived)} فعال`}/>
      <SummaryStat icon={Send} label="ارسالی" value={`${faNumber(sentCount)} پیشنهاد`} accent="amber" footnote={`${faNumber(activeSent)} فعال`}/>
    </div>
  </section>;
}

function SummaryStat({ icon: Icon, label, value, accent, footnote }: { icon: typeof Inbox; label: string; value: string; accent: 'emerald' | 'amber'; footnote: string }) {
  const palette = accent === 'emerald' ? 'border-emerald-300/15 bg-emerald-400/[.07] text-emerald-200' : 'border-amber-300/15 bg-amber-400/[.07] text-amber-200';
  return <div className={cn('rounded-2xl border p-2.5', palette)}>
    <div className="flex items-center gap-1.5"><Icon size={12}/><span className="text-[7.5px] font-black uppercase tracking-wide">{label}</span></div>
    <p className="mt-1.5 text-[10px] font-black text-white">{value}</p>
    <p className="mt-0.5 text-[7px] text-slate-400">{footnote}</p>
  </div>;
}

function TabButton({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: typeof Inbox; label: string; count: number }) {
  return <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={cn(
      'relative flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-[9.5px] font-black transition active:scale-[.985]',
      active
        ? 'bg-gradient-to-b from-emerald-400/[.18] to-emerald-500/[.05] text-emerald-100 shadow-[inset_0_1px_0_rgba(110,231,183,.18)]'
        : 'text-slate-400 hover:text-slate-200'
    )}
  >
    <Icon size={14} className={cn('shrink-0', active ? 'text-emerald-200' : 'text-slate-500')}/>
    <span className="truncate">{label}</span>
    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-black', active ? 'bg-emerald-300/25 text-emerald-50' : 'bg-white/[.06] text-slate-400')}>{faNumber(count)}</span>
    {active && <span className="absolute inset-x-6 bottom-1 h-0.5 rounded-full bg-emerald-300"/>}
  </button>;
}

function OfferCard({ offer, index, now, pending, onOpen, onAccept, onReject, onCancel }: { offer: DisplayOffer; index: number; now: number; pending: boolean; onOpen: () => void; onAccept: () => void; onReject: () => void; onCancel: () => void }) {
  const KindIcon = kindMeta[offer.kind].icon;
  const remainingText = remaining(offer.expiresAt, now);
  const isReceived = offer.direction === 'received';
  const active = offer.status === 'active';
  if (isReceived) {
    return <ReceivedOfferCard
      offer={offer}
      index={index}
      remainingText={remainingText}
      pending={pending}
      onOpen={onOpen}
      onAccept={onAccept}
      onReject={onReject}
    />;
  }
  return <article
    style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    className="offer-card relative overflow-hidden rounded-[1.45rem] border border-white/[.08] bg-[linear-gradient(155deg,rgba(15,30,46,.96),rgba(8,20,35,.99))] p-3 shadow-[0_10px_24px_rgba(0,0,0,.18)]"
  >
    <button type="button" onClick={onOpen} aria-label={`جزئیات پیشنهاد ${offer.player.name}`} className="absolute inset-0 z-0 cursor-pointer"/>
    <div className="relative z-10 flex items-start gap-3">
      <CounterpartyBadge club={offer.counterparty}/>
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black', kindMeta[offer.kind].className)}>
            <KindIcon size={9}/>
            {kindMeta[offer.kind].label}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black', statusMeta[offer.status].className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta[offer.status].dot)}/>
            {statusMeta[offer.status].label}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <PlayerAvatar offer={offer} size="card"/>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[11px] font-black text-white">{offer.player.name}</h3>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[7.5px] text-slate-400">
              <ShieldCheck size={9} className="shrink-0 text-emerald-300"/>
              <span className="truncate">{offer.counterparty.name}</span>
              <span className="text-white/15">•</span>
              <Building2 size={9} className="shrink-0"/>
              <span className="truncate">{offer.player.club}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="rounded-md border border-white/[.08] bg-white/[.04] px-1.5 py-0.5 text-[6.5px] font-bold text-slate-300">{positionLabel(offer.player.position)}</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/[.08] bg-white/[.04] px-1.5 py-0.5 text-[6.5px] font-bold text-slate-300"><Flag size={8}/>{offer.player.nationality}</span>
              <span className="rounded-md border border-amber-300/[.1] bg-amber-300/[.05] px-1.5 py-0.5 text-[6.5px] font-bold text-amber-200">ارزش بازار {faNumber(offer.player.marketValue)} سکه</span>
            </div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border border-white/[.06] bg-black/[.12] px-2 py-1.5">
            <span className="flex items-center gap-1 text-[6.5px] text-slate-500"><CircleDollarSign size={9} className="text-amber-300"/>مبلغ پیشنهاد</span>
            <strong className="mt-0.5 block truncate text-[10px] text-amber-100">{faNumber(offer.amount)} سکه</strong>
          </div>
          <div className="rounded-xl border border-white/[.06] bg-black/[.12] px-2 py-1.5">
            <span className="flex items-center gap-1 text-[6.5px] text-slate-500"><Timer size={9} className="text-emerald-300"/>زمان باقی‌مانده</span>
            <strong className={cn('mt-0.5 block truncate text-[10px]', active ? 'text-emerald-200' : 'text-slate-300')}>{remainingText}</strong>
          </div>
        </div>
      </div>
    </div>
    {active && (
      <div className="relative z-20 mt-3 grid grid-cols-3 gap-1.5">
        {isReceived ? (
          <>
            <ActionButton onClick={(event) => { event.stopPropagation(); onAccept(); }} icon={Check} label="قبول" tone="accept" loading={pending}/>
            <ActionButton onClick={(event) => { event.stopPropagation(); onReject(); }} icon={X} label="رد" tone="reject" disabled={pending}/>
            <ActionButton onClick={(event) => { event.stopPropagation(); onOpen(); }} icon={ArrowLeftRight} label="پیشنهاد متقابل" tone="counter" disabled={pending}/>
          </>
        ) : (
          <>
            <ActionButton onClick={(event) => { event.stopPropagation(); onOpen(); }} icon={Sparkles} label="مشاهده جزئیات" tone="view" className="col-span-2" disabled={pending}/>
            <ActionButton onClick={(event) => { event.stopPropagation(); onCancel(); }} icon={X} label="لغو پیشنهاد" tone="reject" loading={pending}/>
          </>
        )}
      </div>
    )}
  </article>;
}

function ReceivedOfferCard({ offer, index, remainingText, pending, onOpen, onAccept, onReject }: { offer: DisplayOffer; index: number; remainingText: string; pending: boolean; onOpen: () => void; onAccept: () => void; onReject: () => void }) {
  const KindIcon = kindMeta[offer.kind].icon;
  const active = offer.status === 'active';
  return <article
    style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    className="offer-card relative min-w-0 overflow-hidden rounded-[1.25rem] border border-white/[.075] bg-[linear-gradient(155deg,rgba(14,29,45,.97),rgba(8,19,33,.99))] p-2.5 shadow-[0_8px_20px_rgba(0,0,0,.16)]"
  >
    <button type="button" onClick={onOpen} aria-label={`جزئیات پیشنهاد ${offer.player.name}`} className="absolute inset-0 z-0 cursor-pointer"/>

    <div className="relative z-10 flex min-w-0 items-start gap-2.5">
      <PlayerAvatar offer={offer} size="compact"/>
      <div className="pointer-events-none min-w-0 flex-1 pt-0.5">
        <h3 className="truncate whitespace-nowrap text-[11px] font-black leading-5 text-white">{offer.player.name}</h3>
        <p className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[7.5px] leading-4 text-slate-500">
          <span className="shrink-0">{positionLabel(offer.player.position)}</span>
          <span className="shrink-0 text-white/15">•</span>
          <Building2 size={9} className="shrink-0 text-slate-600"/>
          <span className="truncate">{offer.player.club}</span>
        </p>
      </div>
      <div className="pointer-events-none min-w-[72px] shrink-0 self-center text-left">
        <span className="block whitespace-nowrap text-[6.5px] font-bold text-slate-500">مبلغ پیشنهادی</span>
        <strong className="mt-0.5 block truncate whitespace-nowrap text-[14px] font-black tracking-tight text-amber-200">{faNumber(offer.amount)} <span className="text-[8px] text-amber-200/70">سکه</span></strong>
      </div>
    </div>

    <div className="relative z-10 mt-2 flex min-h-7 min-w-0 items-center gap-2 border-y border-white/[.055] py-1.5 text-[7.5px]">
      <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-slate-400">
        <Timer size={10} className={active ? 'shrink-0 text-emerald-300' : 'shrink-0 text-slate-500'}/>
        <span className="truncate">{remainingText}</span>
      </span>
      <span className="h-3 w-px shrink-0 bg-white/[.08]"/>
      <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-slate-500">
        <KindIcon size={9} className="shrink-0"/>
        <span className="truncate">{kindMeta[offer.kind].label}</span>
      </span>
      <span className={cn('mr-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[6.5px] font-black', statusMeta[offer.status].className)}>
        <span className={cn('h-1 w-1 rounded-full', statusMeta[offer.status].dot)}/>
        {statusMeta[offer.status].label}
      </span>
    </div>

    <footer className="relative z-10 grid min-w-0 grid-cols-3 gap-1.5 py-1.5 text-[6.5px] text-slate-500">
      <span className="flex min-w-0 items-center gap-1 whitespace-nowrap" title={offer.counterparty.name}>
        <ShieldCheck size={9} className="shrink-0 text-emerald-300/70"/>
        <span className="truncate">{offer.counterparty.name}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1 whitespace-nowrap" title={offer.player.nationality}>
        <Flag size={9} className="shrink-0"/>
        <span className="truncate">{offer.player.nationality}</span>
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1 whitespace-nowrap" title={`ارزش بازار ${faNumber(offer.player.marketValue)} سکه`}>
        <CircleDollarSign size={9} className="shrink-0 text-amber-300/70"/>
        <span className="truncate">ارزش {faNumber(offer.player.marketValue)}</span>
      </span>
    </footer>

    {active && (
      <div className="relative z-20 grid grid-cols-3 gap-1.5 border-t border-white/[.055] pt-2">
        <ActionButton onClick={(event) => { event.stopPropagation(); onAccept(); }} icon={Check} label="قبول" tone="accept" loading={pending} className="min-h-8 rounded-lg py-1"/>
        <ActionButton onClick={(event) => { event.stopPropagation(); onReject(); }} icon={X} label="رد" tone="reject" disabled={pending} className="min-h-8 rounded-lg py-1"/>
        <ActionButton onClick={(event) => { event.stopPropagation(); onOpen(); }} icon={ArrowLeftRight} label="پیشنهاد متقابل" tone="counter" disabled={pending} className="min-h-8 rounded-lg py-1"/>
      </div>
    )}
  </article>;
}

function ActionButton({ onClick, icon: Icon, label, tone, className, disabled = false, loading = false }: { onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; icon: typeof Check; label: string; tone: 'accept' | 'reject' | 'counter' | 'view'; className?: string; disabled?: boolean; loading?: boolean }) {
  const palette = {
    accept: 'border-emerald-300/25 bg-emerald-400/[.12] text-emerald-100',
    reject: 'border-rose-300/25 bg-rose-400/[.12] text-rose-100',
    counter: 'border-amber-300/25 bg-amber-400/[.12] text-amber-100',
    view: 'border-sky-300/25 bg-sky-400/[.12] text-sky-100',
  }[tone];
  return <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className={cn('inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[8px] font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50', palette, className)}
  >
    {loading ? <LoaderCircle size={11} className="animate-spin"/> : <Icon size={11}/>}
    <span className="truncate">{label}</span>
  </button>;
}

function CounterpartyBadge({ club }: { club: Counterparty }) {
  return <div className="relative h-12 w-12 shrink-0">
    <div
      className="grid h-full w-full place-items-center rounded-2xl border border-white/[.12] text-[14px] font-black text-white"
      style={{ background: `linear-gradient(145deg, ${club.color}33, ${club.color}11)` }}
    >
      <span style={{ color: club.color }}>{club.initials}</span>
    </div>
    <span className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full border border-ink-950 bg-ink-900 text-emerald-300">
      <ShieldCheck size={9}/>
    </span>
  </div>;
}

function PlayerAvatar({ offer, size = 'card' }: { offer: DisplayOffer; size?: 'compact' | 'card' | 'sheet' }) {
  const dims = size === 'compact' ? 'h-11 w-11' : size === 'card' ? 'h-12 w-12' : 'h-16 w-16';
  if (offer.player.demoIndex !== undefined) {
    const column = offer.player.demoIndex % 4;
    const row = Math.floor(offer.player.demoIndex / 4);
    return <span
      role="img"
      aria-label={`تصویر ${offer.player.name}`}
      className={cn('block shrink-0 rounded-2xl border-2 border-emerald-200/20 bg-cover bg-no-repeat', dims)}
      style={{ backgroundImage: "url('/assets/demo-player-sprite.png')", backgroundSize: '400% 300%', backgroundPosition: `${column * 33.333}% ${row * 50}%` }}
    />;
  }
  if (offer.player.photoUrl) {
    return <img src={offer.player.photoUrl} alt={`تصویر ${offer.player.name}`} loading="lazy" className={cn('block shrink-0 rounded-2xl border-2 border-emerald-200/20 object-cover', dims)}/>;
  }
  return <span
    role="img"
    aria-label={`نمایه ${offer.player.name}`}
    className={cn('grid shrink-0 place-items-center rounded-2xl border-2 border-emerald-200/20 bg-ink-850 text-base font-black text-emerald-200', dims)}
  >
    {offer.player.name.slice(0, 1)}
  </span>;
}

function OfferDetailsSheet({ offer, counterAmount, now, transferFeePercent, pending, onClose, onAccept, onReject, onCancel, onCounter }: { offer: DisplayOffer; counterAmount: number|undefined; now: number; transferFeePercent: number; pending: boolean; onClose: () => void; onAccept: () => void; onReject: () => void; onCancel: () => void; onCounter: (amount: number) => void }) {
  const KindIcon = kindMeta[offer.kind].icon;
  const isReceived = offer.direction === 'received';
  const active = offer.status === 'active';
  const [counterDraft, setCounterDraft] = useState<number>(Math.round(offer.amount * 1.05));
  const sheetTitle = isReceived ? `پیشنهاد ${offer.counterparty.name}` : `پیشنهاد ارسالی به ${offer.counterparty.name}`;
  return <PlayerModalFrame label={sheetTitle} onClose={onClose} swipeDisabled={pending}>
    <div className="momentum-scroll mx-auto w-full max-w-xl overflow-y-auto overscroll-contain px-3 pb-[max(16px,var(--safe-bottom))]">
      <section className="relative overflow-hidden rounded-[1.45rem] border border-white/[.08] bg-gradient-to-l from-white/[.04] to-transparent p-3">
        <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-emerald-400/[.08] blur-3xl"/>
        <div className="relative flex items-center gap-3">
          <PlayerAvatar offer={offer} size="sheet"/>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black', kindMeta[offer.kind].className)}>
                <KindIcon size={9}/>{kindMeta[offer.kind].label}
              </span>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black', statusMeta[offer.status].className)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta[offer.status].dot)}/>
                {statusMeta[offer.status].label}
              </span>
            </div>
            <h2 className="mt-1.5 truncate text-base font-black">{offer.player.name}</h2>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[8.5px] text-slate-400">
              <ShieldCheck size={11} className="shrink-0 text-emerald-300"/>
              {offer.counterparty.name}
              <span className="text-white/15">•</span>
              <Building2 size={11} className="shrink-0"/>
              {offer.player.club}
              <span className="text-white/15">•</span>
              <Flag size={11} className="shrink-0"/>
              {offer.player.nationality}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-2 grid grid-cols-2 gap-1.5" aria-label="جزئیات پیشنهاد">
        <DetailStat icon={CircleDollarSign} label="مبلغ پیشنهاد" value={`${faNumber(offer.amount)} سکه`} accent="amber"/>
        {offer.listingAskingPrice !== undefined && <DetailStat icon={BadgeDollarSign} label="قیمت درخواستی" value={`${faNumber(offer.listingAskingPrice)} سکه`} accent="violet"/>}
        <DetailStat icon={CalendarClock} label="تاریخ ثبت" value={tehranDate(offer.createdAt)} accent="emerald"/>
        <DetailStat icon={Timer} label="انقضا" value={tehranDate(offer.expiresAt)} accent="sky"/>
        <DetailStat icon={Timer} label="زمان باقی‌مانده" value={remaining(offer.expiresAt, now)} accent="emerald"/>
        <DetailStat icon={Clock3} label="مهلت پاسخ" value={`${faNumber(Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - now) / 3_600_000)))} ساعت`} accent="sky"/>
      </section>

      <section className="mt-2 rounded-[1.35rem] border border-white/[.07] bg-white/[.03] p-3" aria-label="اطلاعات بازیکن">
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-black text-slate-200"><Shirt size={12} className="text-emerald-300"/>پروفایل بازیکن</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <DetailStat icon={Shirt} label="پست" value={`${positionLabel(offer.player.position)} · ${offer.player.position}`} accent="emerald"/>
          <DetailStat icon={BadgeDollarSign} label="ارزش بازار" value={`${faNumber(offer.player.marketValue)} سکه`} accent="amber"/>
          <DetailStat icon={Flag} label="ملیت" value={offer.player.nationality} accent="sky"/>
          <DetailStat icon={Building2} label="باشگاه فعلی" value={offer.player.club} accent="sky"/>
          <DetailStat icon={UserRound} label="وضعیت قرارداد" value={offer.player.contractStatus || 'ثبت نشده'} accent="violet"/>
        </div>
      </section>

      {counterAmount !== undefined && (
        <section className="mt-2 rounded-[1.25rem] border border-amber-300/15 bg-amber-400/[.06] p-3">
          <div className="flex items-start gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-400/[.12] text-amber-200"><ArrowLeftRight size={13}/></span>
            <div className="min-w-0 flex-1">
              <p className="text-[7.5px] font-black text-amber-200">پیشنهاد متقابل ثبت‌شده</p>
              <p className="mt-1 text-[11px] font-black text-amber-50">{faNumber(counterAmount)} سکه</p>
              <p className="mt-1 text-[7.5px] leading-5 text-amber-100/80">این مبلغ جایگزین پیشنهاد فعلی شما می‌شود و پس از تأیید باشگاه مقابل نهایی خواهد شد.</p>
            </div>
          </div>
        </section>
      )}

      {offer.note && <section className="mt-2 rounded-[1.25rem] border border-amber-300/15 bg-amber-400/[.06] p-3">
        <div className="flex items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-400/[.12] text-amber-200"><Sparkles size={13}/></span>
          <div className="min-w-0 flex-1">
            <p className="text-[7.5px] font-black text-amber-200">یادداشت همراه پیشنهاد</p>
            <p className="mt-1 text-[9.5px] leading-5 text-amber-50/90">{offer.note}</p>
          </div>
        </div>
      </section>}

      {active && isReceived && (
        <section className="mt-2 rounded-[1.35rem] border border-emerald-300/15 bg-emerald-400/[.05] p-3" aria-label="پیشنهاد متقابل">
          <h3 className="flex items-center gap-1.5 text-[10px] font-black text-emerald-100"><ArrowLeftRight size={12}/>ثبت پیشنهاد متقابل</h3>
          <p className="mt-1 text-[8px] leading-5 text-slate-400">مبلغ دلخواه برای پیشنهاد جایگزین را وارد کن. پیشنهاد متقابل شما جایگزین پیشنهاد فعلی می‌شود.</p>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/[.08] bg-ink-950/70 px-3 py-2">
            <CircleDollarSign size={14} className="text-amber-300"/>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={counterDraft}
              onChange={event => setCounterDraft(Math.max(0, Number(event.target.value) || 0))}
              className="min-w-0 flex-1 bg-transparent text-[11px] font-black text-white outline-none"
              aria-label="مبلغ پیشنهاد متقابل"
            />
            <span className="text-[8px] text-slate-400">سکه</span>
          </div>
          <button
            type="button"
            onClick={() => onCounter(counterDraft)}
            disabled={pending || counterDraft < 1}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-amber-300/25 bg-amber-400/[.13] text-[9.5px] font-black text-amber-100 active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <LoaderCircle size={12} className="animate-spin"/> : <ArrowLeftRight size={12}/>}ارسال پیشنهاد متقابل
          </button>
        </section>
      )}

      {active ? (
        <section className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {transferFeePercent > 0 && <p className="rounded-xl border border-white/[.06] bg-white/[.03] px-3 py-2 text-[7.5px] leading-5 text-slate-400 sm:col-span-3">در انتقال نهایی، {faNumber(transferFeePercent)}٪ کارمزد از سهم فروشنده کسر می‌شود.</p>}
          {isReceived ? (
            <>
              <ActionButton onClick={onAccept} icon={Check} label="قبول پیشنهاد" tone="accept" loading={pending}/>
              <ActionButton onClick={onReject} icon={X} label="رد پیشنهاد" tone="reject" disabled={pending}/>
              <ActionButton onClick={() => onCounter(counterDraft)} icon={ArrowLeftRight} label="پیشنهاد متقابل" tone="counter" disabled={pending || counterDraft < 1}/>
            </>
          ) : (
            <>
              <ActionButton onClick={onCancel} icon={X} label="لغو پیشنهاد" tone="reject" loading={pending}/>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-white/[.08] bg-white/[.05] text-[9.5px] font-black text-slate-200 active:scale-[.985] sm:col-span-2"
              >
                <ChevronLeft size={14}/>بازگشت
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="mt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-white/[.08] bg-white/[.05] text-[9.5px] font-black text-slate-200 active:scale-[.985]"
          >
            <ChevronLeft size={14}/>بستن جزئیات
          </button>
        </section>
      )}
    </div>
  </PlayerModalFrame>;
}

function EmptyState({ direction }: { direction: OfferDirection }) {
  const isReceived = direction === 'received';
  return <section className="rounded-[1.5rem] border border-dashed border-white/[.09] bg-white/[.025] px-4 py-10 text-center">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[.04] text-slate-500">
      {isReceived ? <Inbox size={20}/> : <Send size={20}/>}
    </span>
    <h2 className="mt-3 text-xs font-black">{isReceived ? 'پیشنهاد دریافتی نداری' : 'پیشنهاد ارسالی نداری'}</h2>
    <p className="mt-1 text-[9px] leading-5 text-slate-500">{isReceived ? 'وقتی باشگاه دیگری برای بازیکنانت پیشنهاد بفرستد، اینجا نمایش داده می‌شود.' : 'وقتی برای بازیکنی در بازار پیشنهاد بفرستی، اینجا قابل پیگیری است.'}</p>
  </section>;
}

function DetailStat({ icon: Icon, label, value, accent }: { icon: typeof CircleDollarSign; label: string; value: string; accent: 'emerald' | 'amber' | 'sky' | 'violet' }) {
  const palette = {
    emerald: 'bg-emerald-400/[.08] text-emerald-300',
    amber: 'bg-amber-400/[.08] text-amber-300',
    sky: 'bg-sky-400/[.08] text-sky-300',
    violet: 'bg-violet-400/[.08] text-violet-300',
  }[accent];
  return <div className="flex min-h-[50px] items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.035] p-2">
    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', palette)}><Icon size={12}/></span>
    <span className="min-w-0 flex-1">
      <span className="block text-[6.5px] text-slate-500">{label}</span>
      <strong className="mt-0.5 block truncate text-[8.5px] text-slate-100">{value}</strong>
    </span>
  </div>;
}

function toDisplayOffer(offer: TradeOfferView): DisplayOffer {
  const colorPalette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
  const colorIndex = [...offer.counterparty._id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colorPalette.length;
  return {
    id: offer._id,
    direction: offer.direction,
    kind: offer.kind,
    status: offer.status,
    amount: offer.amount,
    createdAt: offer.createdAt,
    expiresAt: offer.expiresAt,
    note: offer.note,
    player: {
      id: offer.player._id,
      name: offer.player.name,
      position: offer.player.position,
      nationality: offer.player.nationality ?? 'ثبت نشده',
      club: offer.player.club ?? 'ثبت نشده',
      marketValue: offer.player.marketValue ?? 0,
      photoUrl: offer.player.photoUrl,
      contractStatus: offer.player.contractStatus,
    },
    counterparty: {
      id: offer.counterparty._id,
      name: offer.counterparty.name,
      shortName: offer.counterparty.name,
      initials: offer.counterparty.name.slice(0, 1),
      color: colorPalette[colorIndex],
      photoUrl: offer.counterparty.photoUrl,
    },
    listingAskingPrice: offer.listingAskingPrice,
    isDemo: false,
  };
}

function positionLabel(position: ClubPlayer['position']) {
  const labels: Record<ClubPlayer['position'], string> = { GK: 'دروازه‌بان', RB: 'مدافع راست', CB: 'مدافع میانی', LB: 'مدافع چپ', DM: 'هافبک دفاعی', CM: 'هافبک میانی', AM: 'هافبک هجومی', RW: 'وینگر راست', LW: 'وینگر چپ', ST: 'مهاجم' };
  return labels[position];
}
