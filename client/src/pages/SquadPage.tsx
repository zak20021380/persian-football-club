import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, BadgeDollarSign, BriefcaseBusiness, Building2, CalendarClock, Check, CircleAlert, Edit3, Eye, Flag, ListRestart, Plus, RotateCcw, Save, Shirt, Sparkles, Trash2, UserRound, UsersRound, X } from 'lucide-react';
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
  targetIndex: number|null;
  valid: boolean;
}
interface DragGesture {
  index: number;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  targetIndex: number|null;
  valid: boolean;
  active: boolean;
  finishing: boolean;
  moved: boolean;
  element: HTMLButtonElement;
  pitchRect: DOMRect|null;
  longPressTimer: number|null;
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
const LONG_PRESS_MS = 180;
const TOUCH_DRAG_THRESHOLD = 12;
const MOUSE_DRAG_THRESHOLD = 4;
const MIN_SLOT_X_GAP = 18;
const MIN_SLOT_Y_GAP = 15;

export function SquadPage() {
  const queryClient = useQueryClient();
  const pitchRef = useRef<HTMLElement|null>(null);
  const draftRef = useRef<LineupDraft|null>(null);
  const dragRef = useRef<DragGesture|null>(null);
  const dragViewRef = useRef<DragState|null>(null);
  const dragFrameRef = useRef<number|null>(null);
  const dragScrollCleanupRef = useRef<(() => void)|null>(null);
  const savePendingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [draft, setDraft] = useState<LineupDraft|null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number|null>(null);
  const [drag, setDrag] = useState<DragState|null>(null);
  const [nameDialog, setNameDialog] = useState<{ mode: 'create'|'rename'; id?: string; value: string }|null>(null);
  const squad = useQuery({ queryKey: ['clubSquad'], queryFn: async () => (await api.get<SquadData>('/club/squad')).data });
  const demoMode = Boolean(squad.data && squad.data.starters.every(player => !player) && squad.data.substitutes.length === 0);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const updateDraft = useCallback((updater: (current: LineupDraft) => LineupDraft) => {
    setDraft(current => current ? updater(current) : current);
    setDirty(true);
  }, []);

  const renderDragFrame = useCallback(() => {
    dragFrameRef.current = null;
    const gesture = dragRef.current;
    const currentDraft = draftRef.current;
    const pitch = pitchRef.current;
    if (!gesture?.active || !currentDraft || !pitch) return;

    const rect = gesture.pitchRect ?? pitch.getBoundingClientRect();
    const rawX = ((gesture.clientX - rect.left) / rect.width) * 100;
    const rawY = ((gesture.clientY - rect.top) / rect.height) * 100;
    gesture.x = clamp(rawX, 7, 93);
    gesture.y = clamp(rawY, 6, 94);
    gesture.moved ||= Math.hypot(gesture.x - currentDraft.positions[gesture.index].x, gesture.y - currentDraft.positions[gesture.index].y) > 1.2;
    gesture.valid = rawX >= 4 && rawX <= 96 && rawY >= 3 && rawY <= 97;
    gesture.targetIndex = null;

    if (currentDraft.formation !== 'custom') {
      gesture.targetIndex = nearestPosition(currentDraft.positions, gesture.x, gesture.y, rect, -1).index;
    } else {
      const nearest = nearestPosition(currentDraft.positions, gesture.x, gesture.y, rect, gesture.index);
      if (nearest.distance <= Math.min(52, rect.width * .16)) gesture.targetIndex = nearest.index;
      else if (currentDraft.positions.some((position, index) => index !== gesture.index && slotsOverlapInPitch(position, gesture, rect))) gesture.valid = false;
    }

    const origin = currentDraft.positions[gesture.index];
    const translateX = ((gesture.x - origin.x) / 100) * rect.width;
    const translateY = ((gesture.y - origin.y) / 100) * rect.height;
    gesture.element.style.transform = `translate3d(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px), 0) scale(1.06)`;
    const previous = dragViewRef.current;
    if (!previous || previous.index !== gesture.index || previous.targetIndex !== gesture.targetIndex || previous.valid !== gesture.valid) {
      const next = { index: gesture.index, targetIndex: gesture.targetIndex, valid: gesture.valid };
      dragViewRef.current = next;
      setDrag(next);
    }
  }, []);

  const activateDrag = useCallback((pointerId: number) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== pointerId || gesture.active) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    gesture.pitchRect = pitch.getBoundingClientRect();
    gesture.active = true;
    dragScrollCleanupRef.current?.();
    dragScrollCleanupRef.current = lockDragScrolling(gesture.element, pitch);
    if (gesture.longPressTimer !== null) window.clearTimeout(gesture.longPressTimer);
    gesture.longPressTimer = null;
    const initialView = { index: gesture.index, targetIndex: gesture.index, valid: true };
    dragViewRef.current = initialView;
    setDrag(initialView);
    if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(renderDragFrame);
  }, [renderDragFrame]);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.starters[index] || savePendingRef.current || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = currentDraft.positions[index];
    const gesture: DragGesture = {
      index, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY,
      clientX: event.clientX, clientY: event.clientY, x: position.x, y: position.y, targetIndex: index,
      valid: true, active: false, finishing: false, moved: false, element: event.currentTarget, pitchRect: null, longPressTimer: null,
    };
    gesture.longPressTimer = window.setTimeout(() => activateDrag(event.pointerId), LONG_PRESS_MS);
    dragRef.current = gesture;
  }, [activateDrag]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.finishing || event.pointerId !== gesture.pointerId) return;
    gesture.clientX = event.clientX;
    gesture.clientY = event.clientY;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.active) {
      const distance = Math.hypot(deltaX, deltaY);
      const mouseReady = gesture.pointerType === 'mouse' && distance >= MOUSE_DRAG_THRESHOLD;
      const deliberateTouchDrag = gesture.pointerType !== 'mouse' && Math.abs(deltaX) >= TOUCH_DRAG_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
      if (mouseReady || deliberateTouchDrag) activateDrag(event.pointerId);
      else if (Math.abs(deltaY) >= TOUCH_DRAG_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
        if (gesture.longPressTimer !== null) window.clearTimeout(gesture.longPressTimer);
        gesture.longPressTimer = null;
      }
      return;
    }

    // Native vertical scrolling stays untouched until a drag has deliberately started.
    event.preventDefault();
    if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(renderDragFrame);
  }, [activateDrag, renderDragFrame]);

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.finishing || event.pointerId !== gesture.pointerId) return;
    gesture.finishing = true;
    if (gesture.longPressTimer !== null) window.clearTimeout(gesture.longPressTimer);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
      renderDragFrame();
    }
    const wasActive = gesture.active;
    gesture.element.style.transform = '';
    dragScrollCleanupRef.current?.();
    dragScrollCleanupRef.current = null;
    dragRef.current = null;
    dragViewRef.current = null;
    setDrag(null);
    if (wasActive) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    if (cancelled || !wasActive || !gesture.moved) return;
    if (!gesture.valid) return void toast.error('این نقطه برای قرارگیری بازیکن معتبر نیست.');
    const currentDraft = draftRef.current;
    if (!currentDraft) return;
    if (gesture.targetIndex !== null) {
      if (gesture.targetIndex === gesture.index) return;
      updateDraft(lineup => {
        const starters = [...lineup.starters];
        [starters[gesture.index], starters[gesture.targetIndex!]] = [starters[gesture.targetIndex!], starters[gesture.index]];
        return { ...lineup, starters };
      });
    } else if (currentDraft.formation === 'custom') updateDraft(lineup => {
      const positions = clonePositions(lineup.positions);
      positions[gesture.index] = { ...positions[gesture.index], x: roundCoordinate(gesture.x), y: roundCoordinate(gesture.y) };
      return { ...lineup, positions };
    });
  }, [renderDragFrame, updateDraft]);

  const cancelDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => finishDrag(event, true), [finishDrag]);

  const cancelInterruptedDrag = useCallback(() => {
    const gesture = dragRef.current;
    if (!gesture) {
      dragScrollCleanupRef.current?.();
      dragScrollCleanupRef.current = null;
      return;
    }
    if (gesture.finishing) return;
    gesture.finishing = true;
    if (gesture.longPressTimer !== null) window.clearTimeout(gesture.longPressTimer);
    if (gesture.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId);
    gesture.element.style.transform = '';
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    dragScrollCleanupRef.current?.();
    dragScrollCleanupRef.current = null;
    dragRef.current = null;
    dragViewRef.current = null;
    setDrag(null);
  }, []);

  const openSlot = useCallback((index: number) => {
    if (suppressClickRef.current) return;
    setSelectedSlot(index);
  }, []);

  useEffect(() => {
    const cancelWhenHidden = () => { if (document.visibilityState === 'hidden') cancelInterruptedDrag(); };
    window.addEventListener('blur', cancelInterruptedDrag);
    window.addEventListener('pagehide', cancelInterruptedDrag);
    document.addEventListener('visibilitychange', cancelWhenHidden);
    return () => {
      window.removeEventListener('blur', cancelInterruptedDrag);
      window.removeEventListener('pagehide', cancelInterruptedDrag);
      document.removeEventListener('visibilitychange', cancelWhenHidden);
      const gesture = dragRef.current;
      if (gesture?.longPressTimer !== null && gesture?.longPressTimer !== undefined) window.clearTimeout(gesture.longPressTimer);
      if (gesture) gesture.element.style.transform = '';
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
      dragScrollCleanupRef.current?.();
      dragScrollCleanupRef.current = null;
      dragRef.current = null;
      dragViewRef.current = null;
    };
  }, [cancelInterruptedDrag]);

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
  useEffect(() => { savePendingRef.current = saveMutation.isPending; }, [saveMutation.isPending]);

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

  if (squad.isLoading || !draft) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back backTo="/club"/><PageSkeleton/></>;
  if (squad.error || !squad.data) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back backTo="/club"/><main className="p-4"><ErrorState message={(squad.error as Error)?.message || 'ترکیب دریافت نشد'} onRetry={() => squad.refetch()}/></main></>;

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
      positions: separateOverlappingPositions(saved.positions),
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
    <PageHeader title="ترکیب من" subtitle={`${faNumber(draft.starters.filter(Boolean).length)} بازیکن در ترکیب`} back backTo="/club"/>
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

      <section ref={pitchRef} className={cn('lineup-pitch relative mx-auto aspect-[0.648] w-full max-w-[430px] select-none overflow-hidden rounded-[1.75rem] border bg-[#09603f] shadow-[0_10px_28px_rgba(0,0,0,.26)]', drag && 'is-dragging', drag ? drag.valid ? 'border-emerald-200/50' : 'border-rose-300/70' : 'border-emerald-200/[.16]')} dir="ltr" aria-label="زمین چیدمان بازیکنان">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.07),transparent_38%),repeating-linear-gradient(90deg,rgba(255,255,255,.028)_0,rgba(255,255,255,.028)_12.5%,transparent_12.5%,transparent_25%)]"/>
        <div className="absolute inset-3 rounded-[1.25rem] border border-white/25"/>
        <div className="absolute inset-x-3 top-1/2 border-t border-white/25"/>
        <div className="absolute left-1/2 top-1/2 h-[21%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"/>
        <div className="absolute left-1/2 top-3 h-[16%] w-[48%] -translate-x-1/2 border border-t-0 border-white/25"/>
        <div className="absolute bottom-3 left-1/2 h-[16%] w-[48%] -translate-x-1/2 border border-b-0 border-white/25"/>
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"/>
        {draft.positions.map((position, index) => <PitchSlot
          key={`${index}-${draft.starters[index]?._id ?? 'empty'}`}
          position={position}
          player={draft.starters[index]}
          index={index}
          selected={selectedSlot === index}
          dragging={drag?.index === index}
          dropTarget={drag?.targetIndex === index && drag.index !== index}
          dropValid={drag?.valid ?? true}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onClick={openSlot}
        />)}
        {drag && <div className={cn('pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border px-2.5 py-1 text-[7px] font-black', drag.valid ? 'border-emerald-200/30 bg-emerald-950/95 text-emerald-100' : 'border-rose-200/30 bg-rose-950/95 text-rose-100')}>{drag.valid ? drag.targetIndex !== null && drag.targetIndex !== drag.index ? draft.starters[drag.targetIndex] ? 'تعویض جای دو بازیکن' : 'انتقال به جایگاه خالی' : draft.formation === 'custom' ? 'موقعیت جدید معتبر است' : 'نزدیک‌ترین جایگاه معتبر' : 'امکان قرارگیری در این نقطه نیست'}</div>}
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
      onDelete={() => { replaceSlot(selectedSlot, null); setSelectedSlot(null); }}
      onReplace={player => { replaceSlot(selectedSlot, player); setSelectedSlot(null); }}
    />}
    {nameDialog && <NameDialog state={nameDialog} loading={customMutation.isPending} onChange={value => setNameDialog(current => current ? { ...current, value } : current)} onClose={() => setNameDialog(null)} onSubmit={submitNameDialog}/>}
  </div>;
}

