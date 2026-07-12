import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, BadgeDollarSign, BriefcaseBusiness, Building2, CalendarClock, CircleAlert, Eye, Flag, ListRestart, Plus, RotateCcw, Save, Shirt, Sparkles, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/PageHeader';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { formations } from '@/lib/formations';
import { api } from '@/lib/api';
import { impact, notify } from '@/lib/telegram';
import { cn, faNumber } from '@/lib/utils';
import type { BuiltInSquadFormation, ClubPlayer, SquadData, SquadFormation, SquadPosition } from '@/types/api';

type DisplayPlayer = ClubPlayer & { demoIndex?: number };
interface LineupDraft {
  formation: SquadFormation;
  starters: Array<DisplayPlayer|null>;
  substitutes: DisplayPlayer[];
  positions: SquadPosition[];
}
type DragLocation = { kind: 'pitch'|'bench'; index: number };
interface DragState {
  source: DragLocation;
  target: DragLocation|null;
  player: DisplayPlayer;
  valid: boolean;
  clientX: number;
  clientY: number;
}
interface DragGesture {
  source: DragLocation;
  player: DisplayPlayer;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  target: DragLocation|null;
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

const demoSubstitutes: DisplayPlayer[] = [
  { _id: 'demo-sub-1', name: 'آراد نیک‌فر', position: 'GK', overall: 77, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 420, demoIndex: 11 },
  { _id: 'demo-sub-2', name: 'بردیا فرهمند', position: 'CB', overall: 79, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 510, demoIndex: 3 },
  { _id: 'demo-sub-3', name: 'سام رستگار', position: 'LB', overall: 78, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 465, demoIndex: 1 },
  { _id: 'demo-sub-4', name: 'مانی یزدان‌پناه', position: 'DM', overall: 80, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 580, demoIndex: 5 },
  { _id: 'demo-sub-5', name: 'پارسا کیانی', position: 'AM', overall: 82, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 640, demoIndex: 6 },
  { _id: 'demo-sub-6', name: 'رادین مهرآور', position: 'RW', overall: 81, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 610, demoIndex: 10 },
  { _id: 'demo-sub-7', name: 'آریا شایگان', position: 'ST', overall: 83, nationality: 'ایران', club: 'تیم آینده', contractStatus: 'آماده', marketValue: 720, demoIndex: 9 },
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
  const dirtyRef = useRef(false);
  const [draft, setDraft] = useState<LineupDraft|null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number|null>(null);
  const [selectedBenchPlayer, setSelectedBenchPlayer] = useState<DisplayPlayer|null>(null);
  const [showAllSubstitutes, setShowAllSubstitutes] = useState(false);
  const [drag, setDrag] = useState<DragState|null>(null);
  const squad = useQuery({ queryKey: ['clubSquad'], queryFn: async () => (await api.get<SquadData>('/club/squad')).data });
  const demoMode = Boolean(squad.data && squad.data.starters.every(player => !player) && squad.data.substitutes.length === 0);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const updateDraft = useCallback((updater: (current: LineupDraft) => LineupDraft) => {
    setDraft(current => current ? updater(current) : current);
    setDirty(true);
  }, []);

  const swapMutation = useMutation({
    mutationFn: async ({ next }: { next: LineupDraft; previous: LineupDraft; previousDirty: boolean }) => (await api.put<SquadData>('/club/squad', {
      formation: next.formation,
      starterIds: next.starters.map(player => player?._id ?? null),
      positions: next.positions,
    })).data,
    onSuccess: data => {
      const confirmed = draftFromData(data);
      draftRef.current = confirmed;
      setDraft(confirmed);
      queryClient.setQueryData(['clubSquad'], data);
      setDirty(false);
      localStorage.removeItem(DRAFT_KEY);
      impact('light');
    },
    onError: (_error, variables) => {
      applyDraftTransition(variables.previous, setDraft);
      draftRef.current = variables.previous;
      setDirty(variables.previousDirty);
      notify('error');
      toast.error('ذخیره جابه‌جایی انجام نشد؛ ترکیب قبلی بازگردانده شد.');
    },
  });

  const commitDragDraft = useCallback((next: LineupDraft) => {
    const previous = draftRef.current;
    if (!previous) return;
    applyDraftTransition(next, setDraft);
    draftRef.current = next;
    setDirty(true);
    impact('medium');
    if (!demoMode) swapMutation.mutate({ next, previous, previousDirty: dirtyRef.current });
  }, [demoMode, swapMutation]);

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
    gesture.moved ||= Math.hypot(gesture.clientX - gesture.startX, gesture.clientY - gesture.startY) > 3;

    const insidePitch = rawX >= 2 && rawX <= 98 && rawY >= 2 && rawY <= 98;
    let target = dropLocationAtPoint(gesture.clientX, gesture.clientY);
    if (!target && insidePitch) target = { kind: 'pitch', index: nearestPosition(currentDraft.positions, gesture.x, gesture.y, rect, -1).index };
    gesture.target = target;

    if (target) {
      if (sameDragLocation(gesture.source, target)) gesture.valid = true;
      else {
        const candidate = swapPlayers(currentDraft, gesture.source, target);
        gesture.valid = Boolean(candidate && !validateDraft(candidate));
      }
    } else if (gesture.source.kind === 'pitch' && currentDraft.formation === 'custom' && insidePitch) {
      gesture.valid = !currentDraft.positions.some((position, index) => index !== gesture.source.index && slotsOverlapInPitch(position, gesture, rect));
    } else gesture.valid = false;

    const previous = dragViewRef.current;
    if (!previous || !sameOptionalDragLocation(previous.target, gesture.target) || previous.valid !== gesture.valid || previous.clientX !== gesture.clientX || previous.clientY !== gesture.clientY) {
      if (previous && (!sameOptionalDragLocation(previous.target, gesture.target) || previous.valid !== gesture.valid)) impact(gesture.valid ? 'light' : 'medium');
      const next = { source: gesture.source, target: gesture.target, player: gesture.player, valid: gesture.valid, clientX: gesture.clientX, clientY: gesture.clientY };
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
    impact('light');
    if (gesture.longPressTimer !== null) window.clearTimeout(gesture.longPressTimer);
    gesture.longPressTimer = null;
    const initialView = { source: gesture.source, target: gesture.source, player: gesture.player, valid: true, clientX: gesture.clientX, clientY: gesture.clientY };
    dragViewRef.current = initialView;
    setDrag(initialView);
    if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(renderDragFrame);
  }, [renderDragFrame]);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, source: DragLocation) => {
    const currentDraft = draftRef.current;
    const player = currentDraft ? playerAt(currentDraft, source) : null;
    if (!currentDraft || !player || savePendingRef.current || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = source.kind === 'pitch' ? currentDraft.positions[source.index] : null;
    const gesture: DragGesture = {
      source, player, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY,
      clientX: event.clientX, clientY: event.clientY, x: position?.x ?? 50, y: position?.y ?? 50, target: source,
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
    if (!gesture.valid) {
      notify('warning');
      return void toast.error('این جابه‌جایی قوانین ترکیب را نقض می‌کند.');
    }
    const currentDraft = draftRef.current;
    if (!currentDraft) return;
    if (gesture.target) {
      if (sameDragLocation(gesture.source, gesture.target)) return;
      const next = swapPlayers(currentDraft, gesture.source, gesture.target);
      if (next && !validateDraft(next)) commitDragDraft(next);
    } else if (gesture.source.kind === 'pitch' && currentDraft.formation === 'custom') {
      const positions = clonePositions(currentDraft.positions);
      positions[gesture.source.index] = { ...positions[gesture.source.index], x: roundCoordinate(gesture.x), y: roundCoordinate(gesture.y) };
      const next = { ...currentDraft, positions };
      if (!validateDraft(next)) commitDragDraft(next);
    }
  }, [commitDragDraft, renderDragFrame]);

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
    setSelectedBenchPlayer(null);
    setSelectedSlot(index);
  }, []);

  const openBenchPlayer = useCallback((player: DisplayPlayer) => {
    setSelectedSlot(null);
    setSelectedBenchPlayer(player);
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
      nextDraft = { formation: '4-3-3', starters: demoPlayers, substitutes: demoSubstitutes, positions: clonePositions(formations['4-3-3']) };
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
  useEffect(() => { savePendingRef.current = saveMutation.isPending || swapMutation.isPending; }, [saveMutation.isPending, swapMutation.isPending]);

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

  return <div className="squad-page min-h-screen overflow-x-hidden bg-ink-950 pb-8">
    <PageHeader title="ترکیب من" subtitle={`${faNumber(draft.starters.filter(Boolean).length)} بازیکن در ترکیب`} back backTo="/club"/>
    <main className="mx-auto max-w-xl px-3 pt-3 sm:px-4">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[.06] bg-white/[.025] p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dirty ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.5)]' : 'bg-emerald-400')}/>
          <div className="min-w-0"><strong className="block text-[9px]">{demoMode ? 'حالت نمایشی' : dirty ? 'تغییرات ذخیره‌نشده' : 'همه تغییرات ذخیره شده'}</strong><span className="block truncate text-[7px] text-slate-500">{drag ? drag.valid ? 'رها کن تا جابه‌جا شود' : 'محل رهاکردن نامعتبر است' : 'بازیکن را بگیر و روی جایگاه مقصد رها کن'}</span></div>
        </div>
        <button type="button" onClick={save} disabled={saveMutation.isPending || swapMutation.isPending || (!dirty && !demoMode)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-pitch-400 px-3 text-[9px] font-black text-ink-950 transition active:scale-95 disabled:opacity-45">
          {saveMutation.isPending || swapMutation.isPending ? <RotateCcw size={14} className="animate-spin"/> : <Save size={14}/>}ذخیره ترکیب
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
          dragging={drag?.source.kind === 'pitch' && drag.source.index === index}
          dropTarget={drag?.target?.kind === 'pitch' && drag.target.index === index && !sameDragLocation(drag.source, drag.target)}
          dropValid={drag?.valid ?? true}
          onPointerDown={(event, slotIndex) => beginDrag(event, { kind: 'pitch', index: slotIndex })}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onClick={openSlot}
        />)}
        {drag && <div className={cn('pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border px-2.5 py-1 text-[7px] font-black', drag.valid ? 'border-emerald-200/30 bg-emerald-950/95 text-emerald-100' : 'border-rose-200/30 bg-rose-950/95 text-rose-100')}>{drag.valid ? drag.target && !sameDragLocation(drag.source, drag.target) ? 'رها کن تا بازیکن‌ها جابه‌جا شوند' : 'بازیکن را روی مقصد رها کن' : 'این مقصد با قوانین ترکیب سازگار نیست'}</div>}
      </section>

      {validationMessage && !demoMode && <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-2.5 text-[8px] leading-5 text-amber-100/80"><CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-300"/><span>{validationMessage}</span></div>}

      <section className="mt-4">
        <div className="mb-2.5 flex items-end justify-between"><div><div className="flex items-center gap-2"><UsersRound size={16} className="text-pitch-300"/><h2 className="text-xs font-black">بازیکنان ذخیره</h2></div><p className="mt-1 text-[7px] text-slate-500">نیمکت آماده برای تغییر جریان مسابقه</p></div><span className="rounded-full border border-emerald-300/10 bg-emerald-400/[.07] px-2 py-1 text-[7px] font-bold text-emerald-200">{faNumber(draft.substitutes.length)} بازیکن</span></div>
        {draft.substitutes.length ? <>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {(showAllSubstitutes ? draft.substitutes : draft.substitutes.slice(0, 8)).map((player, index) => (
              <BenchPlayer
                key={player._id}
                player={player}
                index={index}
                dragging={drag?.source.kind === 'bench' && drag.source.index === index}
                dropTarget={drag?.target?.kind === 'bench' && drag.target.index === index && !sameDragLocation(drag.source, drag.target)}
                dropValid={drag?.valid ?? true}
                onPointerDown={event => beginDrag(event, { kind: 'bench', index })}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={cancelDrag}
                onLostPointerCapture={cancelDrag}
                onClick={() => openBenchPlayer(player)}
              />
            ))}
          </div>
          {draft.substitutes.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllSubstitutes(value => !value)}
              className="mt-2.5 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300/12 bg-emerald-400/[.07] text-[8px] font-black text-emerald-200 transition active:scale-[.985]"
            >
              {showAllSubstitutes ? 'نمایش کمتر' : 'مشاهده همه ذخیره‌ها'}
            </button>
          )}
        </> : <Card className="flex min-h-20 items-center gap-3 border-dashed p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.04] text-slate-500"><UserRound size={18}/></span><div className="min-w-0 flex-1"><h3 className="text-[10px] font-black">نیمکت خالی است</h3><p className="mt-1 text-[8px] text-slate-500">از بازار بازیکن جدید به باشگاه اضافه کن.</p></div><Link to="/club/transfer-market" className="flex min-h-9 shrink-0 items-center rounded-xl bg-white/[.05] px-2.5 text-[8px] font-bold text-slate-300">بازار</Link></Card>}
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

    {selectedBenchPlayer && selectedSlot === null && <PlayerSheet
      slotRole={selectedBenchPlayer.position}
      player={selectedBenchPlayer}
      substitutes={draft.substitutes.filter(player => player._id !== selectedBenchPlayer._id)}
      loading={false}
      onClose={() => setSelectedBenchPlayer(null)}
      onRemove={() => setSelectedBenchPlayer(null)}
      onDelete={() => setSelectedBenchPlayer(null)}
      onReplace={_player => setSelectedBenchPlayer(null)}
    />}
    {drag && createPortal(<FloatingDragPlayer drag={drag}/>, document.body)}
  </div>;
}

