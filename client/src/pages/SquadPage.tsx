import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, CircleAlert, Edit3, Plus, RotateCcw, Save, Shirt, Sparkles, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/PageHeader';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { formations } from '@/lib/formations';
import { api } from '@/lib/api';
import { cn, faNumber } from '@/lib/utils';
import type { BuiltInSquadFormation, ClubPlayer, SavedSquadFormation, SquadData, SquadFormation, SquadPosition } from '@/types/api';

type DisplayPlayer = ClubPlayer & { demoIndex?: number };
interface LineupDraft {
  formation: SquadFormation;
  starters: Array<DisplayPlayer|null>;
  substitutes: DisplayPlayer[];
  positions: SquadPosition[];
}
interface DragState {
  index: number;
  pointerId: number;
  x: number;
  y: number;
  targetIndex: number|null;
  valid: boolean;
  moved: boolean;
}

const formationOptions: Array<{ value: SquadFormation; label: string }> = [
  { value: '4-3-3', label: '4-3-3' }, { value: '4-4-2', label: '4-4-2' },
  { value: '4-2-3-1', label: '4-2-3-1' }, { value: '3-5-2', label: '3-5-2' },
  { value: '3-4-3', label: '3-4-3' }, { value: '5-3-2', label: '5-3-2' },
  { value: '4-1-4-1', label: '4-1-4-1' }, { value: 'custom', label: 'آرایش دلخواه' },
];

const demoPlayers: DisplayPlayer[] = [
  { _id: 'demo-1', name: 'پیام نیازمند', position: 'GK', overall: 84, nationality: 'ایران', demoIndex: 0 },
  { _id: 'demo-2', name: 'میلاد محمدی', position: 'LB', overall: 79, nationality: 'ایران', demoIndex: 1 },
  { _id: 'demo-3', name: 'شجاع خلیل‌زاده', position: 'CB', overall: 82, nationality: 'ایران', demoIndex: 2 },
  { _id: 'demo-4', name: 'حسین کنعانی', position: 'CB', overall: 81, nationality: 'ایران', demoIndex: 3 },
  { _id: 'demo-5', name: 'رامین رضاییان', position: 'RB', overall: 83, nationality: 'ایران', demoIndex: 4 },
  { _id: 'demo-6', name: 'سعید عزت‌اللهی', position: 'CM', overall: 82, nationality: 'ایران', demoIndex: 5 },
  { _id: 'demo-7', name: 'سامان قدوس', position: 'AM', overall: 84, nationality: 'ایران', demoIndex: 6 },
  { _id: 'demo-8', name: 'مهدی ترابی', position: 'CM', overall: 83, nationality: 'ایران', demoIndex: 7 },
  { _id: 'demo-9', name: 'مهدی قایدی', position: 'LW', overall: 85, nationality: 'ایران', demoIndex: 8 },
  { _id: 'demo-10', name: 'مهدی طارمی', position: 'ST', overall: 88, nationality: 'ایران', demoIndex: 9 },
  { _id: 'demo-11', name: 'علیرضا جهانبخش', position: 'RW', overall: 84, nationality: 'ایران', demoIndex: 10 },
];

const DRAFT_KEY = 'persian-football-club:squad-draft:v2';

