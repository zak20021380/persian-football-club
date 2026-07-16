import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeDollarSign, Building2, CalendarClock, CircleDollarSign, Clock3, Flag, Handshake, Search, Shirt, Tags, UserRound, UsersRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { ErrorState, PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { isDemoDataEnabled } from '@/lib/featureFlags';
import { cn, faNumber } from '@/lib/utils';
import type { ClubPlayer, ClubPlayersData, PlayerTransferOffer } from '@/types/api';

type DisplayPlayer = ClubPlayer & { demoIndex?: number };
type PositionFilter = 'all'|'GK'|'DEF'|'MID'|'FWD';
type TransferFilter = 'all'|'listed'|'offers'|'not-listed';

const demoPlayers: DisplayPlayer[] = [
  { _id: 'demo-player-1', name: 'مهدی طارمی', position: 'ST', overall: 88, nationality: 'ایران', club: 'اینتر', marketValue: 8600, contractStatus: 'آماده بازی', demoIndex: 9, transferListing: { isListed: true, askingPrice: 9400, status: 'active', expiresAt: '2026-07-17T17:30:00.000Z' }, transferOffers: [
    { _id: 'demo-offer-1', amount: 8900, status: 'active', createdAt: '2026-07-13T09:20:00.000Z', expiresAt: '2026-07-14T17:30:00.000Z' },
    { _id: 'demo-offer-2', amount: 9150, status: 'active', createdAt: '2026-07-13T12:05:00.000Z', expiresAt: '2026-07-15T12:05:00.000Z' },
    { _id: 'demo-offer-3', amount: 9000, status: 'active', createdAt: '2026-07-12T18:40:00.000Z', expiresAt: '2026-07-14T18:40:00.000Z' },
  ] },
  { _id: 'demo-player-2', name: 'مهدی قایدی', position: 'LW', overall: 85, nationality: 'ایران', club: 'الاتحاد کلبا', marketValue: 7200, contractStatus: 'آماده بازی', demoIndex: 8, transferListing: { isListed: false }, transferOffers: [] },
  { _id: 'demo-player-3', name: 'سامان قدوس', position: 'AM', overall: 84, nationality: 'ایران', club: 'برنتفورد', marketValue: 5900, contractStatus: 'آماده بازی', demoIndex: 6, transferListing: { isListed: true, askingPrice: 6400, status: 'active', expiresAt: '2026-07-18T15:00:00.000Z' }, transferOffers: [
    { _id: 'demo-offer-4', amount: 6100, status: 'active', createdAt: '2026-07-13T07:35:00.000Z', expiresAt: '2026-07-15T07:35:00.000Z' },
  ] },
  { _id: 'demo-player-4', name: 'شجاع خلیل‌زاده', position: 'CB', overall: 82, nationality: 'ایران', club: 'تراکتور', marketValue: 4300, contractStatus: 'آماده بازی', demoIndex: 2, transferListing: { isListed: false }, transferOffers: [] },
  { _id: 'demo-player-5', name: 'رامین رضاییان', position: 'RB', overall: 83, nationality: 'ایران', club: 'استقلال', marketValue: 4800, contractStatus: 'آماده بازی', demoIndex: 4, transferListing: { isListed: true, askingPrice: 5200, status: 'paused' }, transferOffers: [] },
  { _id: 'demo-player-6', name: 'پیام نیازمند', position: 'GK', overall: 84, nationality: 'ایران', club: 'سپاهان', marketValue: 5100, contractStatus: 'آماده بازی', demoIndex: 0, transferListing: { isListed: false }, transferOffers: [] },
];

const positionOptions: Array<{ value: PositionFilter; label: string }> = [
  { value: 'all', label: 'همه پست‌ها' }, { value: 'GK', label: 'دروازه‌بان' }, { value: 'DEF', label: 'مدافع' }, { value: 'MID', label: 'هافبک' }, { value: 'FWD', label: 'مهاجم' },
];

const transferOptions: Array<{ value: TransferFilter; label: string }> = [
  { value: 'all', label: 'همه وضعیت‌ها' }, { value: 'offers', label: 'دارای پیشنهاد' }, { value: 'listed', label: 'در بازار' }, { value: 'not-listed', label: 'خارج از بازار' },
];

export function PlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PositionFilter>('all');
  const [transfer, setTransfer] = useState<TransferFilter>('all');
  const playersQuery = useQuery({ queryKey: ['clubPlayers'], queryFn: async () => (await api.get<ClubPlayersData>('/club/players')).data });
  const demoMode = Boolean(isDemoDataEnabled() && playersQuery.data && playersQuery.data.players.length === 0);
  const players = useMemo<DisplayPlayer[]>(() => demoMode ? demoPlayers : playersQuery.data?.players ?? [], [demoMode, playersQuery.data]);
  const filteredPlayers = useMemo(() => players.filter(player => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    const matchesQuery = !normalizedQuery || `${player.name} ${player.club ?? ''} ${player.nationality ?? ''}`.toLocaleLowerCase('fa').includes(normalizedQuery);
    const matchesPosition = position === 'all' || positionGroup(player.position) === position;
    const activeOffers = player.transferOffers?.filter(offer => offer.status === 'active').length ?? 0;
    const matchesTransfer = transfer === 'all'
      || (transfer === 'offers' && activeOffers > 0)
      || (transfer === 'listed' && player.transferListing?.isListed === true)
      || (transfer === 'not-listed' && player.transferListing?.isListed !== true);
    return matchesQuery && matchesPosition && matchesTransfer;
  }), [players, position, query, transfer]);
  const selectedPlayer = players.find(player => player._id === searchParams.get('player')) ?? null;

  const openPlayer = (player: DisplayPlayer) => {
    const next = new URLSearchParams(searchParams);
    next.set('player', player._id);
    setSearchParams(next, { replace: false });
  };
  const closePlayer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('player');
    setSearchParams(next, { replace: true });
  };

  if (playersQuery.isLoading) return <><PageHeader title="بازیکنان من" subtitle="مجموعه بازیکنان باشگاه" back backTo="/club" tone="mint" eyebrow="SQUAD LIST / PLAYERS"/><PageSkeleton/></>;
  if (playersQuery.error || !playersQuery.data) return <><PageHeader title="بازیکنان من" subtitle="مجموعه بازیکنان باشگاه" back backTo="/club" tone="mint" eyebrow="SQUAD LIST / PLAYERS"/><main className="p-4"><ErrorState message={(playersQuery.error as Error)?.message || 'بازیکنان دریافت نشدند'} onRetry={() => playersQuery.refetch()}/></main></>;

  return <div className="min-h-screen max-w-full overflow-x-hidden">
    <PageHeader title="بازیکنان من" subtitle={`${faNumber(players.length)} بازیکن در باشگاه`} back backTo="/club" tone="mint" eyebrow="SQUAD LIST / PLAYERS"/>
    <main className="space-y-3 px-3 pb-5 pt-3 sm:px-4">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-emerald-300/[.1] bg-[linear-gradient(145deg,rgba(15,39,48,.96),rgba(10,24,40,.98))] p-3.5">
        <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-emerald-400/[.08] blur-3xl"/>
        <div className="relative flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-400/[.1] text-emerald-300"><UsersRound size={19}/></span><div className="min-w-0 flex-1"><h2 className="text-xs font-black">مجموعه بازیکنان باشگاه</h2><p className="mt-1 text-[8px] leading-4 text-slate-400">ارزش، وضعیت بازار و پیشنهادهای هر بازیکن را یک‌جا ببین.</p></div>{demoMode && <span className="shrink-0 rounded-full border border-amber-300/15 bg-amber-300/[.08] px-2 py-1 text-[7px] font-bold text-amber-200">نمایش آزمایشی</span>}</div>
      </section>

      <section aria-label="جست‌وجو و فیلتر بازیکنان" className="rounded-[1.35rem] border border-white/[.07] bg-ink-900/90 p-2.5">
        <label className="relative block"><Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="جست‌وجوی نام، باشگاه یا ملیت" className="h-10 w-full rounded-xl border border-white/[.07] bg-ink-950/70 pr-9 pl-3 text-[9px] text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/40"/></label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="min-w-0"><span className="sr-only">فیلتر پست</span><select value={position} onChange={event => setPosition(event.target.value as PositionFilter)} className="h-9 w-full min-w-0 rounded-xl border border-white/[.07] bg-ink-950 px-2 text-[8px] font-bold text-slate-300 outline-none"><option value="all">همه پست‌ها</option>{positionOptions.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="min-w-0"><span className="sr-only">فیلتر وضعیت انتقال</span><select value={transfer} onChange={event => setTransfer(event.target.value as TransferFilter)} className="h-9 w-full min-w-0 rounded-xl border border-white/[.07] bg-ink-950 px-2 text-[8px] font-bold text-slate-300 outline-none"><option value="all">همه وضعیت‌ها</option>{transferOptions.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
      </section>

      <div className="flex items-center justify-between px-0.5"><h2 className="text-[10px] font-black">بازیکنان باشگاه</h2><span className="text-[8px] text-slate-500">{faNumber(filteredPlayers.length)} نتیجه</span></div>
      {filteredPlayers.length ? <section aria-label="فهرست بازیکنان" className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3">{filteredPlayers.map((player, index) => <PlayerCard key={player._id} player={player} index={index} onClick={() => openPlayer(player)}/>)}</section> : <section className="rounded-[1.5rem] border border-dashed border-white/[.09] bg-white/[.025] px-4 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[.04] text-slate-500"><UserRound size={20}/></span><h2 className="mt-3 text-xs font-black">بازیکنی پیدا نشد</h2><p className="mt-1 text-[9px] text-slate-500">عبارت جست‌وجو یا فیلترها را تغییر بده.</p></section>}
    </main>
    {selectedPlayer && <PlayerDetailsModal player={selectedPlayer} onClose={closePlayer}/>} 
  </div>;
}

function PlayerCard({ player, index, onClick }: { player: DisplayPlayer; index: number; onClick: () => void }) {
  const activeOffers = player.transferOffers?.filter(offer => offer.status === 'active').length ?? 0;
  const listed = player.transferListing?.isListed === true;
  return <button type="button" onClick={onClick} aria-label={`مشاهده جزئیات ${player.name}`} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }} className="player-collection-card min-w-0 overflow-hidden rounded-[1.35rem] border border-white/[.075] bg-[linear-gradient(155deg,rgba(16,32,53,.98),rgba(8,20,35,.98))] text-right shadow-[0_10px_24px_rgba(0,0,0,.16)] transition active:scale-[.985]">
    <div className="relative aspect-[1.25/1] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(52,211,153,.13),transparent_52%)]">
      <PlayerPhoto player={player} className="h-full w-full"/>
      <span className="absolute right-2 top-2 rounded-lg border border-white/[.1] bg-ink-950/80 px-1.5 py-1 text-[7px] font-black text-emerald-200 backdrop-blur">{positionLabel(player.position)}</span>
      <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-lg border border-white/[.1] bg-ink-950/80 px-1 text-[8px] font-black text-white backdrop-blur">{faNumber(player.overall)}</span>
    </div>
    <div className="min-w-0 p-2.5">
      <h3 className="truncate text-[11px] font-black text-white">{shortName(player.name)}</h3>
      <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[7px] text-slate-500"><Flag size={9} className="shrink-0"/>{player.nationality || player.club || 'ثبت نشده'}</p>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-1.5 border-t border-white/[.055] pt-2"><span className="min-w-0"><span className="block text-[6px] text-slate-600">ارزش فعلی</span><strong className="mt-0.5 block truncate text-[8px] text-emerald-300">{formatCoins(player.marketValue)}</strong></span><TransferBadge offers={activeOffers} listed={listed} status={player.transferListing?.status}/></div>
    </div>
  </button>;
}

