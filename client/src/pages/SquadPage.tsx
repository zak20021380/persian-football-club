import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Plus, RotateCcw, Shirt, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/PageHeader';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { formations } from '@/lib/formations';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';
import type { ClubPlayer, SquadData, SquadFormation } from '@/types/api';

const formationOptions: SquadFormation[] = ['4-3-3','4-4-2','4-2-3-1'];

export function SquadPage() {
  const queryClient = useQueryClient();
  const [optimisticFormation, setOptimisticFormation] = useState<SquadFormation|null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number|null>(null);
  const squad = useQuery({ queryKey: ['clubSquad'], queryFn: async () => (await api.get<SquadData>('/club/squad')).data });
  const formationMutation = useMutation({
    mutationFn: async (formation: SquadFormation) => (await api.patch<SquadData>('/club/squad/formation', { formation })).data,
    onSuccess: data => { queryClient.setQueryData(['clubSquad'], data); setOptimisticFormation(null); },
    onError: error => { setOptimisticFormation(null); toast.error((error as Error).message); },
  });
  const slotMutation = useMutation({
    mutationFn: async ({ slotIndex, playerId }: { slotIndex: number; playerId: string|null }) => (await api.patch<SquadData>('/club/squad/slot', { slotIndex, playerId })).data,
    onSuccess: data => { queryClient.setQueryData(['clubSquad'], data); setSelectedSlot(null); toast.success('ترکیب به‌روزرسانی شد'); },
    onError: error => toast.error((error as Error).message),
  });

  if (squad.isLoading) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back/><PageSkeleton/></>;
  if (squad.error || !squad.data) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back/><main className="p-4"><ErrorState message={(squad.error as Error)?.message || 'ترکیب دریافت نشد'} onRetry={() => squad.refetch()}/></main></>;

  const formation = optimisticFormation ?? squad.data.formation;
  const slots = formations[formation];
  const selectedPlayer = selectedSlot === null ? null : squad.data.starters[selectedSlot];
  return <div className="squad-page min-h-screen overflow-x-hidden bg-ink-950 pb-8">
    <PageHeader title="ترکیب من" subtitle={`${faNumber(squad.data.starters.filter(Boolean).length)} بازیکن در ترکیب`} back/>
    <main className="mx-auto max-w-xl px-3 pt-4 sm:px-4">
      <section aria-label="انتخاب آرایش" className="mb-4">
        <div className="mb-2 flex items-center justify-between"><div><p className="text-[9px] font-bold text-pitch-300">آرایش تیم</p><h1 className="mt-0.5 text-sm font-black">چیدمان زمین</h1></div><Shirt size={19} className="text-slate-500"/></div>
        <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] bg-white/[.025] p-1.5">{formationOptions.map(option => { const active = formation === option; return <button type="button" key={option} aria-pressed={active} disabled={formationMutation.isPending} onClick={() => { setOptimisticFormation(option); formationMutation.mutate(option); }} className={cn('min-h-11 rounded-2xl text-xs font-black transition active:scale-95', active ? 'bg-pitch-400 text-ink-950 shadow-[0_8px_24px_rgba(16,185,129,.16)]' : 'text-slate-500')}>{option}</button>; })}</div>
      </section>

      <section className="relative mx-auto aspect-[0.64] w-full max-w-[410px] overflow-hidden rounded-[1.75rem] border border-emerald-200/[.13] bg-[#0b603f] shadow-[0_24px_60px_rgba(0,0,0,.32)]" dir="ltr">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.055),transparent_36%),linear-gradient(90deg,rgba(255,255,255,.025)_50%,transparent_50%)] bg-[length:auto,48px_100%]"/>
        <div className="absolute inset-3 rounded-[1.25rem] border border-white/25"/>
        <div className="absolute inset-x-3 top-1/2 border-t border-white/25"/>
        <div className="absolute left-1/2 top-1/2 h-[21%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"/>
        <div className="absolute left-1/2 top-3 h-[15%] w-[48%] -translate-x-1/2 border border-t-0 border-white/25"/>
        <div className="absolute bottom-3 left-1/2 h-[15%] w-[48%] -translate-x-1/2 border border-b-0 border-white/25"/>
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"/>

        {slots.map((slot, index) => <PitchSlot key={index} slot={slot} player={squad.data.starters[index] ?? null} index={index} selected={selectedSlot === index} onSelect={() => setSelectedSlot(index)}/>) }
      </section>

      <section className="mt-5">
        <div className="mb-2.5 flex items-center justify-between"><div className="flex items-center gap-2"><UsersRound size={16} className="text-pitch-300"/><h2 className="text-xs font-black">بازیکنان ذخیره</h2></div><span className="text-[8px] text-slate-500">{faNumber(squad.data.substitutes.length)} بازیکن</span></div>
        {squad.data.substitutes.length ? <div className="grid grid-cols-4 gap-2">{squad.data.substitutes.slice(0, 8).map(player => <BenchPlayer key={player._id} player={player}/>)}</div> : <Card className="flex min-h-20 items-center gap-3 border-dashed p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.04] text-slate-500"><UserRound size={18}/></span><div className="min-w-0 flex-1"><h3 className="text-[10px] font-black">نیمکت خالی است</h3><p className="mt-1 text-[8px] text-slate-500">از بازار بازیکن جدید به باشگاه اضافه کن.</p></div><Link to="/club/transfer-market" className="flex min-h-9 shrink-0 items-center rounded-xl bg-white/[.05] px-2.5 text-[8px] font-bold text-slate-300">بازار</Link></Card>}
      </section>
    </main>

    {selectedSlot !== null && <PlayerSheet
      slotRole={slots[selectedSlot].role}
      player={selectedPlayer}
      substitutes={squad.data.substitutes}
      loading={slotMutation.isPending}
      onClose={() => !slotMutation.isPending && setSelectedSlot(null)}
      onRemove={() => slotMutation.mutate({ slotIndex: selectedSlot, playerId: null })}
      onReplace={playerId => slotMutation.mutate({ slotIndex: selectedSlot, playerId })}
    />}
  </div>;
}