export function SquadPage() {
  const queryClient = useQueryClient();
  const pitchRef = useRef<HTMLElement|null>(null);
  const dragRef = useRef<DragState|null>(null);
  const suppressClickRef = useRef(false);
  const [draft, setDraft] = useState<LineupDraft|null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number|null>(null);
  const [drag, setDrag] = useState<DragState|null>(null);
  const [nameDialog, setNameDialog] = useState<{ mode: 'create'|'rename'; id?: string; value: string }|null>(null);
  const squad = useQuery({ queryKey: ['clubSquad'], queryFn: async () => (await api.get<SquadData>('/club/squad')).data });
  const demoMode = Boolean(squad.data && squad.data.starters.every(player => !player) && squad.data.substitutes.length === 0);

  useEffect(() => {
    if (!squad.data || draft) return;
    let nextDraft: LineupDraft;
    let restoredDraft = false;
    if (demoMode) {
      nextDraft = { formation: '4-3-3', starters: demoPlayers, substitutes: [], positions: clonePositions(formations['4-3-3']) };
    } else {
      const restored = restoreDraft(squad.data);
      nextDraft = restored ?? draftFromData(squad.data);
      restoredDraft = Boolean(restored);
    }
    const timer = window.setTimeout(() => {
      setDraft(nextDraft);
      if (restoredDraft) setDirty(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoMode, draft, squad.data]);

  useEffect(() => {
    if (!dirty || demoMode || !draft || !squad.data) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      baseUpdatedAt: squad.data.updatedAt,
      formation: draft.formation,
      starterIds: draft.starters.map(player => player?._id ?? null),
      positions: draft.positions,
    }));
  }, [demoMode, dirty, draft, squad.data]);

  const saveMutation = useMutation({
    mutationFn: async (current: LineupDraft) => (await api.put<SquadData>('/club/squad', {
      formation: current.formation,
      starterIds: current.starters.map(player => player?._id ?? null),
      positions: current.positions,
    })).data,
    onSuccess: data => {
      queryClient.setQueryData(['clubSquad'], data);
      setDraft(draftFromData(data));
      setDirty(false);
      localStorage.removeItem(DRAFT_KEY);
      toast.success('ترکیب با موفقیت ذخیره شد');
    },
    onError: error => toast.error((error as Error).message),
  });

  const customMutation = useMutation({
    mutationFn: async (action: { type: 'create'; name: string; current: LineupDraft }|{ type: 'rename'; id: string; name: string }|{ type: 'delete'; id: string }) => {
      if (action.type === 'create') return (await api.post<SquadData>('/club/squad/custom-formations', {
        name: action.name,
        positions: action.current.positions,
        starterIds: action.current.starters.map(player => player?._id ?? null),
      })).data;
      if (action.type === 'rename') return (await api.patch<SquadData>(`/club/squad/custom-formations/${action.id}`, { name: action.name })).data;
      return (await api.delete<SquadData>(`/club/squad/custom-formations/${action.id}`)).data;
    },
    onSuccess: data => {
      queryClient.setQueryData(['clubSquad'], data);
      setNameDialog(null);
      toast.success('آرایش‌های دلخواه به‌روزرسانی شدند');
    },
    onError: error => toast.error((error as Error).message),
  });

  const selectedPlayer = draft && selectedSlot !== null ? draft.starters[selectedSlot] : null;
  const validationMessage = useMemo(() => draft ? validateDraft(draft) : null, [draft]);

  if (squad.isLoading || !draft) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back/><PageSkeleton/></>;
  if (squad.error || !squad.data) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back/><main className="p-4"><ErrorState message={(squad.error as Error)?.message || 'ترکیب دریافت نشد'} onRetry={() => squad.refetch()}/></main></>;

  const updateDraft = (updater: (current: LineupDraft) => LineupDraft) => {
    setDraft(current => current ? updater(current) : current);
    setDirty(true);
  };

  const chooseFormation = (formation: SquadFormation) => updateDraft(current => ({
    ...current,
    formation,
    positions: formation === 'custom'
      ? clonePositions(current.positions)
      : clonePositions(formations[formation as BuiltInSquadFormation]),
  }));

  const loadSavedFormation = (saved: SavedSquadFormation) => updateDraft(current => {
    const selectedIds = new Set(saved.starters.filter(Boolean).map(player => player!._id));
    const pool = uniquePlayers([...current.starters.filter(Boolean), ...current.substitutes] as DisplayPlayer[]);
    return {
      formation: 'custom',
      starters: [...saved.starters],
      substitutes: pool.filter(player => !selectedIds.has(player._id)),
      positions: clonePositions(saved.positions),
    };
  });

  const replaceSlot = (index: number, next: DisplayPlayer|null) => updateDraft(current => {
    const starters = [...current.starters];
    const previous = starters[index];
    starters[index] = next;
    const substitutes = current.substitutes.filter(player => player._id !== next?._id && player._id !== previous?._id);
    if (previous && previous._id !== next?._id) substitutes.push(previous);
    return { ...current, starters, substitutes };
  });

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (!draft.starters[index] || saveMutation.isPending) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = draft.positions[index];
    const next: DragState = { index, pointerId: event.pointerId, x: position.x, y: position.y, targetIndex: index, valid: true, moved: false };
    dragRef.current = next;
    setDrag(next);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    const pitch = pitchRef.current;
    if (!current || !pitch || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    const rect = pitch.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    const inside = rawX >= 4 && rawX <= 96 && rawY >= 3 && rawY <= 97;
    const x = clamp(rawX, 7, 93);
    const y = clamp(rawY, 6, 94);
    const moved = current.moved || Math.hypot(x - draft.positions[current.index].x, y - draft.positions[current.index].y) > 1.2;
    let targetIndex: number|null = null;
    let valid = inside;

    if (draft.formation !== 'custom') {
      targetIndex = nearestPosition(draft.positions, x, y, rect, -1).index;
    } else {
      const nearest = nearestPosition(draft.positions, x, y, rect, current.index);
      if (nearest.distance <= Math.min(52, rect.width * .16)) targetIndex = nearest.index;
      else {
        const collision = draft.positions.some((position, index) => index !== current.index && pixelDistance(position, { x, y }, rect) < Math.min(58, rect.width * .18));
        if (collision) valid = false;
      }
    }
    const next = { ...current, x, y, targetIndex, valid, moved };
    dragRef.current = next;
    setDrag(next);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressClickRef.current = current.moved;
    dragRef.current = null;
    setDrag(null);
    if (cancelled || !current.moved) return;
    if (!current.valid) {
      toast.error('این نقطه برای قرارگیری بازیکن معتبر نیست.');
      return;
    }
    if (current.targetIndex !== null) {
      if (current.targetIndex === current.index) return;
      updateDraft(lineup => {
        const starters = [...lineup.starters];
        [starters[current.index], starters[current.targetIndex!]] = [starters[current.targetIndex!], starters[current.index]];
        return { ...lineup, starters };
      });
      return;
    }
    if (draft.formation === 'custom') updateDraft(lineup => {
      const positions = clonePositions(lineup.positions);
      positions[current.index] = { ...positions[current.index], x: roundCoordinate(current.x), y: roundCoordinate(current.y) };
      return { ...lineup, positions };
    });
  };

  const save = () => {
    if (demoMode) {
      toast('این ترکیب نمایشی است؛ با اضافه‌شدن بازیکنان واقعی باشگاه امکان ذخیره فعال می‌شود.', { icon: '⚽' });
      return;
    }
    if (validationMessage) {
      toast.error(validationMessage, { duration: 4500 });
      return;
    }
    saveMutation.mutate(draft);
  };

  const submitNameDialog = () => {
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (name.length < 2) {
      toast.error('نام آرایش باید حداقل دو حرف باشد.');
      return;
    }
    if (nameDialog.mode === 'rename' && nameDialog.id) customMutation.mutate({ type: 'rename', id: nameDialog.id, name });
    else {
      if (demoMode) return toast.error('آرایش نمایشی قابل ذخیره نیست.');
      if (validationMessage) return toast.error(validationMessage);
      customMutation.mutate({ type: 'create', name, current: draft });
    }
  };

  return <div className="squad-page min-h-screen overflow-x-hidden bg-ink-950 pb-8">
    <PageHeader title="ترکیب من" subtitle={`${faNumber(draft.starters.filter(Boolean).length)} بازیکن در ترکیب`} back/>
    <main className="mx-auto max-w-xl px-3 pt-3 sm:px-4">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[.06] bg-white/[.025] p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dirty ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.5)]' : 'bg-emerald-400')}/>
          <div className="min-w-0"><strong className="block text-[9px]">{demoMode ? 'حالت نمایشی' : dirty ? 'تغییرات ذخیره‌نشده' : 'همه تغییرات ذخیره شده'}</strong><span className="block truncate text-[7px] text-slate-500">{drag ? drag.valid ? 'رها کن تا جابه‌جا شود' : 'محل رهاکردن نامعتبر است' : 'بازیکن را بگیر و روی جایگاه مقصد رها کن'}</span></div>
        </div>
        <button type="button" onClick={save} disabled={saveMutation.isPending || (!dirty && !demoMode)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-pitch-400 px-3 text-[9px] font-black text-ink-950 transition active:scale-95 disabled:opacity-45">
          {saveMutation.isPending ? <RotateCcw size={14} className="animate-spin"/> : <Save size={14}/>}ذخیره ترکیب
        </button>
      </div>

      {demoMode && <div className="mb-3 flex items-start gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/[.07] p-2.5 text-[8px] leading-5 text-sky-100/80"><Sparkles size={15} className="mt-0.5 shrink-0 text-sky-300"/><span>برای پیش‌نمایش تجربه کامل، یک ترکیب نمونه نمایش داده شده است. داده‌های واقعی باشگاه همیشه اولویت دارند.</span></div>}

      <section aria-label="انتخاب آرایش" className="mb-3">
        <div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] font-bold text-pitch-300">آرایش تیم</p><h1 className="mt-0.5 text-xs font-black">چیدمان زمین</h1></div><Shirt size={18} className="text-slate-500"/></div>
        <div className="grid grid-cols-4 gap-1.5 rounded-[1.25rem] bg-white/[.025] p-1.5">{formationOptions.map(option => { const active = draft.formation === option.value; return <button type="button" key={option.value} aria-pressed={active} onClick={() => chooseFormation(option.value)} className={cn('min-h-9 min-w-0 rounded-xl px-1 text-[8px] font-black transition active:scale-95', active ? 'bg-pitch-400 text-ink-950 shadow-[0_7px_20px_rgba(16,185,129,.16)]' : 'text-slate-500 hover:bg-white/[.035]', option.value === 'custom' && 'leading-3')}>{option.label}</button>; })}</div>
      </section>

      <section ref={pitchRef} className={cn('lineup-pitch relative mx-auto aspect-[0.648] w-full max-w-[430px] select-none overflow-hidden rounded-[1.75rem] border bg-[#09603f] shadow-[0_24px_60px_rgba(0,0,0,.34)] transition-colors', drag ? drag.valid ? 'border-emerald-200/50' : 'border-rose-300/70' : 'border-emerald-200/[.16]')} dir="ltr" aria-label="زمین چیدمان بازیکنان">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.07),transparent_38%),repeating-linear-gradient(90deg,rgba(255,255,255,.028)_0,rgba(255,255,255,.028)_12.5%,transparent_12.5%,transparent_25%)]"/>
        <div className="absolute inset-3 rounded-[1.25rem] border border-white/25"/>
        <div className="absolute inset-x-3 top-1/2 border-t border-white/25"/>
        <div className="absolute left-1/2 top-1/2 h-[21%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"/>
        <div className="absolute left-1/2 top-3 h-[16%] w-[48%] -translate-x-1/2 border border-t-0 border-white/25"/>
        <div className="absolute bottom-3 left-1/2 h-[16%] w-[48%] -translate-x-1/2 border border-b-0 border-white/25"/>
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"/>
        {draft.positions.map((position, index) => <PitchSlot
          key={`${index}-${draft.starters[index]?._id ?? 'empty'}`}
          position={drag?.index === index ? { ...position, x: drag.x, y: drag.y } : position}
          player={draft.starters[index]}
          index={index}
          selected={selectedSlot === index}
          dragging={drag?.index === index}
          dropTarget={drag?.targetIndex === index && drag.index !== index}
          dropValid={drag?.valid ?? true}
          onPointerDown={event => beginDrag(event, index)}
          onPointerMove={moveDrag}
          onPointerUp={event => finishDrag(event)}
          onPointerCancel={event => finishDrag(event, true)}
          onClick={() => {
            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
            setSelectedSlot(index);
          }}
        />)}
        {drag && <div className={cn('pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border px-2.5 py-1 text-[7px] font-black shadow-lg backdrop-blur', drag.valid ? 'border-emerald-200/30 bg-emerald-950/80 text-emerald-100' : 'border-rose-200/30 bg-rose-950/85 text-rose-100')}>{drag.valid ? drag.targetIndex !== null && drag.targetIndex !== drag.index ? draft.starters[drag.targetIndex] ? 'تعویض جای دو بازیکن' : 'انتقال به جایگاه خالی' : draft.formation === 'custom' ? 'موقعیت جدید معتبر است' : 'نزدیک‌ترین جایگاه معتبر' : 'امکان قرارگیری در این نقطه نیست'}</div>}
      </section>

      {validationMessage && !demoMode && <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-2.5 text-[8px] leading-5 text-amber-100/80"><CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-300"/><span>{validationMessage}</span></div>}

      <section className="mt-4">
        <div className="mb-2.5 flex items-center justify-between"><div className="flex items-center gap-2"><UsersRound size={16} className="text-pitch-300"/><h2 className="text-xs font-black">بازیکنان ذخیره</h2></div><span className="text-[8px] text-slate-500">{faNumber(draft.substitutes.length)} بازیکن</span></div>
        {draft.substitutes.length ? <div className="grid grid-cols-4 gap-2">{draft.substitutes.slice(0, 8).map(player => <BenchPlayer key={player._id} player={player}/>)}</div> : <Card className="flex min-h-20 items-center gap-3 border-dashed p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.04] text-slate-500"><UserRound size={18}/></span><div className="min-w-0 flex-1"><h3 className="text-[10px] font-black">نیمکت خالی است</h3><p className="mt-1 text-[8px] text-slate-500">از بازار بازیکن جدید به باشگاه اضافه کن.</p></div><Link to="/club/transfer-market" className="flex min-h-9 shrink-0 items-center rounded-xl bg-white/[.05] px-2.5 text-[8px] font-bold text-slate-300">بازار</Link></Card>}
      </section>

      <section className="mt-4 rounded-3xl border border-white/[.07] bg-white/[.025] p-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xs font-black">آرایش‌های ذخیره‌شده</h2><p className="mt-1 text-[7px] text-slate-500">چیدمان و بازیکنان دلخواهت را نگه دار</p></div><button type="button" disabled={draft.formation !== 'custom'} onClick={() => setNameDialog({ mode: 'create', value: '' })} className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-white/[.06] px-2.5 text-[8px] font-bold text-pitch-300 disabled:opacity-35"><Plus size={13}/>ذخیره آرایش</button></div>
        {squad.data.savedFormations.length ? <div className="mt-3 space-y-2">{squad.data.savedFormations.map(saved => <div key={saved._id} className="flex items-center gap-2 rounded-2xl border border-white/[.06] bg-ink-950/45 p-2"><button type="button" onClick={() => loadSavedFormation(saved)} className="min-w-0 flex-1 text-right"><strong className="block truncate text-[9px]">{saved.name}</strong><span className="mt-0.5 block text-[7px] text-slate-500">آرایش دلخواه · {faNumber(saved.starters.filter(Boolean).length)} بازیکن</span></button><button type="button" aria-label={`تغییر نام ${saved.name}`} onClick={() => setNameDialog({ mode: 'rename', id: saved._id, value: saved.name })} className="grid h-8 w-8 place-items-center rounded-xl bg-white/[.04] text-slate-400"><Edit3 size={13}/></button><button type="button" aria-label={`حذف ${saved.name}`} onClick={() => { if (confirm(`آرایش «${saved.name}» حذف شود؟`)) customMutation.mutate({ type: 'delete', id: saved._id }); }} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-400/[.06] text-rose-300"><Trash2 size={13}/></button></div>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-white/[.07] p-3 text-center text-[8px] text-slate-500">هنوز آرایش دلخواهی ذخیره نکرده‌ای.</p>}
      </section>
    </main>

    {selectedSlot !== null && <PlayerSheet
      slotRole={draft.positions[selectedSlot].role}
      player={selectedPlayer}
      substitutes={draft.substitutes}
      loading={false}
      onClose={() => setSelectedSlot(null)}
      onRemove={() => { replaceSlot(selectedSlot, null); setSelectedSlot(null); }}
      onReplace={player => { replaceSlot(selectedSlot, player); setSelectedSlot(null); }}
    />}
    {nameDialog && <NameDialog state={nameDialog} loading={customMutation.isPending} onChange={value => setNameDialog(current => current ? { ...current, value } : current)} onClose={() => setNameDialog(null)} onSubmit={submitNameDialog}/>}
  </div>;
}

function PitchSlot({ position, player, index, selected, dragging, dropTarget, dropValid, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick }: {
  position: SquadPosition; player: DisplayPlayer|null; index: number; selected: boolean; dragging: boolean; dropTarget: boolean; dropValid: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void; onClick: () => void;
}) {
  return <button type="button" onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} aria-label={player ? `${player.name}، ${player.position}، امتیاز ${player.overall}` : `افزودن بازیکن به پست ${position.role}`} style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: dragging ? 40 : dropTarget ? 30 : 10, animationDelay: `${index * 22}ms` }} className={cn('lineup-player absolute flex w-[56px] -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center text-center transition-[left,top,transform,filter] duration-300 min-[390px]:w-[62px]', dragging && 'scale-110 cursor-grabbing drop-shadow-[0_16px_14px_rgba(0,0,0,.48)]', selected && !dragging && 'scale-105')}>
    {dropTarget && <span className={cn('pointer-events-none absolute -inset-2 -z-10 rounded-[1.35rem] border-2 border-dashed animate-pulse', dropValid ? 'border-emerald-200 bg-emerald-300/15' : 'border-rose-200 bg-rose-300/15')}/>}
    {player ? <>
      <span className={cn('relative rounded-[1.1rem] border bg-gradient-to-b from-slate-800/95 to-ink-950/95 px-1.5 pb-1.5 pt-1 shadow-[0_8px_18px_rgba(0,0,0,.32)] backdrop-blur transition', dragging ? 'border-emerald-200/70 shadow-[0_18px_32px_rgba(0,0,0,.42)]' : 'border-white/20')}>
        <PlayerAvatar player={player} className="mx-auto h-9 w-9 min-[390px]:h-10 min-[390px]:w-10"/>
        <span className="mt-1 flex items-center justify-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.8)]"/><strong className="max-w-[40px] truncate text-[7px] leading-none text-white min-[390px]:max-w-[46px]">{shortName(player.name)}</strong></span>
        <span className="mt-1 flex items-center justify-center gap-1 text-[6px] font-bold text-slate-400"><b className="text-emerald-200">{position.role}</b><span>·</span><span>{faNumber(player.overall)}</span></span>
      </span>
    </> : <span className={cn('flex min-h-[58px] w-[50px] flex-col items-center justify-center rounded-[1.1rem] border border-dashed bg-ink-950/35 text-white/75 shadow-[0_8px_18px_rgba(0,0,0,.16)] backdrop-blur-sm transition min-[390px]:w-[54px]', selected ? 'border-amber-300 text-amber-300' : 'border-white/35', dropTarget && 'border-emerald-100 bg-emerald-950/50')}><span className="grid h-7 w-7 place-items-center rounded-full bg-white/[.07]"><Plus size={14}/></span><strong className="mt-1 text-[6px]">افزودن بازیکن</strong><span className="mt-0.5 text-[6px] font-black text-emerald-100/75">{position.role}</span></span>}
  </button>;
}

