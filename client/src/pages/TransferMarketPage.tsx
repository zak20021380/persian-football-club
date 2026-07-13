import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BadgeDollarSign, Building2, CalendarClock, ChevronLeft, CircleDollarSign, Clock3, Flag, HandCoins, LoaderCircle, Search, Shirt, Tags, UserRound, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { ErrorState, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNumber, remaining, tehranDate } from '@/lib/utils';
import type { ClubPlayer, TransferMarketData, TransferMarketListing } from '@/types/api';

type MarketPlayer = TransferMarketListing & { demoIndex?: number; isDemo?: boolean };
type PositionFilter = 'all'|'GK'|'DEF'|'MID'|'FWD';
type PriceFilter = 'all'|'under5'|'5to10'|'over10';
type StatusFilter = 'all'|'active'|'negotiable'|'sold';

const demoListings = (): MarketPlayer[] => {
  const now = Date.now();
  const hours = (value: number) => new Date(now + value * 3_600_000).toISOString();
  return [
    { _id: 'demo-market-1', name: 'مهدی طارمی', position: 'ST', nationality: 'ایران', club: 'اینتر', marketValue: 8600, askingPrice: 9400, status: 'active', expiresAt: hours(28), sellerClub: 'پرسپولیس', activeOfferCount: 3, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 9, isDemo: true },
    { _id: 'demo-market-2', name: 'سامان قدوس', position: 'AM', nationality: 'ایران', club: 'برنتفورد', marketValue: 5900, askingPrice: 6200, status: 'negotiable', expiresAt: hours(5), sellerClub: 'سپاهان', activeOfferCount: 1, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 6, isDemo: true },
    { _id: 'demo-market-3', name: 'شجاع خلیل‌زاده', position: 'CB', nationality: 'ایران', club: 'تراکتور', marketValue: 4300, askingPrice: 4700, status: 'active', expiresAt: hours(51), sellerClub: 'تراکتور', activeOfferCount: 2, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: true, demoIndex: 2, isDemo: true },
    { _id: 'demo-market-4', name: 'پیام نیازمند', position: 'GK', nationality: 'ایران', club: 'سپاهان', marketValue: 5100, askingPrice: 5400, status: 'negotiable', expiresAt: hours(16), sellerClub: 'گل‌گهر', activeOfferCount: 0, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 0, isDemo: true },
    { _id: 'demo-market-5', name: 'رامین رضاییان', position: 'RB', nationality: 'ایران', club: 'استقلال', marketValue: 4800, askingPrice: 5200, status: 'sold', expiresAt: hours(-3), sellerClub: 'استقلال', activeOfferCount: 0, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 4, isDemo: true },
    { _id: 'demo-market-6', name: 'مهدی قایدی', position: 'LW', nationality: 'ایران', club: 'الاتحاد کلبا', marketValue: 7200, askingPrice: 7600, status: 'active', expiresAt: hours(72), sellerClub: 'فولاد', activeOfferCount: 4, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 8, isDemo: true },
    { _id: 'demo-market-7', name: 'سعید عزت‌اللهی', position: 'CM', nationality: 'ایران', club: 'شباب الاهلی', marketValue: 6100, askingPrice: 6500, status: 'negotiable', expiresAt: hours(34), sellerClub: 'ملوان', activeOfferCount: 1, ownedByCurrentUser: true, hasActiveOfferFromCurrentUser: false, demoIndex: 5, isDemo: true },
    { _id: 'demo-market-8', name: 'علیرضا جهانبخش', position: 'RW', nationality: 'ایران', club: 'فاینورد', marketValue: 5400, askingPrice: 5900, status: 'active', expiresAt: hours(9), sellerClub: 'ذوب‌آهن', activeOfferCount: 2, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 10, isDemo: true },
    { _id: 'demo-market-9', name: 'حسین کنعانی', position: 'CB', nationality: 'ایران', club: 'پرسپولیس', marketValue: 3900, askingPrice: 4100, status: 'sold', expiresAt: hours(-18), sellerClub: 'پرسپولیس', activeOfferCount: 0, ownedByCurrentUser: false, hasActiveOfferFromCurrentUser: false, demoIndex: 3, isDemo: true },
  ];
};