const PitchSlot = memo(function PitchSlot({ position, player, index, selected, dragging, dropTarget, dropValid, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClick }: {
  position: SquadPosition; player: DisplayPlayer|null; index: number; selected: boolean; dragging: boolean; dropTarget: boolean; dropValid: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, index: number) => void; onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void; onClick: (index: number) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return <button type="button" onClick={() => onClick(index)} onPointerDown={event => onPointerDown(event, index)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture} aria-label={player ? `${player.name}، ${player.position}` : `افزودن بازیکن به پست ${position.role}`} style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: dragging ? 40 : dropTarget ? 30 : 10, animationDelay: `${index * 22}ms` }} className={cn('lineup-player absolute flex w-[56px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center min-[390px]:w-[62px]', dragging && 'is-dragging cursor-grabbing', selected && !dragging && 'is-selected')}>
    {dropTarget && <span className={cn('pointer-events-none absolute -inset-2 -z-10 rounded-[1.35rem] border-2 border-dashed', dropValid ? 'border-emerald-200 bg-emerald-300/15' : 'border-rose-200 bg-rose-300/15')}/>}
    {player ? <>
      <span className={cn('relative rounded-[1.1rem] border bg-gradient-to-b from-slate-800/95 to-ink-950/95 px-1.5 pb-1.5 pt-1 shadow-[0_5px_12px_rgba(0,0,0,.24)]', dragging ? 'border-emerald-200/70' : 'border-white/20')}>
        <PlayerAvatar player={player} className="mx-auto h-9 w-9 min-[390px]:h-10 min-[390px]:w-10"/>
        <span className="mt-1 flex items-center justify-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.8)]"/><strong className="max-w-[40px] truncate text-[7px] leading-none text-white min-[390px]:max-w-[46px]">{shortName(player.name)}</strong></span>
        <span className="mt-1 text-[6px] font-bold text-emerald-200">{position.role}</span>
      </span>
    </> : <span className={cn('flex min-h-[58px] w-[50px] flex-col items-center justify-center rounded-[1.1rem] border border-dashed bg-ink-950/55 text-white/75 shadow-[0_5px_12px_rgba(0,0,0,.14)] min-[390px]:w-[54px]', selected ? 'border-amber-300 text-amber-300' : 'border-white/35', dropTarget && 'border-emerald-100 bg-emerald-950/70')}><span className="grid h-7 w-7 place-items-center rounded-full bg-white/[.07]"><Plus size={14}/></span><strong className="mt-1 text-[6px]">افزودن بازیکن</strong><span className="mt-0.5 text-[6px] font-black text-emerald-100/75">{position.role}</span></span>}
  </button>;
});

