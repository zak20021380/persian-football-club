import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlayerModalFrame({ label, onClose, children, className, swipeDisabled = false }: { label: string; onClose: () => void; children: ReactNode; className?: string; swipeDisabled?: boolean }) {
  const panelRef = useRef<HTMLDivElement|null>(null);
  const swipeFrameRef = useRef<number|null>(null);
  const swipeRef = useRef<{ pointerId: number; startY: number; clientY: number; startedAt: number }|null>(null);

  useEffect(() => {
    const unlockPage = lockPageScrolling();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      unlockPage();
      window.removeEventListener('keydown', closeOnEscape);
      if (swipeFrameRef.current !== null) window.cancelAnimationFrame(swipeFrameRef.current);
    };
  }, [onClose]);

  const renderSwipe = () => {
    swipeFrameRef.current = null;
    const gesture = swipeRef.current;
    if (!gesture || !panelRef.current) return;
    panelRef.current.style.transform = `translate3d(0, ${Math.max(0, gesture.clientY - gesture.startY)}px, 0)`;
  };

  const startSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeDisabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    swipeRef.current = { pointerId: event.pointerId, startY: event.clientY, clientY: event.clientY, startedAt: Date.now() };
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    gesture.clientY = event.clientY;
    if (swipeFrameRef.current === null) swipeFrameRef.current = window.requestAnimationFrame(renderSwipe);
  };

  const endSwipe = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const distance = Math.max(0, event.clientY - gesture.startY);
    const velocity = distance / Math.max(1, Date.now() - gesture.startedAt);
    swipeRef.current = null;
    if (!cancelled && (distance > 82 || velocity > .55)) onClose();
    else if (panelRef.current) {
      panelRef.current.style.transition = 'transform 300ms cubic-bezier(.22,1,.36,1)';
      panelRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  return createPortal(
    <div onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }} className="player-modal-backdrop fixed inset-0 z-[100] flex items-end overflow-hidden bg-black/80" role="dialog" aria-modal="true" aria-label={label}>
      <div ref={panelRef} className={cn('player-modal-panel relative flex max-h-[min(90dvh,calc(100dvh-8px))] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-emerald-200/[.12] bg-[linear-gradient(180deg,#0d1c2f_0%,#071321_100%)] shadow-[0_-14px_36px_rgba(0,0,0,.42)]', className)}>
        <header className="player-modal-top relative flex h-12 shrink-0 items-center justify-center pt-[max(env(safe-area-inset-top,0px),0px)]">
          <div
            onPointerDown={startSwipe}
            onPointerMove={moveSwipe}
            onPointerUp={event => endSwipe(event)}
            onPointerCancel={event => endSwipe(event, true)}
            className="player-modal-drag relative z-10 flex h-full w-full cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1 w-12 rounded-full bg-gradient-to-r from-white/10 via-white/35 to-white/10"/>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={event => event.stopPropagation()}
            aria-label="بستن پنل"
            className="pointer-events-auto absolute left-1.5 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 select-none place-items-center rounded-full transition active:scale-90"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[.05] text-slate-300/90 transition active:bg-white/[.1]">
              <X size={15} strokeWidth={2}/>
            </span>
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function lockPageScrolling(): () => void {
  const root = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const rootOverflow = root.style.overflow;
  const rootOverscroll = root.style.overscrollBehavior;
  const bodyStyles = { overflow: body.style.overflow, overscrollBehavior: body.style.overscrollBehavior, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width };
  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  body.style.position = 'fixed';
  body.style.top = `${-scrollY}px`;
  body.style.left = `${-scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';
  return () => {
    root.style.overflow = rootOverflow;
    root.style.overscrollBehavior = rootOverscroll;
    Object.assign(body.style, bodyStyles);
    window.scrollTo(scrollX, scrollY);
  };
}