const statusMeta = {
  active: { label: 'برای فروش', className: 'border-emerald-300/25 bg-emerald-400/[.11] text-emerald-200' },
  negotiable: { label: 'قابل مذاکره', className: 'border-amber-300/25 bg-amber-400/[.1] text-amber-200' },
  sold: { label: 'فروخته شد', className: 'border-slate-400/20 bg-slate-500/[.12] text-slate-300' },
} as const;

export function TransferMarketPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PositionFilter>('all');
  const [price, setPrice] = useState<PriceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<MarketPlayer|null>(null);
  const [now, setNow] = useState(() => Date.now());
  const marketQuery = useQuery({ queryKey: ['transferMarket'], queryFn: async () => (await api.get<TransferMarketData>('/club/market')).data });
  const demoMode = Boolean(import.meta.env.DEV && marketQuery.data && marketQuery.data.listings.length === 0);
  const listings = useMemo<MarketPlayer[]>(() => demoMode ? demoListings() : marketQuery.data?.listings ?? [], [demoMode, marketQuery.data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => listings.filter(player => {
    const text = query.trim().toLocaleLowerCase('fa');
    const ask = player.askingPrice ?? player.marketValue ?? 0;
    const matchesText = !text || `${player.name} ${player.club ?? ''} ${player.nationality ?? ''} ${player.sellerClub}`.toLocaleLowerCase('fa').includes(text);
    const matchesPosition = position === 'all' || positionGroup(player.position) === position;
    const matchesPrice = price === 'all' || (price === 'under5' && ask < 5_000) || (price === '5to10' && ask >= 5_000 && ask <= 10_000) || (price === 'over10' && ask > 10_000);
    const matchesStatus = status === 'all' || player.status === status;
    return matchesText && matchesPosition && matchesPrice && matchesStatus;
  }), [listings, position, price, query, status]);

  const offerMutation = useMutation({
    mutationFn: async ({ player, amount }: { player: MarketPlayer; amount: number }) => {
      if (player.isDemo) return { demo: true };
      return (await api.post('/club/offers', { playerId: player._id, amount, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), clientRequestId: crypto.randomUUID() })).data;
    },
    onSuccess: async (data, variables) => {
      if ((data as { demo?: boolean }).demo) {
        toast.success('پیشنهاد فقط در پیش‌نمایش ثبت شد');
        setSelected(null);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transferMarket'] }),
        queryClient.invalidateQueries({ queryKey: ['tradeOffers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubPlayers'] }),
      ]);
      toast.success(`پیشنهاد خرید برای «${variables.player.name}» ارسال شد`);
      setSelected(null);
    },
    onError: error => toast.error((error as Error).message || 'ارسال پیشنهاد انجام نشد'),
  });

  if (marketQuery.isLoading) return <><PageHeader title="بازار نقل‌وانتقالات" subtitle="باشگاه من" back backTo="/club"/><PageSkeleton/></>;
  if (marketQuery.error || !marketQuery.data) return <><PageHeader title="بازار نقل‌وانتقالات" subtitle="باشگاه من" back backTo="/club"/><main className="p-4"><ErrorState message={(marketQuery.error as Error)?.message || 'بازار دریافت نشد'} onRetry={() => marketQuery.refetch()}/></main></>;

  return <>
    <PageHeader title="بازار نقل‌وانتقالات" subtitle="باشگاه من" back backTo="/club"/>
    <main className="space-y-3 px-3 pb-6 pt-3 sm:px-4">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-sky-300/[.1] bg-[linear-gradient(145deg,rgba(11,36,49,.97),rgba(8,20,35,.99))] p-3.5">
        <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-sky-400/[.08] blur-3xl"/>
        <div className="relative flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-400/[.1] text-sky-300"><UsersRound size={19}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><h1 className="text-xs font-black">بازار بازیکنان</h1>{demoMode && <span className="rounded-full border border-amber-300/20 bg-amber-300/[.09] px-2 py-0.5 text-[6.5px] font-black text-amber-200">نمایش آزمایشی</span>}</div><p className="mt-1 text-[8px] leading-4 text-slate-400">بازیکن مناسب را پیدا کن و پیشنهاد خرید امن بفرست.</p></div><span className="shrink-0 text-left"><span className="block text-[6px] text-slate-500">موجودی</span><strong className="mt-0.5 block text-[9px] text-amber-300">{faNumber(marketQuery.data.userBalance)} سکه</strong></span></div>
      </section>

      <section aria-label="جست‌وجو و فیلتر بازار" className="rounded-[1.35rem] border border-white/[.07] bg-ink-900/90 p-2.5">
        <label className="relative block"><Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی بازیکن، باشگاه یا ملیت" className="h-10 w-full rounded-xl border border-white/[.07] bg-ink-950/70 pr-9 pl-3 text-[9px] outline-none placeholder:text-slate-600 focus:border-sky-300/35"/></label>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <FilterSelect label="فیلتر پست" value={position} onChange={value => setPosition(value as PositionFilter)} options={[['all','همه پست‌ها'],['GK','دروازه‌بان'],['DEF','مدافع'],['MID','هافبک'],['FWD','مهاجم']]}/>
          <FilterSelect label="فیلتر قیمت" value={price} onChange={value => setPrice(value as PriceFilter)} options={[['all','همه قیمت‌ها'],['under5','زیر ۵٬۰۰۰'],['5to10','۵ تا ۱۰ هزار'],['over10','بالای ۱۰ هزار']]}/>
          <FilterSelect label="فیلتر وضعیت" value={status} onChange={value => setStatus(value as StatusFilter)} options={[['all','همه وضعیت‌ها'],['active','برای فروش'],['negotiable','قابل مذاکره'],['sold','فروخته شد']]}/>
        </div>
      </section>

      <div className="flex items-center justify-between px-0.5"><h2 className="text-[10px] font-black">فهرست بازار</h2><span className="text-[8px] text-slate-500">{faNumber(filtered.length)} بازیکن</span></div>
      {filtered.length ? <section aria-label="بازیکنان بازار" className="space-y-2">{filtered.map((player, index) => <MarketRow key={player._id} player={player} now={now} index={index} onOpen={() => setSelected(player)}/>)}</section> : <EmptyMarket filtered={listings.length > 0}/>} 
    </main>
    {selected && <MarketDetailsModal player={selected} now={now} balance={marketQuery.data.userBalance} loading={offerMutation.isPending} onClose={() => setSelected(null)} onSubmit={amount => { if (!offerMutation.isPending) offerMutation.mutate({ player: selected, amount }); }}/>} 
  </>;
}