function PlayerAvatar({ player, className }: { player: DisplayPlayer; className?: string }) {
  if (player.demoIndex !== undefined) {
    const column = player.demoIndex % 4;
    const row = Math.floor(player.demoIndex / 4);
    return <span role="img" aria-label={`تصویر ${player.name}`} className={cn('block shrink-0 rounded-full border border-white/20 bg-cover', className)} style={{ backgroundImage: "url('/assets/demo-player-sprite.png')", backgroundSize: '400% 300%', backgroundPosition: `${column * 33.333}% ${row * 50}%` }}/>;
  }
  return <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-ink-850', className)}>{player.photoUrl ? <img src={player.photoUrl} alt="" draggable={false} className="h-full w-full object-cover"/> : <span className="text-[10px] font-black text-pitch-300">{player.name.slice(0, 1)}</span>}</span>;
}

function BenchPlayer({ player }: { player: DisplayPlayer }) {
  return <div className="min-w-0 rounded-2xl border border-white/[.05] bg-white/[.03] p-2 text-center"><PlayerAvatar player={player} className="mx-auto h-9 w-9"/><strong className="mt-1.5 block truncate text-[8px]">{shortName(player.name)}</strong><span className="mt-0.5 block text-[7px] text-slate-500">{player.position}</span></div>;
}