function PlayerAvatar({ player, className }: { player: DisplayPlayer; className?: string }) {
  if (player.demoIndex !== undefined) {
    const column = player.demoIndex % 4;
    const row = Math.floor(player.demoIndex / 4);
    return <span role="img" aria-label={`تصویر ${player.name}`} className={cn('block shrink-0 rounded-full border border-white/20 bg-cover', className)} style={{ backgroundImage: "url('/assets/demo-player-sprite.png')", backgroundSize: '400% 300%', backgroundPosition: `${column * 33.333}% ${row * 50}%` }}/>;
  }
  return <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-ink-850', className)}>{player.photoUrl ? <img src={player.photoUrl} alt="" draggable={false} className="h-full w-full object-cover"/> : <span className="text-[10px] font-black text-pitch-300">{player.name.slice(0, 1)}</span>}</span>;
}

const BenchPlayer = memo(function BenchPlayer({ player }: { player: DisplayPlayer }) {
  return <div className="min-w-0 rounded-2xl border border-white/[.05] bg-white/[.03] p-2 text-center"><PlayerAvatar player={player} className="mx-auto h-9 w-9"/><strong className="mt-1.5 block truncate text-[8px]">{shortName(player.name)}</strong><span className="mt-0.5 block text-[7px] text-slate-500">{player.position}</span></div>;
});