function MarketRow({ player, now, index, onOpen }: { player: MarketPlayer; now: number; index: number; onOpen: () => void }) {
  const price = player.askingPrice ?? player.marketValue;
  const timeBadge = remainingBadge(player.expiresAt, now, player.status);
  return <button type="button" onClick={onOpen} aria-label={`مشاهده آگهی ${player.name}`} style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }} className="offer-card flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-[1.25rem] border border-white/[.075] bg-[linear-gradient(155deg,rgba(15,30,47,.97),rgba(8,20,35,.99))] p-2.5 text-right shadow-[0_8px_20px_rgba(0,0,0,.14)] transition active:scale-[.992]">
    <PlayerPhoto player={player} className="h-[62px] w-[58px] shrink-0 rounded-2xl border border-white/[.1]"/>
    <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-1.5"><strong className="truncate text-[10.5px] font-black text-white">{player.name}</strong><i className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[6px] font-black not-italic', statusMeta[player.status].className)}>{statusMeta[player.status].label}</i></span><span className="mt-1 flex min-w-0 items-center gap-1 truncate text-[7px] text-slate-400"><Shirt size={9} className="shrink-0 text-emerald-300"/>{positionLabel(player.position)}<span className="text-white/15">•</span><Building2 size={9} className="shrink-0"/>{player.club || 'باشگاه ثبت نشده'}</span><span className="mt-2 flex min-w-0 items-end justify-between gap-2"><span className="min-w-0"><span className="block text-[6px] text-slate-500">قیمت بازار</span><b className="mt-0.5 block truncate text-[8px] font-black text-amber-200">{formatCoins(price)}</b></span><span className={cn('flex shrink-0 items-center gap-1 text-[7px] font-bold', timeBadge.className)}><Clock3 size={9} className="shrink-0"/>{timeBadge.text}</span></span></span>
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[.045] text-slate-400"><ChevronLeft size={15}/><span className="sr-only">مشاهده</span></span>
  </button>;
}