function PlayerSheet({ slotRole, player, substitutes, loading, onClose, onRemove, onReplace }: { slotRole: string; player: DisplayPlayer|null; substitutes: DisplayPlayer[]; loading: boolean; onClose: () => void; onRemove: () => void; onReplace: (player: DisplayPlayer) => void }) {
  const [showReplacements, setShowReplacements] = useState(!player);
  return <div className="fixed inset-0 z-[90] flex items-end bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={player ? `جزئیات ${player.name}` : `افزودن بازیکن به ${slotRole}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="safe-bottom squad-sheet max-h-[78vh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-ink-900 p-4">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15"/>
        <div className="flex items-start gap-3">
          {player ? <PlayerAvatar player={player} className="h-12 w-12"/> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-400/[.1] text-emerald-300"><Plus size={22}/></span>}
          <div className="min-w-0 flex-1"><p className="text-[8px] font-bold text-emerald-300">پست {slotRole}</p><h2 className="mt-1 truncate text-base font-black">{player?.name || 'افزودن بازیکن'}</h2>{player && <p className="mt-1 text-[9px] text-slate-500">{player.position} · امتیاز کلی {faNumber(player.overall)}{player.nationality ? ` · ${player.nationality}` : ''}</p>}</div>
          <button type="button" disabled={loading} onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.05] text-slate-400"><X size={18}/></button>
        </div>
        {player && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={!substitutes.length || loading} onClick={() => setShowReplacements(true)} className="btn-secondary min-h-10 py-2 text-[9px]"><ArrowLeftRight size={15}/>تعویض بازیکن</button><button type="button" disabled={loading} onClick={onRemove} className="btn-secondary min-h-10 border-rose-300/10 py-2 text-[9px] text-rose-300"><Trash2 size={15}/>حذف از ترکیب</button></div>}
        {showReplacements && <div className="mt-5"><div className="mb-2.5 flex items-center justify-between"><h3 className="text-xs font-black">بازیکنان قابل انتخاب</h3><span className="text-[8px] text-slate-500">{faNumber(substitutes.length)} ذخیره</span></div>
          {substitutes.length ? <div className="grid grid-cols-2 gap-2">{substitutes.map(substitute => <button type="button" key={substitute._id} disabled={loading} onClick={() => onReplace(substitute)} className="flex min-h-14 min-w-0 items-center gap-2 rounded-2xl bg-white/[.035] p-2 text-right transition active:scale-[.98] active:bg-emerald-400/[.08]"><PlayerAvatar player={substitute} className="h-9 w-9"/><span className="min-w-0 flex-1"><strong className="block truncate text-[9px]">{substitute.name}</strong><span className="mt-1 block text-[7px] text-slate-500">{substitute.position} · {faNumber(substitute.overall)}</span></span></button>)}</div> : <div className="rounded-2xl bg-white/[.025] p-4 text-center"><p className="text-[9px] text-slate-500">بازیکن ذخیره‌ای برای این جایگاه وجود ندارد.</p><Link to="/club/transfer-market" className="btn-secondary mt-3 min-h-9 px-4 py-2 text-[8px]">رفتن به بازار بازیکنان</Link></div>}
        </div>}
      </div>
    </div>
  </div>;
}

function NameDialog({ state, loading, onChange, onClose, onSubmit }: { state: { mode: 'create'|'rename'; value: string }; loading: boolean; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={state.mode === 'create' ? 'ذخیره آرایش دلخواه' : 'تغییر نام آرایش'} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 p-4 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[8px] font-bold text-pitch-300">آرایش دلخواه</p><h2 className="mt-1 text-sm font-black">{state.mode === 'create' ? 'ذخیره آرایش جدید' : 'تغییر نام آرایش'}</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.05] text-slate-400"><X size={16}/></button></div><label className="label mt-4" htmlFor="formation-name">نام آرایش</label><input id="formation-name" autoFocus maxLength={30} value={state.value} onChange={event => onChange(event.target.value)} placeholder="مثلاً آرایش هجومی من" className="input"/><button type="submit" disabled={loading} className="btn-primary mt-3 w-full">{loading ? <RotateCcw size={16} className="animate-spin"/> : <Check size={16}/>}تأیید و ذخیره</button></form></div>;
}

function draftFromData(data: SquadData): LineupDraft {
  const positions = data.formation === 'custom' && data.customPositions.length === 11
    ? data.customPositions
    : formations[data.formation === 'custom' ? '4-3-3' : data.formation];
  return { formation: data.formation, starters: [...data.starters], substitutes: [...data.substitutes], positions: clonePositions(positions) };
}

function restoreDraft(data: SquadData): LineupDraft|null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { baseUpdatedAt?: string; formation?: SquadFormation; starterIds?: Array<string|null>; positions?: SquadPosition[] };
    if (stored.baseUpdatedAt !== data.updatedAt || !formationOptions.some(option => option.value === stored.formation) || stored.starterIds?.length !== 11 || stored.positions?.length !== 11) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    const pool = uniquePlayers([...data.starters.filter(Boolean), ...data.substitutes] as DisplayPlayer[]);
    const byId = new Map(pool.map(player => [player._id, player]));
    if (stored.starterIds.some(id => id && !byId.has(id))) return null;
    const starters = stored.starterIds.map(id => id ? byId.get(id) ?? null : null);
    const selected = new Set(stored.starterIds.filter(Boolean));
    return { formation: stored.formation!, starters, substitutes: pool.filter(player => !selected.has(player._id)), positions: clonePositions(stored.positions) };
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function validateDraft(draft: LineupDraft): string|null {
  const count = draft.starters.filter(Boolean).length;
  if (count !== 11) return `ترکیب ناقص است؛ ${faNumber(11 - count)} جایگاه هنوز بازیکن ندارد.`;
  if (new Set(draft.starters.map(player => player?._id)).size !== 11) return 'هر بازیکن فقط می‌تواند یک جایگاه داشته باشد.';
  const goalkeepers = draft.starters.filter(player => player?.position === 'GK').length;
  if (goalkeepers !== 1) return 'ترکیب باید دقیقاً یک دروازه‌بان و ۱۰ بازیکن غیر دروازه‌بان داشته باشد.';
  if (draft.positions.length !== 11) return 'آرایش باید دقیقاً ۱۱ جایگاه داشته باشد.';
  for (let first = 0; first < draft.positions.length; first += 1) for (let second = first + 1; second < draft.positions.length; second += 1) {
    const dx = draft.positions[first].x - draft.positions[second].x;
    const dy = (draft.positions[first].y - draft.positions[second].y) * 1.45;
    if (Math.hypot(dx, dy) < 11) return 'بازیکن‌ها بیش از حد به هم نزدیک‌اند؛ جایگاه‌ها را کمی دورتر کن.';
  }
  return null;
}

function nearestPosition(positions: SquadPosition[], x: number, y: number, rect: DOMRect, excludedIndex: number) {
  let result = { index: 0, distance: Number.POSITIVE_INFINITY };
  positions.forEach((position, index) => {
    if (index === excludedIndex) return;
    const distance = pixelDistance(position, { x, y }, rect);
    if (distance < result.distance) result = { index, distance };
  });
  return result;
}

function pixelDistance(first: Pick<SquadPosition, 'x'|'y'>, second: Pick<SquadPosition, 'x'|'y'>, rect: DOMRect) {
  return Math.hypot(((first.x - second.x) / 100) * rect.width, ((first.y - second.y) / 100) * rect.height);
}

function clonePositions(positions: SquadPosition[]): SquadPosition[] { return positions.map(position => ({ ...position })); }
function uniquePlayers(players: DisplayPlayer[]) { return players.filter((player, index) => players.findIndex(item => item._id === player._id) === index); }
function shortName(name: string) { const parts = name.trim().split(/\s+/); return parts.at(-1) || name; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function roundCoordinate(value: number) { return Math.round(value * 10) / 10; }
