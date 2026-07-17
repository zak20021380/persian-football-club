import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, BadgeDollarSign, BriefcaseBusiness, Building2, CalendarClock, CircleAlert, Eye, Flag, ListRestart, Plus, RotateCcw, Save, Shirt, Sparkles, Trash2, UserRound, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FormationPitch, FormationPitchEmptySlot, FormationPitchPlayer } from '@/components/FormationPitch';
import { PageHeader } from '@/components/PageHeader';
import { PlayerModalFrame } from '@/components/PlayerModalFrame';
import { Card, ErrorState, PageSkeleton } from '@/components/ui';
import { formations } from '@/lib/formations';
import { api } from '@/lib/api';
import { isDemoDataEnabled } from '@/lib/featureFlags';
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
  returning?: boolean;
  freePositioning?: boolean;
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
  activationTimer: number|null;
  freePositioning: boolean;
  originX: number;
  originY: number;
  grabOffsetX: number;
  grabOffsetY: number;
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
const TOUCH_DRAG_THRESHOLD = 9;
const TOUCH_SCROLL_THRESHOLD = 8;
const TOUCH_LONG_PRESS_MS = 180;
const MOUSE_DRAG_THRESHOLD = 4;
const RETURN_ANIMATION_MS = 180;
const MIN_SLOT_X_GAP = 18;
const MIN_SLOT_Y_GAP = 15;
const CUSTOM_MIN_X = 9;
const CUSTOM_MAX_X = 91;
const CUSTOM_MIN_Y = 8;
const CUSTOM_MAX_Y = 92;

function clearDragActivationTimer(gesture: DragGesture): void {
  if (gesture.activationTimer === null) return;
  window.clearTimeout(gesture.activationTimer);
  gesture.activationTimer = null;
}

function safelyCapturePointer(element: HTMLElement, pointerId: number): void {
  try {
    if (!element.hasPointerCapture(pointerId)) element.setPointerCapture(pointerId);
  } catch { /* The pointer may already have been interrupted by the WebView. */ }
}

function safelyReleasePointer(element: HTMLElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch { /* The pointer may already have been released by the browser. */ }
}