function MarketDetailsModal({ player, now, balance, loading, onClose, onSubmit }: { player: MarketPlayer; now: number; balance: number; loading: boolean; onClose: () => void; onSubmit: (amount: number) => void }) {
  const basePrice = player.askingPrice ?? player.marketValue ?? 1;
  const [amount, setAmount] = useState(basePrice);
  const expired = Boolean(player.expiresAt && new Date(player.expiresAt).getTime() <= now);
  const sold = player.status === 'sold';
  const minAmount = player.status === 'active' ? basePrice : 1;
  const belowAsking = player.status === 'active' && amount < basePrice;
  const insufficient = amount > balance;
  const blockedReason = sold ? 'این بازیکن فروخته شده است' : expired ? 'مهلت این آگهی تمام شده است' : player.ownedByCurrentUser ? 'این بازیکن متعلق به باشگاه شماست' : player.hasActiveOfferFromCurrentUser ? 'برای این بازیکن پیشنهاد فعال دارید' : belowAsking ? 'مبلغ کمتر از قیمت درخواستی است' : insufficient ? 'موجودی سکه کافی نیست' : null;
  return <PlayerModalFrame label={`جزئیات آگهی ${player.name}`} onClose={onClose} swipeDisabled={loading}>
    <div className="momentum-scroll mx-auto w-full max-w-xl overflow-y-auto overscroll-contain px-3 pb-[max(16px,var(--safe-bottom))]">
      <section className="relative overflow-hidden rounded-[1.4rem] border border-white/[.08] bg-gradient-to-l from-sky-400/[.06] to-white/[.025] p-3">
        <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-sky-400/[.09] blur-3xl"/>
        <div className="relative flex items-center gap-3"><PlayerPhoto player={player} className="h-[82px] w-[76px] shrink-0 rounded-[1.25rem] border-2 border-sky-200/20"/><div className="min-w-0 flex-1"><span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[7px] font-black', statusMeta[player.status].className)}>{statusMeta[player.status].label}</span><h2 className="mt-1.5 truncate text-base font-black">{player.name}</h2><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[8px] text-slate-400"><Building2 size={10} className="shrink-0"/>{player.club || 'باشگاه ثبت نشده'}<span className="text-white/15">•</span><Flag size={10} className="shrink-0"/>{player.nationality || 'ملیت ثبت نشده'}</p></div></div>
      </section>

      <section className="mt-2 grid grid-cols-2 gap-1.5" aria-label="اطلاعات آگهی">
        <InfoCard icon={<Shirt size={13}/>} label="پست اصلی" value={`${positionLabel(player.position)} · ${player.position}`}/>
        <InfoCard icon={<BadgeDollarSign size={13}/>} label="قیمت درخواستی" value={formatCoins(basePrice)}/>
        <InfoCard icon={<Building2 size={13}/>} label="باشگاه فروشنده" value={player.sellerClub}/>
        <InfoCard icon={<Tags size={13}/>} label="وضعیت آگهی" value={statusMeta[player.status].label}/>
        <InfoCard icon={<CalendarClock size={13}/>} label="انقضای آگهی" value={player.expiresAt ? tehranDate(player.expiresAt) : 'بدون محدودیت'}/>
        <InfoCard icon={<HandCoins size={13}/>} label="پیشنهاد فعال" value={`${faNumber(player.activeOfferCount)} پیشنهاد`}/>
      </section>

      <section className="mt-2 rounded-[1.3rem] border border-amber-300/[.13] bg-amber-400/[.045] p-3">
        <div className="flex items-center justify-between gap-2"><span><span className="block text-[7px] text-slate-500">مبلغ پیشنهاد خرید</span><strong className="mt-0.5 block text-[9px] text-amber-100">موجودی شما: {faNumber(balance)} سکه</strong></span><CircleDollarSign size={20} className="text-amber-300"/></div>
        <label className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-white/[.08] bg-ink-950/70 px-3"><input type="number" inputMode="numeric" min={minAmount} value={amount} disabled={sold || expired || player.ownedByCurrentUser || player.hasActiveOfferFromCurrentUser} onChange={event => setAmount(Math.max(0, Number(event.target.value) || 0))} className="min-w-0 flex-1 bg-transparent text-[11px] font-black outline-none disabled:opacity-50" aria-label="مبلغ پیشنهاد خرید"/><span className="text-[8px] text-slate-400">سکه</span></label>
        {blockedReason && <p className="mt-2 rounded-xl border border-rose-300/[.12] bg-rose-400/[.055] px-3 py-2 text-center text-[7.5px] font-bold text-rose-200">{blockedReason}</p>}
        <button type="button" disabled={Boolean(blockedReason) || loading || amount < 1} onClick={() => onSubmit(amount)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-sky-400 to-emerald-400 text-[9.5px] font-black text-ink-950 transition active:scale-[.985] disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-300 disabled:opacity-55">{loading ? <LoaderCircle size={14} className="animate-spin"/> : <HandCoins size={14}/>}ارسال پیشنهاد خرید</button>
      </section>
    </div>
  </PlayerModalFrame>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string,string]> }) {
  return <label className="min-w-0"><span className="sr-only">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-9 w-full min-w-0 rounded-xl border border-white/[.07] bg-ink-950 px-1.5 text-[7px] font-bold text-slate-300 outline-none">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function PlayerPhoto({ player, className }: { player: MarketPlayer; className?: string }) {
  if (player.demoIndex !== undefined) {
    const column = player.demoIndex % 4;
    const row = Math.floor(player.demoIndex / 4);
    return <span role="img" aria-label={`تصویر ${player.name}`} className={cn('block bg-cover bg-no-repeat', className)} style={{ backgroundImage: "url('/assets/demo-player-sprite.png')", backgroundSize: '400% 300%', backgroundPosition: `${column * 33.333}% ${row * 50}%` }}/>;
  }
  return player.photoUrl ? <img src={player.photoUrl} alt={`تصویر ${player.name}`} loading="lazy" className={cn('block object-cover', className)}/> : <span role="img" aria-label={`نمایه ${player.name}`} className={cn('grid place-items-center bg-ink-850 text-lg font-black text-sky-300', className)}>{player.name.slice(0, 1)}</span>;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex min-h-[50px] min-w-0 items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.035] p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-400/[.08] text-sky-300">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[6px] text-slate-500">{label}</span><strong className="mt-0.5 block truncate text-[7px] text-slate-100">{value}</strong></span></div>;
}