const PitchSlot = memo(function PitchSlot({ position, player, index, selected, dragging, dropTarget, dropValid, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClick }: {
  position: SquadPosition; player: DisplayPlayer|null; index: number; selected: boolean; dragging: boolean; dropTarget: boolean; dropValid: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, index: number) => void; onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void; onClick: (index: number) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return <button type="button" data-pitch-index={index} onClick={() => onClick(index)} onPointerDown={event => onPointerDown(event, index)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture} aria-label={player ? `${player.name}، ${player.position}` : `افزودن بازیکن به پست ${position.role}`} style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: dragging ? 40 : dropTarget ? 30 : 10, animationDelay: `${index * 22}ms`, viewTransitionName: player ? transitionName(player) : undefined }} className={cn('lineup-player absolute flex w-[56px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center transition-[opacity,filter] duration-200 min-[390px]:w-[62px]', dragging && 'is-dragging cursor-grabbing opacity-25 grayscale', selected && !dragging && 'is-selected')}>
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

const BenchPlayer = memo(function BenchPlayer({ player, index, dragging, dropTarget, dropValid, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClick }: {
  player: DisplayPlayer; index: number; dragging: boolean; dropTarget: boolean; dropValid: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => void; onClick: () => void;
}) {
  const accent = ['from-emerald-400/10', 'from-sky-400/10', 'from-violet-400/10'][index % 3];
  return <button type="button" data-bench-index={index} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture} onClick={onClick} aria-label={`${player.name}، ${player.position}، ${formatMarketValue(player.marketValue)}`} style={{ viewTransitionName: transitionName(player) }} className={cn('bench-player relative flex min-w-0 w-full flex-col items-center overflow-hidden rounded-xl border bg-gradient-to-b to-ink-900/90 px-1 py-1.5 text-center shadow-[0_4px_10px_rgba(0,0,0,.1)] transition duration-200 active:scale-[.98] sm:rounded-2xl sm:px-1.5 sm:py-2', accent, dragging ? 'is-dragging border-white/[.04] opacity-25 grayscale' : dropTarget ? dropValid ? 'is-drop-valid border-emerald-300/70 ring-2 ring-emerald-300/25' : 'is-drop-invalid border-rose-300/70 ring-2 ring-rose-300/25' : 'border-white/[.06]')}>
    <PlayerAvatar player={player} className="h-8 w-8 shadow-[0_3px_8px_rgba(0,0,0,.2)] sm:h-[34px] sm:w-[34px]"/>
    <strong className="mt-1 w-full truncate text-[7px] font-black leading-tight text-white sm:mt-1.5 sm:text-[8px]">{shortName(player.name)}</strong>
    <span className="mt-0.5 w-full truncate text-[5.5px] font-bold text-slate-400 sm:text-[6px]">{player.position}</span>
    <span className="mt-0.5 w-full truncate text-[5.5px] font-bold text-emerald-300/90 sm:mt-1 sm:text-[6px]">{formatMarketValue(player.marketValue)}</span>
  </button>;
});