function PlayerSheet({ slotRole, player, substitutes, loading, onClose, onRemove, onDelete, onReplace }: { slotRole: string; player: DisplayPlayer|null; substitutes: DisplayPlayer[]; loading: boolean; onClose: () => void; onRemove: () => void; onDelete: () => void; onReplace: (player: DisplayPlayer) => void }) {
  const [showReplacements, setShowReplacements] = useState(!player);
  const sheetRef = useRef<HTMLDivElement|null>(null);
  const swipeFrameRef = useRef<number|null>(null);
  const swipeRef = useRef<{ pointerId: number; startY: number; clientY: number; startedAt: number }|null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      if (swipeFrameRef.current !== null) window.cancelAnimationFrame(swipeFrameRef.current);
    };
  }, [onClose]);

  const renderSheetSwipe = () => {
    swipeFrameRef.current = null;
    const gesture = swipeRef.current;
    if (!gesture || !sheetRef.current) return;
    sheetRef.current.style.transform = `translate3d(0, ${Math.max(0, gesture.clientY - gesture.startY)}px, 0)`;
  };

  const startSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (loading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    swipeRef.current = { pointerId: event.pointerId, startY: event.clientY, clientY: event.clientY, startedAt: Date.now() };
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    gesture.clientY = event.clientY;
    if (swipeFrameRef.current === null) swipeFrameRef.current = window.requestAnimationFrame(renderSheetSwipe);
  };
  const endSwipe = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const distance = Math.max(0, event.clientY - gesture.startY);
    const velocity = distance / Math.max(1, Date.now() - gesture.startedAt);
    swipeRef.current = null;
    if (!cancelled && (distance > 82 || velocity > .55)) onClose();
    else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 300ms cubic-bezier(.22,1,.36,1)';
      sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  return <div className="squad-backdrop fixed inset-0 z-[90] flex items-end bg-black/80" role="dialog" aria-modal="true" aria-label={player ? `پنل ${player.name}` : `افزودن بازیکن به ${slotRole}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={sheetRef} className="safe-bottom squad-sheet h-[62dvh] min-h-[360px] max-h-[680px] w-full overflow-hidden rounded-t-[2rem] border-t border-emerald-200/[.12] bg-[linear-gradient(180deg,#0d1c2f_0%,#091625_100%)] shadow-[0_-14px_36px_rgba(0,0,0,.4)]">
      <div onPointerDown={startSwipe} onPointerMove={moveSwipe} onPointerUp={event => endSwipe(event)} onPointerCancel={event => endSwipe(event, true)} className="relative flex h-12 touch-none cursor-grab items-center justify-center active:cursor-grabbing">
        <span className="h-1.5 w-14 rounded-full bg-gradient-to-r from-white/10 via-white/35 to-white/10 shadow-[0_1px_8px_rgba(255,255,255,.08)]"/>
        <button type="button" disabled={loading} onClick={onClose} aria-label="بستن پنل" className="absolute left-4 top-2 grid h-9 w-9 place-items-center rounded-full border border-white/[.06] bg-white/[.05] text-slate-400 transition active:scale-95"><X size={17}/></button>
      </div>

      <div className="momentum-scroll h-[calc(100%-3rem)] overflow-y-auto overscroll-contain px-4 pb-5 scrollbar-none">
        <div className="mx-auto max-w-xl">
          {player ? <>
            <section className="relative overflow-hidden rounded-[1.6rem] border border-white/[.07] bg-white/[.035] p-4">
              <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-emerald-400/[.08] blur-3xl"/>
              <div className="relative flex items-center gap-3.5">
                <div className="relative shrink-0"><PlayerAvatar player={player} className="h-[76px] w-[76px] border-2 border-emerald-200/35 shadow-[0_12px_28px_rgba(0,0,0,.35)]"/><span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-ink-900 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.55)]"/></div>
                <div className="min-w-0 flex-1"><span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[.08] px-2 py-1 text-[8px] font-bold text-emerald-200"><Shirt size={10}/>ترکیب اصلی</span><h2 className="mt-2 truncate text-lg font-black tracking-tight">{player.name}</h2><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-slate-400"><span className="flex items-center gap-1"><Building2 size={12}/>{player.club || 'باشگاه ثبت نشده'}</span><span className="text-white/15">•</span><span className="flex items-center gap-1"><Flag size={12}/>{player.nationality || 'ملیت ثبت نشده'}</span></div></div>
              </div>
            </section>

            <section className="mt-3 grid grid-cols-2 gap-2" aria-label="اطلاعات بازیکن">
              <PlayerInfoCard icon={<Shirt size={16}/>} label="پست اصلی" value={positionLabel(player.position)}/>
              <PlayerInfoCard icon={<BadgeDollarSign size={16}/>} label="ارزش بازیکن" value={formatMarketValue(player.marketValue)}/>
              <PlayerInfoCard icon={<CalendarClock size={16}/>} label="وضعیت قرارداد" value={player.contractStatus || 'ثبت نشده'}/>
              <PlayerInfoCard icon={<BriefcaseBusiness size={16}/>} label="حضور در ترکیب" value={`جایگاه ${slotRole}`}/>
            </section>

            <section className="mt-5" aria-label="عملیات بازیکن">
              <div className="mb-2.5 flex items-center justify-between"><div><p className="text-[8px] font-bold text-emerald-300">مدیریت بازیکن</p><h3 className="mt-0.5 text-xs font-black">عملیات در دسترس</h3></div><span className="text-[7px] text-slate-500">برای تغییر ترکیب انتخاب کن</span></div>
              <button type="button" disabled={!substitutes.length || loading} onClick={() => setShowReplacements(value => !value)} className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-gradient-to-l from-emerald-400 to-emerald-500 px-4 text-[10px] font-black text-ink-950 shadow-[0_12px_30px_rgba(16,185,129,.18)] transition active:scale-[.985] disabled:opacity-40"><span className="flex items-center gap-2"><ArrowLeftRight size={17}/>تعویض بازیکن</span><ArrowLeft size={15}/></button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" disabled={loading} onClick={onRemove} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/[.07] bg-white/[.045] text-[9px] font-bold text-slate-200 transition active:scale-[.98]"><ListRestart size={15} className="text-sky-300"/>انتقال به نیمکت</button>
                <Link to={`/club/players?player=${player._id}`} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/[.07] bg-white/[.045] text-[9px] font-bold text-slate-200 transition active:scale-[.98]"><Eye size={15} className="text-violet-300"/>مشاهده جزئیات</Link>
              </div>
              <div className="mt-3 border-t border-white/[.06] pt-3"><button type="button" disabled={loading} onClick={() => { if (confirm(`«${player.name}» از ترکیب خارج شود؟`)) onDelete(); }} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/10 bg-rose-400/[.055] text-[9px] font-bold text-rose-300 transition active:scale-[.985]"><Trash2 size={14}/>حذف از ترکیب</button></div>
            </section>
          </> : <section className="rounded-[1.6rem] border border-white/[.07] bg-white/[.035] p-4 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-dashed border-emerald-300/25 bg-emerald-400/[.08] text-emerald-300"><Plus size={25}/></span><p className="mt-3 text-[8px] font-bold text-emerald-300">جایگاه {slotRole}</p><h2 className="mt-1 text-base font-black">افزودن بازیکن</h2><p className="mt-1.5 text-[9px] leading-5 text-slate-500">یکی از بازیکنان نیمکت را برای این جایگاه انتخاب کن.</p></section>}

          {showReplacements && <section className="mt-5 pb-2"><div className="mb-2.5 flex items-center justify-between"><h3 className="text-xs font-black">بازیکنان قابل انتخاب</h3><span className="rounded-full bg-white/[.045] px-2 py-1 text-[8px] text-slate-500">{faNumber(substitutes.length)} ذخیره</span></div>
            {substitutes.length ? <div className="grid grid-cols-2 gap-2">{substitutes.map(substitute => <button type="button" key={substitute._id} disabled={loading} onClick={() => onReplace(substitute)} className="flex min-h-16 min-w-0 items-center gap-2 rounded-2xl border border-white/[.06] bg-white/[.035] p-2.5 text-right transition active:scale-[.98] active:bg-emerald-400/[.08]"><PlayerAvatar player={substitute} className="h-10 w-10"/><span className="min-w-0 flex-1"><strong className="block truncate text-[9px]">{substitute.name}</strong><span className="mt-1 block text-[7px] text-slate-500">{positionLabel(substitute.position)}{substitute.club ? ` · ${substitute.club}` : ''}</span></span></button>)}</div> : <div className="rounded-2xl border border-dashed border-white/[.07] bg-white/[.02] p-4 text-center"><p className="text-[9px] text-slate-500">بازیکن ذخیره‌ای برای این جایگاه وجود ندارد.</p><Link to="/club/transfer-market" className="btn-secondary mt-3 min-h-9 px-4 py-2 text-[8px]">رفتن به بازار بازیکنان</Link></div>}
          </section>}
        </div>
      </div>
    </div>
  </div>;
}

function PlayerInfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[.06] bg-white/[.035] p-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-400/[.08] text-emerald-300">{icon}</span><span className="mt-2 block text-[7px] font-medium text-slate-500">{label}</span><strong className="mt-1 block truncate text-[9px] font-extrabold text-slate-100">{value}</strong></div>;
}

function NameDialog({ state, loading, onChange, onClose, onSubmit }: { state: { mode: 'create'|'rename'; value: string }; loading: boolean; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={state.mode === 'create' ? 'ذخیره آرایش دلخواه' : 'تغییر نام آرایش'} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 p-4 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[8px] font-bold text-pitch-300">آرایش دلخواه</p><h2 className="mt-1 text-sm font-black">{state.mode === 'create' ? 'ذخیره آرایش جدید' : 'تغییر نام آرایش'}</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.05] text-slate-400"><X size={16}/></button></div><label className="label mt-4" htmlFor="formation-name">نام آرایش</label><input id="formation-name" autoFocus maxLength={30} value={state.value} onChange={event => onChange(event.target.value)} placeholder="مثلاً آرایش هجومی من" className="input"/><button type="submit" disabled={loading} className="btn-primary mt-3 w-full">{loading ? <RotateCcw size={16} className="animate-spin"/> : <Check size={16}/>}تأیید و ذخیره</button></form></div>;
}

function draftFromData(data: SquadData): LineupDraft {
  const positions = data.formation === 'custom' && data.customPositions.length === 11
    ? separateOverlappingPositions(data.customPositions)
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
    return { formation: stored.formation!, starters, substitutes: pool.filter(player => !selected.has(player._id)), positions: separateOverlappingPositions(stored.positions) };
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
    if (slotsOverlap(draft.positions[first], draft.positions[second])) return 'بازیکن‌ها بیش از حد به هم نزدیک‌اند؛ جایگاه‌ها را کمی دورتر کن.';
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

function slotsOverlap(first: Pick<SquadPosition, 'x'|'y'>, second: Pick<SquadPosition, 'x'|'y'>) {
  return Math.abs(first.x - second.x) < MIN_SLOT_X_GAP && Math.abs(first.y - second.y) < MIN_SLOT_Y_GAP;
}

function slotsOverlapInPitch(first: Pick<SquadPosition, 'x'|'y'>, second: Pick<SquadPosition, 'x'|'y'>, rect: DOMRect) {
  const xGap = Math.min(54, rect.width * (MIN_SLOT_X_GAP / 100));
  const yGap = Math.min(72, rect.height * (MIN_SLOT_Y_GAP / 100));
  return Math.abs(first.x - second.x) / 100 * rect.width < xGap
    && Math.abs(first.y - second.y) / 100 * rect.height < yGap;
}

function separateOverlappingPositions(positions: SquadPosition[]): SquadPosition[] {
  const candidates = [8, 24, 40, 56, 72, 88].flatMap(y => [10, 30, 50, 70, 90].map(x => ({ x, y })));
  const separated: SquadPosition[] = [];
  for (const source of positions) {
    const position = { ...source, x: clamp(source.x, 9, 91), y: clamp(source.y, 8, 92) };
    if (!separated.some(other => slotsOverlap(position, other))) {
      separated.push(position);
      continue;
    }
    const replacement = candidates
      .filter(candidate => !separated.some(other => slotsOverlap(candidate, other)))
      .sort((first, second) => Math.hypot(first.x - position.x, first.y - position.y) - Math.hypot(second.x - position.x, second.y - position.y))[0];
    const fallback = formations['4-3-3'][separated.length];
    separated.push({ ...position, x: replacement?.x ?? fallback.x, y: replacement?.y ?? fallback.y });
  }
  return separated;
}

function clonePositions(positions: SquadPosition[]): SquadPosition[] { return positions.map(position => ({ ...position })); }
function uniquePlayers(players: DisplayPlayer[]) { return players.filter((player, index) => players.findIndex(item => item._id === player._id) === index); }
function shortName(name: string) { const parts = name.trim().split(/\s+/); return parts.at(-1) || name; }
function positionLabel(position: ClubPlayer['position']) {
  const labels: Record<ClubPlayer['position'], string> = { GK: 'دروازه‌بان', RB: 'مدافع راست', CB: 'مدافع میانی', LB: 'مدافع چپ', DM: 'هافبک دفاعی', CM: 'هافبک میانی', AM: 'هافبک هجومی', RW: 'وینگر راست', LW: 'وینگر چپ', ST: 'مهاجم' };
  return `${labels[position]} · ${position}`;
}
function formatMarketValue(value?: number) { return value === undefined ? 'ثبت نشده' : `${faNumber(value)} سکه`; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function roundCoordinate(value: number) { return Math.round(value * 10) / 10; }
function preventActiveTouchScroll(event: TouchEvent) { if (event.cancelable) event.preventDefault(); }

function lockDragScrolling(player: HTMLElement, pitch: HTMLElement): () => void {
  const root = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const rootStyles = captureInlineStyles(root, ['overflow', 'overscrollBehavior', 'touchAction']);
  const bodyStyles = captureInlineStyles(body, ['overflow', 'overscrollBehavior', 'touchAction', 'position', 'top', 'left', 'right', 'width']);
  const pitchStyles = captureInlineStyles(pitch, ['touchAction', 'overscrollBehavior']);
  const playerStyles = captureInlineStyles(player, ['touchAction', 'overscrollBehavior']);

  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
  root.style.touchAction = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  body.style.touchAction = 'none';
  body.style.position = 'fixed';
  body.style.top = `${-scrollY}px`;
  body.style.left = `${-scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';
  pitch.style.touchAction = 'none';
  pitch.style.overscrollBehavior = 'none';
  player.style.touchAction = 'none';
  player.style.overscrollBehavior = 'none';
  window.addEventListener('touchmove', preventActiveTouchScroll, { passive: false, capture: true });

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    window.removeEventListener('touchmove', preventActiveTouchScroll, true);
    restoreInlineStyles(root, rootStyles);
    restoreInlineStyles(body, bodyStyles);
    restoreInlineStyles(pitch, pitchStyles);
    restoreInlineStyles(player, playerStyles);
    window.scrollTo(scrollX, scrollY);
  };
}

type LockStyleProperty = 'overflow'|'overscrollBehavior'|'touchAction'|'position'|'top'|'left'|'right'|'width';

function captureInlineStyles(element: HTMLElement, properties: LockStyleProperty[]) {
  return properties.map(property => [property, element.style[property] as string] as const);
}

function restoreInlineStyles(element: HTMLElement, styles: ReadonlyArray<readonly [LockStyleProperty, string]>) {
  styles.forEach(([property, value]) => { element.style[property] = value; });
}