function PitchSlot({ slot, player, index, selected, onSelect }: { slot: { role: string; x: number; y: number }; player: ClubPlayer|null; index: number; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-label={player ? `${player.name}، ${player.position}، امتیاز ${player.overall}` : `افزودن بازیکن به پست ${slot.role}`} style={{ left: `${slot.x}%`, top: `${slot.y}%`, animationDelay: `${index * 25}ms` }} className={cn('squad-player absolute z-10 flex w-[60px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center transition-[left,top,transform] duration-500 min-[380px]:w-[68px]', selected && 'scale-105')}>
    {player ? <>
      <span className={cn('relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border-2 bg-ink-900 shadow-[0_8px_18px_rgba(0,0,0,.32)] min-[380px]:h-11 min-[380px]:w-11', selected ? 'border-amber-300' : 'border-white/35')}>
        {player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <span className="text-xs font-black text-emerald-200">{player.name.slice(0, 1)}</span>}
        <strong className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-lg bg-amber-300 px-1 text-[8px] font-black text-ink-950">{faNumber(player.overall)}</strong>
      </span>
      <span className="mt-1 w-full truncate rounded-lg bg-ink-950/80 px-1.5 py-0.5 text-[8px] font-black text-white backdrop-blur">{player.name}</span>
      <span className="mt-0.5 text-[7px] font-bold text-emerald-100/75">{player.position}</span>
    </> : <>
      <span className={cn('grid h-10 w-10 place-items-center rounded-2xl border border-dashed bg-ink-950/25 text-white/70 backdrop-blur-sm min-[380px]:h-11 min-[380px]:w-11', selected ? 'border-amber-300 text-amber-300' : 'border-white/40')}><Plus size={17}/></span>
      <span className="mt-1 whitespace-nowrap rounded-lg bg-ink-950/70 px-1.5 py-0.5 text-[7px] font-bold text-white/85">افزودن بازیکن</span>
      <span className="mt-0.5 text-[7px] font-black text-emerald-100/75">{slot.role}</span>
    </>}
  </button>;
}

function BenchPlayer({ player }: { player: ClubPlayer }) {
  return <div className="min-w-0 rounded-2xl bg-white/[.03] p-2 text-center"><span className="relative mx-auto grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-ink-850">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : <span className="text-[10px] font-black text-pitch-300">{player.name.slice(0, 1)}</span>}<strong className="absolute -right-0.5 -top-0.5 rounded-md bg-amber-300 px-1 text-[7px] font-black text-ink-950">{faNumber(player.overall)}</strong></span><strong className="mt-1.5 block truncate text-[8px]">{player.name}</strong><span className="mt-0.5 block text-[7px] text-slate-500">{player.position}</span></div>;
}