function PlayerDetailsModal({ player, onClose }: { player: DisplayPlayer; onClose: () => void }) {
  const activeOffers = (player.transferOffers ?? []).filter(offer => offer.status === 'active');
  const highestOffer = activeOffers.reduce<PlayerTransferOffer|null>((highest, offer) => !highest || offer.amount > highest.amount ? offer : highest, null);
  const latestOffer = activeOffers.reduce<PlayerTransferOffer|null>((latest, offer) => !latest || new Date(offer.createdAt) > new Date(latest.createdAt) ? offer : latest, null);
  const listing = player.transferListing;
  return <PlayerModalFrame label={`جزئیات ${player.name}`} onClose={onClose}>
    <div className="player-modal-content momentum-scroll mx-auto w-full max-w-xl overflow-y-auto overscroll-contain px-3 pb-[max(14px,var(--safe-bottom))]">
      <section className="player-modal-hero relative overflow-hidden rounded-[1.35rem] border border-white/[.07] bg-white/[.035] p-3">
        <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-emerald-400/[.09] blur-3xl"/>
        <div className="relative flex items-center gap-3"><PlayerPhoto player={player} className="player-modal-avatar h-16 w-16 shrink-0 rounded-2xl border-2 border-emerald-200/30"/><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="rounded-full border border-emerald-300/15 bg-emerald-400/[.08] px-2 py-0.5 text-[7px] font-bold text-emerald-200">{positionLabel(player.position)} · {player.position}</span>{activeOffers.length > 0 && <span className="rounded-full bg-violet-400 px-2 py-0.5 text-[7px] font-black text-white shadow-[0_5px_16px_rgba(167,139,250,.22)]">{faNumber(activeOffers.length)} پیشنهاد فعال</span>}</div><h2 className="mt-1.5 truncate text-base font-black">{player.name}</h2><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[8px] text-slate-400"><Building2 size={10} className="shrink-0"/>{player.club || 'باشگاه ثبت نشده'}<span className="text-white/15">•</span><Flag size={10} className="shrink-0"/>{player.nationality || 'ملیت ثبت نشده'}</p></div></div>
      </section>

      <section className="player-modal-info mt-2 grid grid-cols-2 gap-1.5" aria-label="اطلاعات بازیکن">
        <InfoCard icon={<Shirt size={14}/>} label="پست اصلی" value={`${positionLabel(player.position)} · ${player.position}`}/>
        <InfoCard icon={<BadgeDollarSign size={14}/>} label="ارزش فعلی" value={formatCoins(player.marketValue)}/>
        <InfoCard icon={<CalendarClock size={14}/>} label="وضعیت قرارداد" value={player.contractStatus || 'ثبت نشده'}/>
        <InfoCard icon={<Tags size={14}/>} label="وضعیت انتقال" value={listing?.isListed ? listingStatus(listing.status) : 'در بازار نیست'}/>
      </section>

      <section className={cn('mt-2 rounded-[1.25rem] border p-3', activeOffers.length ? 'border-violet-300/20 bg-violet-400/[.075]' : 'border-white/[.07] bg-white/[.025]')}>
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><i className={cn('grid h-8 w-8 place-items-center rounded-xl', activeOffers.length ? 'bg-violet-400/15 text-violet-300' : 'bg-white/[.05] text-slate-500')}><Handshake size={15}/></i><span><span className="block text-[7px] text-slate-500">پیشنهادهای انتقال</span><strong className="mt-0.5 block text-[10px]">{activeOffers.length ? `${faNumber(activeOffers.length)} پیشنهاد فعال` : 'بدون پیشنهاد'}</strong></span></span>{activeOffers.length > 0 && <span className="rounded-full bg-violet-400 px-2.5 py-1 text-[8px] font-black text-white">{faNumber(activeOffers.length)} پیشنهاد فعال</span>}</div>
        {activeOffers.length && highestOffer && latestOffer ? <div className="mt-3 grid grid-cols-3 gap-1.5"><OfferMetric icon={<CircleDollarSign size={12}/>} label="بالاترین پیشنهاد" value={formatCoins(highestOffer.amount)}/><OfferMetric icon={<Clock3 size={12}/>} label="آخرین پیشنهاد" value={formatDateTime(latestOffer.createdAt)}/><OfferMetric icon={<CalendarClock size={12}/>} label="انقضای پیشنهاد" value={highestOffer.expiresAt ? formatDateTime(highestOffer.expiresAt) : 'بدون محدودیت'}/></div> : <p className="mt-3 rounded-xl border border-dashed border-white/[.075] bg-black/[.08] px-3 py-3 text-center text-[8px] leading-5 text-slate-400">هنوز پیشنهادی برای این بازیکن ثبت نشده</p>}
        <Link to={`/club/trade-offers?player=${player._id}`} className={cn('mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-[9px] font-black transition active:scale-[.985]', activeOffers.length ? 'bg-violet-400 text-white' : 'border border-white/[.08] bg-white/[.045] text-slate-300')}><Handshake size={14}/>مشاهده پیشنهادها<ArrowLeft size={13}/></Link>
      </section>

      <section className={cn('mt-2 rounded-[1.25rem] border p-3', listing?.isListed ? 'border-emerald-300/[.16] bg-emerald-400/[.055]' : 'border-white/[.07] bg-white/[.025]')}>
        <div className="flex items-center gap-2"><span className={cn('grid h-8 w-8 place-items-center rounded-xl', listing?.isListed ? 'bg-emerald-400/[.12] text-emerald-300' : 'bg-white/[.05] text-slate-500')}><Tags size={15}/></span><div className="min-w-0 flex-1"><span className="block text-[7px] text-slate-500">آگهی فروش</span><strong className={cn('mt-0.5 block text-[10px]', listing?.isListed ? 'text-emerald-200' : 'text-slate-300')}>{listing?.isListed ? listingStatus(listing.status) : 'در بازار نیست'}</strong></div>{listing?.isListed && <span className="text-left"><span className="block text-[6px] text-slate-500">قیمت درخواستی</span><strong className="mt-0.5 block text-[9px] text-emerald-300">{formatCoins(listing.askingPrice)}</strong></span>}</div>
        {listing?.isListed && listing.expiresAt && <p className="mt-2 flex items-center gap-1.5 border-t border-white/[.06] pt-2 text-[7px] text-slate-500"><CalendarClock size={11}/>انقضای آگهی: {formatDateTime(listing.expiresAt)}</p>}
      </section>
    </div>
  </PlayerModalFrame>;
}