function FloatingDragPlayer({ drag }: { drag: DragState }) {
  return <div data-floating-drag-player dir="rtl" aria-hidden="true" style={{ left: drag.clientX, top: drag.clientY }} className={cn('pointer-events-none fixed z-[140] flex w-[92px] -translate-x-1/2 -translate-y-[115%] items-center gap-2 rounded-2xl border bg-ink-900/95 p-2 shadow-[0_14px_34px_rgba(0,0,0,.45)] backdrop-blur-md transition-colors', drag.valid ? 'border-emerald-300/70 shadow-emerald-950/40' : 'border-rose-300/75 shadow-rose-950/40')}>
    <PlayerAvatar player={drag.player} className="h-9 w-9"/>
    <span className="min-w-0 flex-1"><strong className="block truncate text-[8px] font-black text-white">{shortName(drag.player.name)}</strong><span className={cn('mt-1 block text-[6px] font-bold', drag.valid ? 'text-emerald-300' : 'text-rose-300')}>{drag.valid ? 'مقصد معتبر' : 'مقصد نامعتبر'}</span></span>
  </div>;
}

function PlayerSheet({ slotRole, player, substitutes, loading, onClose, onRemove, onDelete, onReplace }: { slotRole: string; player: DisplayPlayer|null; substitutes: DisplayPlayer[]; loading: boolean; onClose: () => void; onRemove: () => void; onDelete: () => void; onReplace: (player: DisplayPlayer) => void }) {
  const [showReplacements, setShowReplacements] = useState(!player);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement|null>(null);
  const swipeFrameRef = useRef<number|null>(null);
  const swipeRef = useRef<{ pointerId: number; startY: number; clientY: number; startedAt: number }|null>(null);
  const closeTimerRef = useRef<number|null>(null);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }
    closeTimerRef.current = window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const unlockPage = lockModalPageScrolling();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      unlockPage();
      window.removeEventListener('keydown', closeOnEscape);
      if (swipeFrameRef.current !== null) window.cancelAnimationFrame(swipeFrameRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [requestClose]);

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
    if (!cancelled && (distance > 82 || velocity > .55)) requestClose();
    else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 300ms cubic-bezier(.22,1,.36,1)';
      sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  return createPortal(<div className={cn('player-modal-backdrop fixed inset-0 z-[100] h-[100dvh] overflow-hidden bg-black/85', closing && 'is-closing')} role="dialog" aria-modal="true" aria-label={player ? `پنل ${player.name}` : `افزودن بازیکن به ${slotRole}`}>
    <div ref={sheetRef} className={cn('player-modal-panel flex h-[100dvh] w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#0d1c2f_0%,#071321_100%)]', closing && 'is-closing')}>
      <div onPointerDown={startSwipe} onPointerMove={moveSwipe} onPointerUp={event => endSwipe(event)} onPointerCancel={event => endSwipe(event, true)} className="player-modal-top safe-top relative flex h-[50px] shrink-0 touch-none cursor-grab items-end justify-center pb-2 active:cursor-grabbing">
        <span className="h-1 w-12 rounded-full bg-gradient-to-r from-white/10 via-white/35 to-white/10"/>
        <button type="button" disabled={loading || closing} onClick={requestClose} aria-label="بستن پنل" className="absolute left-3 bottom-1 grid h-9 w-9 place-items-center rounded-full border border-white/[.07] bg-white/[.06] text-slate-300 transition active:scale-95"><X size={17}/></button>
      </div>

      <div className="player-modal-content mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-3 pb-[max(10px,var(--safe-bottom))]">
        {player ? <>
          <section className="player-modal-hero relative shrink-0 overflow-hidden rounded-[1.25rem] border border-white/[.07] bg-white/[.035] p-2.5">
            <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-emerald-400/[.08] blur-3xl"/>
            <div className="relative flex items-center gap-2.5">
              <div className="relative shrink-0"><PlayerAvatar player={player} className="player-modal-avatar h-14 w-14 border-2 border-emerald-200/35 shadow-[0_8px_20px_rgba(0,0,0,.32)]"/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-[2px] border-ink-900 bg-emerald-400"/></div>
              <div className="min-w-0 flex-1"><span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[.08] px-2 py-0.5 text-[7px] font-bold text-emerald-200"><Shirt size={9}/>ترکیب اصلی</span><h2 className="mt-1 truncate text-[15px] font-black tracking-tight">{player.name}</h2><div className="mt-1 flex min-w-0 items-center gap-1.5 text-[7px] text-slate-400"><span className="flex min-w-0 items-center gap-1 truncate"><Building2 size={10} className="shrink-0"/>{player.club || 'باشگاه ثبت نشده'}</span><span className="text-white/15">•</span><span className="flex shrink-0 items-center gap-1"><Flag size={10}/>{player.nationality || 'ملیت ثبت نشده'}</span></div></div>
            </div>
          </section>

          <section className="player-modal-info mt-2 grid shrink-0 grid-cols-2 gap-1.5" aria-label="اطلاعات بازیکن">
            <PlayerInfoCard icon={<Shirt size={14}/>} label="پست اصلی" value={positionLabel(player.position)}/>
            <PlayerInfoCard icon={<BadgeDollarSign size={14}/>} label="ارزش بازیکن" value={formatMarketValue(player.marketValue)}/>
            <PlayerInfoCard icon={<CalendarClock size={14}/>} label="وضعیت قرارداد" value={player.contractStatus || 'ثبت نشده'}/>
            <PlayerInfoCard icon={<BriefcaseBusiness size={14}/>} label="حضور در ترکیب" value={`جایگاه ${slotRole}`}/>
          </section>
        </> : <section className="player-modal-empty shrink-0 rounded-[1.25rem] border border-white/[.07] bg-white/[.035] p-3 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-dashed border-emerald-300/25 bg-emerald-400/[.08] text-emerald-300"><Plus size={20}/></span><p className="mt-1.5 text-[7px] font-bold text-emerald-300">جایگاه {slotRole}</p><h2 className="mt-0.5 text-sm font-black">افزودن بازیکن</h2><p className="mt-1 text-[8px] text-slate-500">یکی از بازیکنان نیمکت را انتخاب کن.</p></section>}

        {showReplacements && <section className="player-modal-replacements mt-2 min-h-0 shrink-0"><div className="mb-1.5 flex items-center justify-between"><h3 className="text-[9px] font-black">بازیکنان قابل انتخاب</h3><span className="rounded-full bg-white/[.045] px-2 py-0.5 text-[7px] text-slate-500">{faNumber(substitutes.length)} ذخیره</span></div>
          {substitutes.length ? <div className="grid h-[96px] grid-flow-col grid-rows-2 auto-cols-[138px] gap-1.5 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none">{substitutes.map(substitute => <button type="button" key={substitute._id} disabled={loading} onClick={() => onReplace(substitute)} className="flex min-h-0 min-w-0 items-center gap-1.5 rounded-xl border border-white/[.06] bg-white/[.035] p-1.5 text-right transition active:scale-[.98] active:bg-emerald-400/[.08]"><PlayerAvatar player={substitute} className="h-8 w-8"/><span className="min-w-0 flex-1"><strong className="block truncate text-[7px]">{substitute.name}</strong><span className="mt-0.5 block truncate text-[6px] text-slate-500">{positionLabel(substitute.position)}</span></span></button>)}</div> : <div className="flex h-[82px] items-center justify-center rounded-xl border border-dashed border-white/[.07] bg-white/[.02] text-center"><div><p className="text-[7px] text-slate-500">بازیکن ذخیره‌ای وجود ندارد.</p><Link to="/club/transfer-market" className="mt-1.5 inline-flex min-h-7 items-center rounded-lg bg-white/[.05] px-3 text-[7px]">رفتن به بازار</Link></div></div>}
        </section>}

        {player && <section className="player-modal-actions mt-auto shrink-0 pt-2" aria-label="عملیات بازیکن">
          <div className="mb-1.5 flex items-center justify-between"><h3 className="text-[9px] font-black">مدیریت بازیکن</h3><span className="text-[6px] text-slate-500">عملیات در دسترس</span></div>
          <button type="button" disabled={!substitutes.length || loading} onClick={() => setShowReplacements(value => !value)} className="flex min-h-10 w-full items-center justify-between rounded-xl bg-gradient-to-l from-emerald-400 to-emerald-500 px-3 text-[9px] font-black text-ink-950 shadow-[0_8px_22px_rgba(16,185,129,.16)] transition active:scale-[.985] disabled:opacity-40"><span className="flex items-center gap-1.5"><ArrowLeftRight size={15}/>{showReplacements ? 'بستن فهرست تعویض' : 'تعویض بازیکن'}</span><ArrowLeft size={13}/></button>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button type="button" disabled={loading} onClick={onRemove} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[.07] bg-white/[.045] text-[8px] font-bold text-slate-200 transition active:scale-[.98]"><ListRestart size={13} className="text-sky-300"/>انتقال به نیمکت</button>
            <Link to={`/club/players?player=${player._id}`} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[.07] bg-white/[.045] text-[8px] font-bold text-slate-200 transition active:scale-[.98]"><Eye size={13} className="text-violet-300"/>مشاهده جزئیات</Link>
          </div>
          <button type="button" disabled={loading} onClick={() => { if (confirm(`«${player.name}» از ترکیب خارج شود؟`)) onDelete(); }} className="mt-1.5 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300/10 bg-rose-400/[.055] text-[8px] font-bold text-rose-300 transition active:scale-[.985]"><Trash2 size={13}/>حذف از ترکیب</button>
        </section>}
      </div>
    </div>
  </div>, document.body);
}

function PlayerInfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="player-modal-info-card flex min-h-[48px] items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.035] p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-400/[.08] text-emerald-300">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[6px] font-medium text-slate-500">{label}</span><strong className="mt-0.5 block truncate text-[7px] font-extrabold text-slate-100">{value}</strong></span></div>;
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

function playerAt(draft: LineupDraft, location: DragLocation): DisplayPlayer|null {
  return location.kind === 'pitch' ? draft.starters[location.index] ?? null : draft.substitutes[location.index] ?? null;
}

function swapPlayers(draft: LineupDraft, source: DragLocation, target: DragLocation): LineupDraft|null {
  const sourcePlayer = playerAt(draft, source);
  const targetPlayer = playerAt(draft, target);
  if (!sourcePlayer || !targetPlayer || sameDragLocation(source, target) || source.kind === 'bench' && target.kind === 'bench') return null;
  const starters = [...draft.starters];
  const substitutes = [...draft.substitutes];
  if (source.kind === 'pitch' && target.kind === 'pitch') {
    [starters[source.index], starters[target.index]] = [starters[target.index], starters[source.index]];
  } else if (source.kind === 'pitch' && target.kind === 'bench') {
    starters[source.index] = targetPlayer;
    substitutes[target.index] = sourcePlayer;
  } else if (source.kind === 'bench' && target.kind === 'pitch') {
    starters[target.index] = sourcePlayer;
    substitutes[source.index] = targetPlayer;
  }
  const players = [...starters.filter(Boolean), ...substitutes] as DisplayPlayer[];
  if (starters.length !== 11 || starters.some(player => !player) || new Set(players.map(player => player._id)).size !== players.length) return null;
  return { ...draft, starters, substitutes };
}