function lockPageScrollingDuringDrag(): () => void {
  const root = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const rootStyles = {
    overflow: root.style.overflow,
    overscrollBehavior: root.style.overscrollBehavior,
    touchAction: root.style.touchAction,
    userSelect: root.style.userSelect,
    webkitUserSelect: root.style.webkitUserSelect,
    scrollBehavior: root.style.scrollBehavior,
  };
  const bodyStyles = {
    overflow: body.style.overflow,
    overscrollBehavior: body.style.overscrollBehavior,
    touchAction: body.style.touchAction,
    userSelect: body.style.userSelect,
    webkitUserSelect: body.style.webkitUserSelect,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  };
  const preventBrowserGesture = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const listenerOptions: AddEventListenerOptions = { capture: true, passive: false };
  const hadDragClass = root.classList.contains('lineup-drag-active');

  document.addEventListener('pointermove', preventBrowserGesture, listenerOptions);
  document.addEventListener('touchmove', preventBrowserGesture, listenerOptions);
  document.addEventListener('gesturestart', preventBrowserGesture, listenerOptions);
  document.addEventListener('gesturechange', preventBrowserGesture, listenerOptions);
  document.addEventListener('selectstart', preventBrowserGesture, listenerOptions);
  document.addEventListener('dragstart', preventBrowserGesture, listenerOptions);
  document.addEventListener('contextmenu', preventBrowserGesture, listenerOptions);
  root.classList.add('lineup-drag-active');
  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
  root.style.touchAction = 'none';
  root.style.userSelect = 'none';
  root.style.webkitUserSelect = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  body.style.touchAction = 'none';
  body.style.userSelect = 'none';
  body.style.webkitUserSelect = 'none';
  body.style.position = 'fixed';
  body.style.top = `${-scrollY}px`;
  body.style.left = `${-scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';

  let released = false;
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener('pointermove', preventBrowserGesture, listenerOptions);
    document.removeEventListener('touchmove', preventBrowserGesture, listenerOptions);
    document.removeEventListener('gesturestart', preventBrowserGesture, listenerOptions);
    document.removeEventListener('gesturechange', preventBrowserGesture, listenerOptions);
    document.removeEventListener('selectstart', preventBrowserGesture, listenerOptions);
    document.removeEventListener('dragstart', preventBrowserGesture, listenerOptions);
    document.removeEventListener('contextmenu', preventBrowserGesture, listenerOptions);
    root.style.overflow = rootStyles.overflow;
    root.style.overscrollBehavior = rootStyles.overscrollBehavior;
    root.style.touchAction = rootStyles.touchAction;
    root.style.userSelect = rootStyles.userSelect;
    root.style.webkitUserSelect = rootStyles.webkitUserSelect;
    root.style.scrollBehavior = 'auto';
    Object.assign(body.style, bodyStyles);
    window.scrollTo(scrollX, scrollY);
    root.style.scrollBehavior = rootStyles.scrollBehavior;
    if (!hadDragClass) root.classList.remove('lineup-drag-active');
  };
}

export function SquadPage() {
  const queryClient = useQueryClient();
  const pitchRef = useRef<HTMLDivElement|null>(null);
  const draftRef = useRef<LineupDraft|null>(null);
  const dragRef = useRef<DragGesture|null>(null);
  const dragViewRef = useRef<DragState|null>(null);
  const dragFrameRef = useRef<number|null>(null);
  const dragReturnTimerRef = useRef<number|null>(null);
  const releaseScrollLockRef = useRef<(() => void)|null>(null);
  const savePendingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dirtyRef = useRef(false);
  const [draft, setDraft] = useState<LineupDraft|null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number|null>(null);
  const [selectedBenchPlayer, setSelectedBenchPlayer] = useState<DisplayPlayer|null>(null);
  const [drag, setDrag] = useState<DragState|null>(null);
  const squad = useQuery({ queryKey: ['clubSquad'], queryFn: async () => (await api.get<SquadData>('/club/squad')).data });
  const demoMode = Boolean(isDemoDataEnabled() && squad.data && squad.data.starters.every(player => !player) && squad.data.substitutes.length === 0);

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

  const releaseDragScrollLock = useCallback(() => {
    releaseScrollLockRef.current?.();
    releaseScrollLockRef.current = null;
  }, []);

  const returnDragPreview = useCallback((gesture: DragGesture) => {
    const sourceRect = gesture.element.getBoundingClientRect();
    const returning: DragState = {
      source: gesture.source,
      target: null,
      player: gesture.player,
      valid: false,
      clientX: sourceRect.left + sourceRect.width / 2,
      clientY: sourceRect.top + sourceRect.height / 2,
      returning: true,
    };
    dragViewRef.current = returning;
    setDrag(returning);
    if (dragReturnTimerRef.current !== null) window.clearTimeout(dragReturnTimerRef.current);
    dragReturnTimerRef.current = window.setTimeout(() => {
      if (dragViewRef.current === returning || dragViewRef.current?.returning) {
        dragViewRef.current = null;
        setDrag(null);
      }
      dragReturnTimerRef.current = null;
    }, RETURN_ANIMATION_MS);
  }, []);

  const returnCustomMarker = useCallback((gesture: DragGesture) => {
    const returning: DragState = {
      source: gesture.source,
      target: null,
      player: gesture.player,
      valid: false,
      clientX: gesture.clientX,
      clientY: gesture.clientY,
      returning: true,
      freePositioning: true,
    };
    dragViewRef.current = returning;
    flushSync(() => setDrag(returning));
    gesture.element.style.left = `${gesture.originX}%`;
    gesture.element.style.top = `${gesture.originY}%`;
    if (dragReturnTimerRef.current !== null) window.clearTimeout(dragReturnTimerRef.current);
    dragReturnTimerRef.current = window.setTimeout(() => {
      if (dragViewRef.current?.returning && dragViewRef.current.freePositioning) {
        dragViewRef.current = null;
        setDrag(null);
      }
      dragReturnTimerRef.current = null;
    }, RETURN_ANIMATION_MS);
  }, []);

  const renderDragFrame = useCallback(() => {
    dragFrameRef.current = null;
    const gesture = dragRef.current;
    const currentDraft = draftRef.current;
    const pitch = pitchRef.current;
    if (!gesture?.active || !currentDraft || !pitch) return;

    const rect = gesture.pitchRect ?? pitch.getBoundingClientRect();
    const markerCenterX = gesture.freePositioning ? gesture.clientX - gesture.grabOffsetX : gesture.clientX;
    const markerCenterY = gesture.freePositioning ? gesture.clientY - gesture.grabOffsetY : gesture.clientY;
    const rawX = ((markerCenterX - rect.left) / rect.width) * 100;
    const rawY = ((markerCenterY - rect.top) / rect.height) * 100;
    gesture.x = clamp(rawX, gesture.freePositioning ? CUSTOM_MIN_X : 7, gesture.freePositioning ? CUSTOM_MAX_X : 93);
    gesture.y = clamp(rawY, gesture.freePositioning ? CUSTOM_MIN_Y : 6, gesture.freePositioning ? CUSTOM_MAX_Y : 94);
    gesture.moved ||= Math.hypot(gesture.clientX - gesture.startX, gesture.clientY - gesture.startY) > 3;

    const insidePitch = gesture.clientX >= rect.left && gesture.clientX <= rect.right && gesture.clientY >= rect.top && gesture.clientY <= rect.bottom;
    let target = dropLocationAtPoint(gesture.clientX, gesture.clientY);
    if (gesture.freePositioning) {
      gesture.element.style.left = `${gesture.x}%`;
      gesture.element.style.top = `${gesture.y}%`;
      target = insidePitch ? null : target?.kind === 'bench' ? target : null;
    } else if (!target && insidePitch) {
      target = { kind: 'pitch', index: nearestPosition(currentDraft.positions, gesture.x, gesture.y, rect, -1).index };
    }
    gesture.target = target;

    if (gesture.freePositioning && insidePitch) {
      gesture.valid = true;
    } else if (target) {
      if (sameDragLocation(gesture.source, target)) gesture.valid = true;
      else {
        const candidate = swapPlayers(currentDraft, gesture.source, target);
        gesture.valid = Boolean(candidate && !validateDraft(candidate));
      }
    } else gesture.valid = false;

    const previous = dragViewRef.current;
    const previewMoved = !gesture.freePositioning && previous && (previous.clientX !== gesture.clientX || previous.clientY !== gesture.clientY);
    if (!previous || !sameOptionalDragLocation(previous.target, gesture.target) || previous.valid !== gesture.valid || previewMoved) {
      if (previous && (!sameOptionalDragLocation(previous.target, gesture.target) || previous.valid !== gesture.valid)) impact(gesture.valid ? 'light' : 'medium');
      const next = { source: gesture.source, target: gesture.target, player: gesture.player, valid: gesture.valid, clientX: gesture.clientX, clientY: gesture.clientY, freePositioning: gesture.freePositioning };
      dragViewRef.current = next;
      setDrag(next);
    }
  }, []);

  const activateDrag = useCallback((pointerId: number) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== pointerId || gesture.active) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    clearDragActivationTimer(gesture);
    gesture.pitchRect = pitch.getBoundingClientRect();
    gesture.active = true;
    if (!gesture.element.hasPointerCapture(pointerId)) safelyCapturePointer(gesture.element, pointerId);
    releaseScrollLockRef.current = lockPageScrollingDuringDrag();
    impact('light');
    const initialView = { source: gesture.source, target: gesture.freePositioning ? null : gesture.source, player: gesture.player, valid: true, clientX: gesture.clientX, clientY: gesture.clientY, freePositioning: gesture.freePositioning };
    dragViewRef.current = initialView;
    setDrag(initialView);
    if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(renderDragFrame);
  }, [renderDragFrame]);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, source: DragLocation) => {
    const currentDraft = draftRef.current;
    const player = currentDraft ? playerAt(currentDraft, source) : null;
    if (!currentDraft || !player || savePendingRef.current || event.button !== 0 || !event.isPrimary || dragRef.current) return;
    if (dragReturnTimerRef.current !== null) {
      window.clearTimeout(dragReturnTimerRef.current);
      dragReturnTimerRef.current = null;
      dragViewRef.current = null;
      setDrag(null);
    }
    const position = source.kind === 'pitch' ? currentDraft.positions[source.index] : null;
    const markerRect = event.currentTarget.getBoundingClientRect();
    const freePositioning = source.kind === 'pitch' && currentDraft.formation === 'custom';
    const gesture: DragGesture = {
      source, player, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY,
      clientX: event.clientX, clientY: event.clientY, x: position?.x ?? 50, y: position?.y ?? 50, target: source,
      valid: true, active: false, finishing: false, moved: false, element: event.currentTarget, pitchRect: null, activationTimer: null,
      freePositioning, originX: position?.x ?? 50, originY: position?.y ?? 50,
      grabOffsetX: freePositioning ? event.clientX - (markerRect.left + markerRect.width / 2) : 0,
      grabOffsetY: freePositioning ? event.clientY - (markerRect.top + markerRect.height / 2) : 0,
    };
    dragRef.current = gesture;
    safelyCapturePointer(gesture.element, gesture.pointerId);
    if (gesture.pointerType !== 'mouse') {
      gesture.activationTimer = window.setTimeout(() => activateDrag(gesture.pointerId), TOUCH_LONG_PRESS_MS);
    }
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
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const touchScroll = !gesture.freePositioning && gesture.pointerType !== 'mouse' && absY >= TOUCH_SCROLL_THRESHOLD && absY > absX * 1.15;
      if (touchScroll) {
        clearDragActivationTimer(gesture);
        dragRef.current = null;
        safelyReleasePointer(gesture.element, gesture.pointerId);
        return;
      }
      const deliberateTouchDrag = gesture.pointerType !== 'mouse' && distance >= TOUCH_DRAG_THRESHOLD && (gesture.freePositioning || absX >= absY * .9);
      if (mouseReady || deliberateTouchDrag) activateDrag(event.pointerId);
      if (!gesture.active) return;
    }

    // Native vertical scrolling stays untouched until a drag has deliberately started.
    if (event.cancelable) event.preventDefault();
    if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(renderDragFrame);
  }, [activateDrag, renderDragFrame]);

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.finishing || event.pointerId !== gesture.pointerId) return;
    gesture.finishing = true;
    clearDragActivationTimer(gesture);
    safelyReleasePointer(event.currentTarget, event.pointerId);
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
      renderDragFrame();
    }
    const wasActive = gesture.active;
    dragRef.current = null;
    releaseDragScrollLock();
    if (wasActive) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    if (!wasActive) {
      dragViewRef.current = null;
      setDrag(null);
      return;
    }
    if (cancelled || !gesture.moved) {
      if (gesture.moved) {
        if (gesture.freePositioning) returnCustomMarker(gesture);
        else returnDragPreview(gesture);
      }
      else {
        dragViewRef.current = null;
        setDrag(null);
      }
      return;
    }
    if (!gesture.valid) {
      if (gesture.freePositioning) returnCustomMarker(gesture);
      else returnDragPreview(gesture);
      notify('warning');
      return void toast.error('این جابه‌جایی قوانین ترکیب را نقض می‌کند.');
    }
    const currentDraft = draftRef.current;
    if (!currentDraft) {
      if (gesture.freePositioning) returnCustomMarker(gesture);
      else returnDragPreview(gesture);
      return;
    }
    if (gesture.target) {
      if (sameDragLocation(gesture.source, gesture.target)) {
        if (gesture.freePositioning) return void returnCustomMarker(gesture);
        return void returnDragPreview(gesture);
      }
      const next = swapPlayers(currentDraft, gesture.source, gesture.target);
      if (next && !validateDraft(next)) {
        dragViewRef.current = null;
        setDrag(null);
        commitDragDraft(next);
      } else if (gesture.freePositioning) returnCustomMarker(gesture);
      else returnDragPreview(gesture);
    } else if (gesture.freePositioning && currentDraft.formation === 'custom') {
      const positions = clonePositions(currentDraft.positions);
      positions[gesture.source.index] = { ...positions[gesture.source.index], x: roundCoordinate(gesture.x), y: roundCoordinate(gesture.y) };
      const next = { ...currentDraft, positions };
      if (!validateDraft(next)) {
        dragViewRef.current = null;
        setDrag(null);
        commitDragDraft(next);
      } else returnCustomMarker(gesture);
    } else {
      if (gesture.freePositioning) returnCustomMarker(gesture);
      else returnDragPreview(gesture);
    }
  }, [commitDragDraft, releaseDragScrollLock, renderDragFrame, returnCustomMarker, returnDragPreview]);

  const cancelDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => finishDrag(event, true), [finishDrag]);

  const cancelInterruptedDrag = useCallback(() => {
    const gesture = dragRef.current;
    if (!gesture) return;
    if (gesture.finishing) return;
    gesture.finishing = true;
    clearDragActivationTimer(gesture);
    safelyReleasePointer(gesture.element, gesture.pointerId);
    releaseDragScrollLock();
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    if (gesture.freePositioning) {
      gesture.element.style.left = `${gesture.originX}%`;
      gesture.element.style.top = `${gesture.originY}%`;
    }
    dragRef.current = null;
    dragViewRef.current = null;
    setDrag(null);
  }, [releaseDragScrollLock]);

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
    document.addEventListener('touchcancel', cancelInterruptedDrag, { capture: true, passive: true });
    return () => {
      window.removeEventListener('blur', cancelInterruptedDrag);
      window.removeEventListener('pagehide', cancelInterruptedDrag);
      document.removeEventListener('visibilitychange', cancelWhenHidden);
      document.removeEventListener('touchcancel', cancelInterruptedDrag, true);
      const gesture = dragRef.current;
      if (gesture) {
        clearDragActivationTimer(gesture);
        safelyReleasePointer(gesture.element, gesture.pointerId);
        if (gesture.freePositioning) {
          gesture.element.style.left = `${gesture.originX}%`;
          gesture.element.style.top = `${gesture.originY}%`;
        }
      }
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
      if (dragReturnTimerRef.current !== null) window.clearTimeout(dragReturnTimerRef.current);
      releaseDragScrollLock();
      dragRef.current = null;
      dragViewRef.current = null;
    };
  }, [cancelInterruptedDrag, releaseDragScrollLock]);

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

  if (squad.isLoading || !draft) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back backTo="/club" tone="mint" eyebrow="TACTICAL BOARD / XI"/><PageSkeleton/></>;
  if (squad.error || !squad.data) return <><PageHeader title="ترکیب من" subtitle="مدیریت ترکیب اصلی" back backTo="/club" tone="mint" eyebrow="TACTICAL BOARD / XI"/><main className="p-4"><ErrorState message={(squad.error as Error)?.message || 'ترکیب دریافت نشد'} onRetry={() => squad.refetch()}/></main></>;

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

  return <div className="squad-page min-h-[100dvh] overflow-x-clip pb-[max(2rem,var(--safe-bottom))]">
    <PageHeader title="ترکیب من" subtitle={`${faNumber(draft.starters.filter(Boolean).length)} بازیکن در ترکیب`} back backTo="/club" tone="mint" eyebrow="TACTICAL BOARD / XI"/>
    <main className="mx-auto max-w-xl px-3 pt-3 sm:px-4">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[.06] bg-white/[.025] p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dirty ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.5)]' : 'bg-emerald-400')}/>
          <div className="min-w-0"><strong className="block text-[9px]">{demoMode ? 'حالت نمایشی' : dirty ? 'تغییرات ذخیره‌نشده' : 'همه تغییرات ذخیره شده'}</strong><span className="block truncate text-[7px] text-slate-500">{drag && !drag.returning ? drag.freePositioning && drag.valid ? 'رها کن تا جایگاه ثبت شود' : drag.valid ? 'رها کن تا جابه‌جا شود' : 'محل رهاکردن نامعتبر است' : 'بازیکن را بگیر و روی جایگاه مقصد رها کن'}</span></div>
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

      <FormationPitch ref={pitchRef} className={cn('lineup-pitch mx-auto w-full select-none', draft.formation === 'custom' && 'is-custom-formation', drag && !drag.returning && 'is-dragging', drag && !drag.returning ? drag.valid ? 'border-emerald-200/50' : 'border-rose-300/70' : 'border-emerald-100/[.18]')} aria-label="زمین چیدمان بازیکنان">
        {draft.positions.map((position, index) => <PitchSlot
          key={`${index}-${draft.starters[index]?._id ?? 'empty'}`}
          position={position}
          player={draft.starters[index]}
          index={index}
          selected={selectedSlot === index}
          dragging={drag?.source.kind === 'pitch' && drag.source.index === index}
          freeDragging={Boolean(drag?.freePositioning && !drag.returning && drag.source.kind === 'pitch' && drag.source.index === index)}
          returning={Boolean(drag?.freePositioning && drag.returning && drag.source.kind === 'pitch' && drag.source.index === index)}
          dropTarget={drag?.target?.kind === 'pitch' && drag.target.index === index && !sameDragLocation(drag.source, drag.target)}
          dropValid={drag?.valid ?? true}
          onPointerDown={(event, slotIndex) => beginDrag(event, { kind: 'pitch', index: slotIndex })}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onClick={openSlot}
        />)}
        {drag && !drag.returning && <div className={cn('pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border px-2.5 py-1 text-[7px] font-black', drag.valid ? 'border-emerald-200/30 bg-emerald-950/95 text-emerald-100' : 'border-rose-200/30 bg-rose-950/95 text-rose-100')}>{drag.freePositioning && drag.valid ? 'رها کن تا جایگاه آزاد بازیکن ثبت شود' : drag.valid ? drag.target && !sameDragLocation(drag.source, drag.target) ? 'رها کن تا بازیکن‌ها جابه‌جا شوند' : 'بازیکن را روی مقصد رها کن' : 'این مقصد با قوانین ترکیب سازگار نیست'}</div>}
      </FormationPitch>

      {validationMessage && !demoMode && <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-2.5 text-[8px] leading-5 text-amber-100/80"><CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-300"/><span>{validationMessage}</span></div>}

      <section className="bench-section mt-4" aria-labelledby="bench-title">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bench-heading-icon grid h-8 w-8 shrink-0 place-items-center rounded-xl"><UsersRound size={15}/></span>
            <div className="min-w-0"><h2 id="bench-title" className="text-[11px] font-black text-slate-100">بازیکنان ذخیره</h2><p className="mt-0.5 truncate text-[6.5px] font-medium text-slate-500">نیمکت منتخب برای تعویض سریع</p></div>
          </div>
          <span className="bench-count shrink-0 rounded-full px-2 py-1 text-[6.5px] font-black">{faNumber(Math.min(draft.substitutes.length, 4))} بازیکن</span>
        </div>
        {draft.substitutes.length ? (
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {draft.substitutes.slice(0, 4).map((player, index) => (
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
        ) : <Card className="flex min-h-20 items-center gap-3 border-dashed p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[.04] text-slate-500"><UserRound size={18}/></span><div className="min-w-0 flex-1"><h3 className="text-[10px] font-black">نیمکت خالی است</h3><p className="mt-1 text-[8px] text-slate-500">از بازار بازیکن جدید به باشگاه اضافه کن.</p></div><Link to="/club/transfer-market" className="flex min-h-9 shrink-0 items-center rounded-xl bg-white/[.05] px-2.5 text-[8px] font-bold text-slate-300">بازار</Link></Card>}
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
    {drag && !drag.freePositioning && createPortal(<FloatingDragPlayer drag={drag}/>, document.body)}
  </div>;
}

const PitchSlot = memo(function PitchSlot({ position, player, index, selected, dragging, freeDragging, returning, dropTarget, dropValid, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClick }: {
  position: SquadPosition; player: DisplayPlayer|null; index: number; selected: boolean; dragging: boolean; freeDragging: boolean; returning: boolean; dropTarget: boolean; dropValid: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, index: number) => void; onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void; onClick: (index: number) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const interactionProps = {
    'data-pitch-index': index,
    draggable: false,
    onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => event.preventDefault(),
    onClick: () => onClick(index),
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => onPointerDown(event, index),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    'aria-label': player ? `${player.name}، ${player.position}` : `افزودن بازیکن به پست ${position.role}`,
  };
  const markerStyle = { zIndex: dragging ? 40 : dropTarget ? 30 : 10, animationDelay: `${index * 22}ms`, viewTransitionName: player ? transitionName(player) : undefined };
  const markerClassName = cn('lineup-player is-draggable-player transition-[opacity,filter] duration-200', dragging && 'is-dragging cursor-grabbing', dragging && !freeDragging && !returning && 'opacity-25 grayscale', freeDragging && 'is-free-dragging', returning && 'is-custom-returning', selected && !dragging && 'is-selected');
  const overlay = dropTarget ? <span className={cn('pointer-events-none absolute -inset-2 -z-10 rounded-[1.35rem] border-2 border-dashed', dropValid ? 'border-emerald-200 bg-emerald-300/15' : 'border-rose-200 bg-rose-300/15')}/> : undefined;

  return player ? <FormationPitchPlayer
    {...interactionProps}
    position={position}
    name={player.name}
    primaryMeta={position.role}
    secondaryMeta={faNumber(player.overall)}
    overlay={overlay}
    style={markerStyle}
    className={markerClassName}
  /> : <FormationPitchEmptySlot
    {...interactionProps}
    position={position}
    style={markerStyle}
    className={cn('lineup-player', selected && 'is-selected border-amber-300 text-amber-300', dropTarget && (dropValid ? 'border-emerald-100 bg-emerald-950/70 text-emerald-100' : 'border-rose-200 bg-rose-950/70 text-rose-100'))}
  />;
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
  return <button type="button" data-bench-index={index} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture} onClick={onClick} aria-label={`${player.name}، ${player.position}، امتیاز ${faNumber(player.overall)}`} title={player.name} style={{ viewTransitionName: transitionName(player) }} className={cn('bench-player relative flex min-h-[76px] min-w-0 w-full flex-col items-center justify-center overflow-hidden rounded-xl border px-1.5 py-2 text-center transition-[transform,border-color,background-color,box-shadow,opacity,filter] duration-200 active:scale-[.97]', dragging ? 'is-dragging border-white/[.04] opacity-25 grayscale' : dropTarget ? dropValid ? 'is-drop-valid border-emerald-300/70 ring-2 ring-emerald-300/20' : 'is-drop-invalid border-rose-300/70 ring-2 ring-rose-300/20' : 'border-white/[.07]')}>
    <span className="bench-player-icon grid h-8 w-8 shrink-0 place-items-center rounded-full"><UserRound size={14} strokeWidth={1.8}/></span>
    <strong className="mt-1.5 block w-full truncate text-[7.5px] font-black leading-3 text-slate-50 sm:text-[8px]">{shortName(player.name)}</strong>
    <span className="mt-0.5 block rounded-full px-1.5 py-0.5 text-[5.5px] font-extrabold leading-none text-cyan-200/80">{player.position}</span>
  </button>;
});

function FloatingDragPlayer({ drag }: { drag: DragState }) {
  return <div data-floating-drag-player dir="rtl" aria-hidden="true" style={{ left: drag.clientX, top: drag.clientY }} className={cn('lineup-drag-preview pointer-events-none fixed z-[140] flex w-[92px] items-center gap-2 rounded-2xl border bg-ink-900/95 p-2 shadow-[0_14px_34px_rgba(0,0,0,.45)] backdrop-blur-md transition-colors', drag.returning ? 'is-returning border-white/20' : drag.valid ? 'border-emerald-300/70 shadow-emerald-950/40' : 'border-rose-300/75 shadow-rose-950/40')}>
    <PlayerAvatar player={drag.player} className="h-9 w-9"/>
    <span className="min-w-0 flex-1"><strong className="block truncate text-[8px] font-black text-white">{shortName(drag.player.name)}</strong><span className={cn('mt-1 block text-[6px] font-bold', drag.returning ? 'text-slate-300' : drag.valid ? 'text-emerald-300' : 'text-rose-300')}>{drag.returning ? 'بازگشت به جایگاه' : drag.valid ? 'مقصد معتبر' : 'مقصد نامعتبر'}</span></span>
  </div>;
}

function PlayerSheet({ slotRole, player, substitutes, loading, onClose, onRemove, onDelete, onReplace }: { slotRole: string; player: DisplayPlayer|null; substitutes: DisplayPlayer[]; loading: boolean; onClose: () => void; onRemove: () => void; onDelete: () => void; onReplace: (player: DisplayPlayer) => void }) {
  const [showReplacements, setShowReplacements] = useState(!player);
  const replacementUnavailableReason = loading ? 'در حال انجام عملیات؛ چند لحظه صبر کنید.' : !substitutes.length ? 'بازیکن ذخیره‌ای برای تعویض وجود ندارد.' : null;
  return <PlayerModalFrame label={player ? `پنل ${player.name}` : `افزودن بازیکن به ${slotRole}`} onClose={onClose} swipeDisabled={loading} className="lineup-player-modal h-auto max-h-[82dvh]">
      <div className="player-modal-content momentum-scroll mx-auto min-h-0 w-full max-w-xl overflow-y-auto px-3 pb-[max(12px,var(--safe-bottom))]">
        {player ? <>
          <section className="lineup-player-modal-header shrink-0 rounded-[1.2rem] p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="lineup-player-modal-badge is-active"><Shirt size={10}/>ترکیب اصلی</span>
                  <span className="lineup-player-modal-badge">{positionLabel(player.position)}</span>
                  <span className="lineup-player-modal-badge max-w-full truncate"><CalendarClock size={10}/>{player.contractStatus || 'قرارداد ثبت نشده'}</span>
                </div>
                <h2 className="mt-2 truncate text-[17px] font-black leading-tight tracking-[-.02em] text-white">{player.name}</h2>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[7px] font-medium text-slate-400">
                  <span className="flex min-w-0 items-center gap-1 truncate"><Building2 size={11} className="shrink-0 text-slate-500"/>{player.club || 'باشگاه ثبت نشده'}</span>
                  <span className="flex items-center gap-1"><Flag size={11} className="text-slate-500"/>{player.nationality || 'ملیت ثبت نشده'}</span>
                </div>
              </div>
              <div className="lineup-player-modal-rating shrink-0" aria-label={`امتیاز ${faNumber(player.overall)}`}><span>امتیاز</span><strong>{faNumber(player.overall)}</strong></div>
            </div>
          </section>

          <section className="player-modal-info mt-2 grid shrink-0 grid-cols-2 gap-1.5" aria-label="اطلاعات بازیکن">
            <PlayerInfoCard icon={<Shirt size={14}/>} label="پست اصلی" value={positionLabel(player.position)}/>
            <PlayerInfoCard icon={<BadgeDollarSign size={14}/>} label="ارزش بازیکن" value={formatMarketValue(player.marketValue)}/>
            <PlayerInfoCard icon={<CalendarClock size={14}/>} label="وضعیت قرارداد" value={player.contractStatus || 'ثبت نشده'}/>
            <PlayerInfoCard icon={<BriefcaseBusiness size={14}/>} label="حضور در ترکیب" value={`جایگاه ${slotRole}`}/>
          </section>
        </> : <section className="player-modal-empty shrink-0 rounded-[1.25rem] border border-white/[.07] bg-white/[.035] p-3 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-dashed border-emerald-300/25 bg-emerald-400/[.08] text-emerald-300"><Plus size={20}/></span><p className="mt-1.5 text-[7px] font-bold text-emerald-300">جایگاه {slotRole}</p><h2 className="mt-0.5 text-sm font-black">افزودن بازیکن</h2><p className="mt-1 text-[8px] text-slate-500">یکی از بازیکنان نیمکت را انتخاب کن.</p></section>}

        {player && <section className="player-modal-actions pt-2" aria-label="عملیات بازیکن" aria-busy={loading}>
          <div className="mb-1.5 flex items-center justify-between"><h3 className="text-[9px] font-black text-slate-100">مدیریت بازیکن</h3><span className="text-[6px] font-medium text-slate-500">عملیات در دسترس</span></div>
          <button type="button" disabled={!substitutes.length || loading} aria-expanded={showReplacements} aria-controls="player-replacement-list" onClick={() => setShowReplacements(value => !value)} className={cn('lineup-player-modal-primary flex min-h-11 w-full items-center justify-between rounded-xl px-3.5 text-[9px] font-black transition active:scale-[.985]', showReplacements && 'is-open')}><span className="flex items-center gap-2">{loading ? <RotateCcw size={15} className="animate-spin"/> : <ArrowLeftRight size={15}/>}<span>{loading ? 'در حال پردازش' : showReplacements ? 'بستن فهرست تعویض' : 'تعویض بازیکن'}</span></span><ArrowLeft size={13} className={cn('transition-transform', showReplacements && '-rotate-90')}/></button>
          {replacementUnavailableReason && <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[7px] font-medium text-slate-500"><CircleAlert size={11} className="shrink-0 text-amber-300/70"/>{replacementUnavailableReason}</p>}
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button type="button" disabled={loading} onClick={onRemove} className="lineup-player-modal-secondary flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-[8px] font-bold transition active:scale-[.98]"><ListRestart size={13} className="text-sky-300"/>انتقال به نیمکت</button>
            <Link to={`/club/players?player=${player._id}`} className="lineup-player-modal-secondary flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-[8px] font-bold transition active:scale-[.98]"><Eye size={13} className="text-violet-300"/>مشاهده جزئیات</Link>
          </div>
          <button type="button" disabled={loading} onClick={() => { if (confirm(`«${player.name}» از ترکیب خارج شود؟`)) onDelete(); }} className="lineup-player-modal-danger mt-1.5 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[8px] font-bold transition active:scale-[.985]"><Trash2 size={13}/>حذف از ترکیب</button>
        </section>}

        {showReplacements && <section id="player-replacement-list" className="player-modal-replacements mt-2"><div className="mb-1.5 flex items-center justify-between"><h3 className="text-[9px] font-black text-slate-100">بازیکنان قابل انتخاب</h3><span className="lineup-player-modal-count">{faNumber(substitutes.length)} ذخیره</span></div>
          {substitutes.length ? <div className="grid h-[96px] grid-flow-col grid-rows-2 auto-cols-[145px] gap-1.5 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none">{substitutes.map(substitute => <button type="button" key={substitute._id} disabled={loading} onClick={() => onReplace(substitute)} className="lineup-player-modal-replacement flex min-h-0 min-w-0 items-center gap-2 rounded-xl p-1.5 text-right transition active:scale-[.98]"><span className="lineup-player-modal-replacement-icon grid h-8 w-8 shrink-0 place-items-center rounded-full"><UserRound size={14}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-[7px] font-extrabold text-slate-100">{substitute.name}</strong><span className="mt-0.5 flex items-center gap-1 truncate text-[6px] text-slate-500"><span>{positionLabel(substitute.position)}</span><span className="text-white/15">•</span><span>امتیاز {faNumber(substitute.overall)}</span></span></span></button>)}</div> : <div className="flex h-[82px] items-center justify-center rounded-xl border border-dashed border-white/[.07] bg-white/[.02] text-center"><div><p className="text-[7px] text-slate-500">بازیکن ذخیره‌ای وجود ندارد.</p><Link to="/club/transfer-market" className="mt-1.5 inline-flex min-h-7 items-center rounded-lg bg-white/[.05] px-3 text-[7px]">رفتن به بازار</Link></div></div>}
        </section>}
      </div>
  </PlayerModalFrame>;
}

function PlayerInfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="lineup-player-modal-stat flex min-h-[50px] items-center gap-2 rounded-xl p-2"><span className="lineup-player-modal-stat-icon grid h-7 w-7 shrink-0 place-items-center rounded-lg">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[6px] font-medium text-slate-500">{label}</span><strong className="mt-0.5 block truncate text-[7.5px] font-extrabold text-slate-100">{value}</strong></span></div>;
}

function draftFromData(data: SquadData): LineupDraft {
  const positions = data.formation === 'custom' && data.customPositions.length === 11
    ? normalizeCustomPositions(data.customPositions)
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
    const positions = stored.formation === 'custom' ? normalizeCustomPositions(stored.positions) : separateOverlappingPositions(stored.positions);
    return { formation: stored.formation!, starters, substitutes: pool.filter(player => !selected.has(player._id)), positions };
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
  if (draft.formation !== 'custom') {
    for (let first = 0; first < draft.positions.length; first += 1) for (let second = first + 1; second < draft.positions.length; second += 1) {
      if (slotsOverlap(draft.positions[first], draft.positions[second])) return 'بازیکن‌ها بیش از حد به هم نزدیک‌اند؛ جایگاه‌ها را کمی دورتر کن.';
    }
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

function normalizeCustomPositions(positions: SquadPosition[]): SquadPosition[] {
  return positions.map(position => ({
    ...position,
    x: clamp(position.x, CUSTOM_MIN_X, CUSTOM_MAX_X),
    y: clamp(position.y, CUSTOM_MIN_Y, CUSTOM_MAX_Y),
  }));
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