function PlayerPhoto({ player, className }: { player: DisplayPlayer; className?: string }) {
  if (player.demoIndex !== undefined) {
    const column = player.demoIndex % 4;
    const row = Math.floor(player.demoIndex / 4);
    return <span role="img" aria-label={`تصویر ${player.name}`} className={cn('block bg-cover bg-no-repeat', className)} style={{ backgroundImage: "url('/assets/demo-player-sprite.png')", backgroundSize: '400% 300%', backgroundPosition: `${column * 33.333}% ${row * 50}%` }}/>;
  }
  return player.photoUrl ? <img src={player.photoUrl} alt={`تصویر ${player.name}`} loading="lazy" className={cn('block object-cover', className)}/> : <span role="img" aria-label={`تصویر جایگزین ${player.name}`} className={cn('grid place-items-center bg-ink-850 text-xl font-black text-emerald-300', className)}>{player.name.slice(0, 1)}</span>;
}

function TransferBadge({ offers, listed, status }: { offers: number; listed: boolean; status?: NonNullable<ClubPlayer['transferListing']>['status'] }) {
  if (offers > 0) return <span className="shrink-0 rounded-lg bg-violet-400/[.13] px-1.5 py-1 text-[6px] font-black text-violet-300">{faNumber(offers)} پیشنهاد</span>;
  if (listed) return <span className={cn('shrink-0 rounded-lg px-1.5 py-1 text-[6px] font-black', status === 'active' || !status ? 'bg-emerald-400/[.1] text-emerald-300' : 'bg-amber-300/[.09] text-amber-200')}>{status === 'active' || !status ? 'در بازار' : listingStatus(status)}</span>;
  return <span className="shrink-0 rounded-lg bg-white/[.045] px-1.5 py-1 text-[6px] font-bold text-slate-500">در بازار نیست</span>;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="player-modal-info-card flex min-h-[50px] items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.035] p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-400/[.08] text-emerald-300">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[6px] text-slate-500">{label}</span><strong className="mt-0.5 block truncate text-[7px] text-slate-100">{value}</strong></span></div>;
}

function OfferMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/[.06] bg-black/[.1] p-2 text-center"><span className="mx-auto grid h-6 w-6 place-items-center rounded-lg bg-violet-400/[.11] text-violet-300">{icon}</span><span className="mt-1.5 block text-[5.5px] text-slate-500">{label}</span><strong className="mt-0.5 block break-words text-[6.5px] leading-3 text-slate-200">{value}</strong></div>;
}

function positionGroup(position: ClubPlayer['position']): Exclude<PositionFilter, 'all'> {
  if (position === 'GK') return 'GK';
  if (['RB', 'CB', 'LB'].includes(position)) return 'DEF';
  if (['DM', 'CM', 'AM'].includes(position)) return 'MID';
  return 'FWD';
}

function positionLabel(position: ClubPlayer['position']) {
  const labels: Record<ClubPlayer['position'], string> = { GK: 'دروازه‌بان', RB: 'مدافع راست', CB: 'مدافع میانی', LB: 'مدافع چپ', DM: 'هافبک دفاعی', CM: 'هافبک میانی', AM: 'هافبک هجومی', RW: 'وینگر راست', LW: 'وینگر چپ', ST: 'مهاجم' };
  return labels[position];
}

function listingStatus(status?: NonNullable<ClubPlayer['transferListing']>['status']) {
  return ({ active: 'فعال در بازار', negotiable: 'قابل مذاکره', paused: 'آگهی متوقف', sold: 'فروخته شده', expired: 'آگهی منقضی' } as const)[status ?? 'active'];
}

function shortName(name: string) { const parts = name.trim().split(/\s+/); return parts.at(-1) || name; }
function formatCoins(value?: number) { return value === undefined ? 'ثبت نشده' : `${faNumber(value)} سکه`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