function sameDragLocation(first: DragLocation, second: DragLocation): boolean {
  return first.kind === second.kind && first.index === second.index;
}

function sameOptionalDragLocation(first: DragLocation|null, second: DragLocation|null): boolean {
  return first === null || second === null ? first === second : sameDragLocation(first, second);
}

function dropLocationAtPoint(clientX: number, clientY: number): DragLocation|null {
  const element = document.elementFromPoint(clientX, clientY);
  const pitchTarget = element?.closest<HTMLElement>('[data-pitch-index]');
  if (pitchTarget?.dataset.pitchIndex !== undefined) return { kind: 'pitch', index: Number(pitchTarget.dataset.pitchIndex) };
  const benchTarget = element?.closest<HTMLElement>('[data-bench-index]');
  if (benchTarget?.dataset.benchIndex !== undefined) return { kind: 'bench', index: Number(benchTarget.dataset.benchIndex) };
  return null;
}

function transitionName(player: DisplayPlayer): string {
  return `squad-player-${player._id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function applyDraftTransition(next: LineupDraft, setDraft: (draft: LineupDraft) => void): void {
  const update = () => flushSync(() => setDraft(next));
  const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => void };
  if (transitionDocument.startViewTransition) transitionDocument.startViewTransition(update);
  else update();
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

function lockModalPageScrolling(): () => void {
  const root = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const rootStyles = captureInlineStyles(root, ['overflow', 'overscrollBehavior']);
  const bodyStyles = captureInlineStyles(body, ['overflow', 'overscrollBehavior', 'position', 'top', 'left', 'right', 'width']);
  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  body.style.position = 'fixed';
  body.style.top = `${-scrollY}px`;
  body.style.left = `${-scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    restoreInlineStyles(root, rootStyles);
    restoreInlineStyles(body, bodyStyles);
    window.scrollTo(scrollX, scrollY);
  };
}

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
