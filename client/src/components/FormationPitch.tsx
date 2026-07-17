import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import type { FormationSlot } from '@/lib/formations';
import { cn } from '@/lib/utils';

interface FormationPitchProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const FormationPitch = forwardRef<HTMLDivElement, FormationPitchProps>(function FormationPitch({ children, className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('public-fantasy-pitch relative overflow-hidden rounded-[1.35rem] border border-emerald-100/[.18]', className)} dir="ltr" {...props}>
      <div className="public-pitch-atmosphere absolute inset-0"/>
      <PitchMarkings/>
      {children}
    </div>
  );
});

function PitchMarkings() {
  return <div className="pointer-events-none absolute inset-2.5 rounded-[1rem] border border-white/[.23]"><span className="absolute inset-x-0 top-1/2 border-t border-white/[.2]"/><span className="absolute left-1/2 top-1/2 h-[20%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[.2]"/><span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35"/><span className="absolute left-1/2 top-0 h-[17%] w-[48%] -translate-x-1/2 border border-t-0 border-white/[.2]"/><span className="absolute bottom-0 left-1/2 h-[17%] w-[48%] -translate-x-1/2 border border-b-0 border-white/[.2]"/><span className="absolute left-1/2 top-0 h-[7%] w-[22%] -translate-x-1/2 border border-t-0 border-white/[.18]"/><span className="absolute bottom-0 left-1/2 h-[7%] w-[22%] -translate-x-1/2 border border-b-0 border-white/[.18]"/></div>;
}

interface MarkerBadge {
  content: ReactNode;
  className: string;
  title?: string;
}

interface FormationPitchPlayerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  position: FormationSlot;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  avatar?: ReactNode;
  primaryMeta: ReactNode;
  secondaryMeta?: ReactNode;
  rightBadge?: MarkerBadge;
  leftBadge?: MarkerBadge;
  overlay?: ReactNode;
}

export const FormationPitchPlayer = forwardRef<HTMLButtonElement, FormationPitchPlayerProps>(function FormationPitchPlayer({
  position,
  name,
  displayName,
  avatarUrl,
  avatar,
  primaryMeta,
  secondaryMeta,
  rightBadge,
  leftBadge,
  overlay,
  className,
  style,
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      style={{ ...style, left: `${position.x}%`, top: `${position.y}%` }}
      className={cn('public-pitch-player absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center', className)}
      {...props}
    >
      {overlay}
      <span className="relative grid h-8 w-8 place-items-center overflow-visible rounded-full border border-white/25 bg-[#101a38] shadow-[0_7px_14px_rgba(0,0,0,.38)] min-[375px]:h-9 min-[375px]:w-9 min-[430px]:h-10 min-[430px]:w-10">
        {avatar ?? (avatarUrl ? <img src={avatarUrl} alt="" draggable={false} className="h-full w-full rounded-full object-cover"/> : <UserRound size={15} className="text-cyan-100"/>)}
        {rightBadge && <i className={cn('absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-black/25 text-[6px] font-black not-italic shadow-md', rightBadge.className)} title={rightBadge.title}>{rightBadge.content}</i>}
        {leftBadge && <i className={cn('absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-black/20 not-italic', leftBadge.className)} title={leftBadge.title}>{leftBadge.content}</i>}
      </span>
      <strong className="mt-0.5 block w-full truncate rounded-md bg-[#061324]/90 px-1 py-0.5 text-[5.5px] font-black leading-3 text-white min-[375px]:text-[6px] min-[430px]:text-[6.5px]">{displayName ?? shortLineupPlayerName(name)}</strong>
      <span className="mt-px flex items-center gap-0.5 rounded-full bg-black/45 px-1 py-0.5 text-[5px] font-bold text-cyan-50"><b className="text-cyan-300">{primaryMeta}</b>{secondaryMeta !== undefined && <><i className="not-italic text-white/25">·</i>{secondaryMeta}</>}</span>
    </button>
  );
});

interface FormationPitchEmptySlotProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  position: FormationSlot;
}

export const FormationPitchEmptySlot = forwardRef<HTMLButtonElement, FormationPitchEmptySlotProps>(function FormationPitchEmptySlot({ position, className, style, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} style={{ ...style, left: `${position.x}%`, top: `${position.y}%` }} className={cn('public-empty-slot absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-dashed border-white/25 text-[5px] text-white/35', className)} {...props}>{position.role}</button>;
});

function shortLineupPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