function PlayerSheet({ slotRole, player, substitutes, loading, onClose, onRemove, onReplace }: { slotRole: string; player: ClubPlayer|null; substitutes: ClubPlayer[]; loading: boolean; onClose: () => void; onRemove: () => void; onReplace: (playerId: string) => void }) {
  const [showReplacements, setShowReplacements] = useState(!player);
  return <div className="fixed inset-0 z-[90] flex items-end bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={player ? `جزئیات ${player.name}` : `افزودن بازیکن به ${slotRole}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="safe-bottom squad-sheet max-h-[78vh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-ink-900 p-4">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15"/>
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-400/[.1] text-emerald-300">{player?.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover"/> : player ? <strong>{player.name.slice(0, 1)}</strong> : <Plus size={22}/>}</span>
          <div className="min-w-0 flex-1"><p className="text-[8px] font-bold text-emerald-300">پست {slotRole}</p><h2 className="mt-1 truncate text-base font-black">{player?.name || 'افزودن بازیکن'}</h2>{player && <p className="mt-1 text-[9px] text-slate-500">{player.position} · امتیاز کلی {faNumber(player.overall)}{player.nationality ? ` · ${player.nationality}` : ''}</p>}</div>
          <button type="button" disabled={loading} onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.05] text-slate-400"><X size={18}/></button>
        </div>

        {player && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={!substitutes.length || loading} onClick={() => setShowReplacements(true)} className="btn-secondary min-h-10 py-2 text-[9px]"><ArrowLeftRight size={15}/>تعویض بازیکن</button><button type="button" disabled={loading} onClick={onRemove} className="btn-secondary min-h-10 border-rose-300/10 py-2 text-[9px] text-rose-300">{loading ? <RotateCcw size={15} className="animate-spin"/> : <Trash2 size={15}/>}حذف از ترکیب</button></div>}

        {showReplacements && <div className="mt-5"><div className="mb-2.5 flex items-center justify-between"><h3 className="text-xs font-black">بازیکنان قابل انتخاب</h3><span className="text-[8px] text-slate-500">{faNumber(substitutes.length)} ذخیره</span></div>
          {substitutes.length ? <div className="grid grid-cols-2 gap-2">{substitutes.map(substitute => <button type="button" key={substitute._id} disabled={loading} onClick={() => onReplace(substitute._id)} className="flex min-h-14 min-w-0 items-center gap-2 rounded-2xl bg-white/[.035] p-2 text-right transition active:scale-[.98] active:bg-emerald-400/[.08]"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-850">{substitute.photoUrl ? <img src={substitute.photoUrl} alt="" className="h-full w-full object-cover"/> : <span className="text-[10px] font-black text-pitch-300">{substitute.name.slice(0, 1)}</span>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[9px]">{substitute.name}</strong><span className="mt-1 block text-[7px] text-slate-500">{substitute.position} · {faNumber(substitute.overall)}</span></span></button>)}</div> : <div className="rounded-2xl bg-white/[.025] p-4 text-center"><p className="text-[9px] text-slate-500">بازیکن ذخیره‌ای برای این جایگاه وجود ندارد.</p><Link to="/club/transfer-market" className="btn-secondary mt-3 min-h-9 px-4 py-2 text-[8px]">رفتن به بازار بازیکنان</Link></div>}
        </div>}
      </div>
    </div>
  </div>;
}