function EmptyMarket({ filtered }: { filtered: boolean }) {
  return <section className="rounded-[1.5rem] border border-dashed border-white/[.09] bg-white/[.025] px-4 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[.04] text-slate-500">{filtered ? <Search size={20}/> : <UserRound size={20}/>}</span><h2 className="mt-3 text-xs font-black">{filtered ? 'بازیکنی با این فیلتر پیدا نشد' : 'بازیکنی در بازار نیست'}</h2><p className="mt-1 text-[9px] text-slate-500">{filtered ? 'جست‌وجو یا فیلترها را تغییر بده.' : 'در حال حاضر آگهی فعالی ثبت نشده است.'}</p></section>;
}

function remainingBadge(expiresAt: string | undefined, now: number, status: MarketPlayer['status']) {
  if (status === 'sold') return { text: 'پایان یافته', className: 'text-rose-300' };
  if (!expiresAt) return { text: 'بدون محدودیت', className: 'text-slate-400' };
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return { text: 'پایان یافته', className: 'text-rose-300' };
  const expiringSoon = ms <= 24 * 3_600_000;
  return { text: remaining(expiresAt, now), className: expiringSoon ? 'text-amber-300' : 'text-emerald-300' };
}

function positionGroup(position: ClubPlayer['position']): Exclude<PositionFilter,'all'> { if (position === 'GK') return 'GK'; if (['RB','CB','LB'].includes(position)) return 'DEF'; if (['DM','CM','AM'].includes(position)) return 'MID'; return 'FWD'; }
function positionLabel(position: ClubPlayer['position']) { return ({ GK: 'دروازه‌بان', RB: 'مدافع راست', CB: 'مدافع میانی', LB: 'مدافع چپ', DM: 'هافبک دفاعی', CM: 'هافبک میانی', AM: 'هافبک هجومی', RW: 'وینگر راست', LW: 'وینگر چپ', ST: 'مهاجم' } as const)[position]; }
function formatCoins(value?: number) { return value === undefined ? 'ثبت نشده' : `${faNumber(value)} سکه`; }
