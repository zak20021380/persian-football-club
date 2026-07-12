import type { PropsWithChildren, ReactNode } from 'react';
import { AlertCircle, ChevronLeft, LoaderCircle, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) { return <section className={cn('surface p-4', className)}>{children}</section>; }
export function SectionTitle({ title, action, to }: { title: string; action?: string; to?: string }) { return <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-extrabold tracking-tight">{title}</h2>{action && to && <Link to={to} className="inline-flex min-h-9 items-center gap-1 text-xs font-bold text-pitch-400">{action}<ChevronLeft size={16}/></Link>}</div>; }
export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) { return <div className="surface-soft min-w-0 p-3"><div className="mb-2 flex items-center gap-2 text-slate-400">{icon}<span className="truncate text-[11px] font-semibold">{label}</span></div><div className="truncate text-lg font-extrabold">{value}</div></div>; }
export function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('animate-pulse rounded-2xl bg-white/[.07]', className)} />; }
export function PageSkeleton() { return <div className="space-y-4 p-4"><Skeleton className="h-28"/><div className="grid grid-cols-2 gap-3"><Skeleton className="h-24"/><Skeleton className="h-24"/></div><Skeleton className="h-44"/><Skeleton className="h-32"/></div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <Card className="flex min-h-44 flex-col items-center justify-center text-center"><div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-pitch-500/10 text-pitch-400"><Trophy size={24}/></div><h3 className="font-extrabold">{title}</h3><p className="mt-1 max-w-xs text-xs leading-6 text-slate-400">{description}</p>{action && <div className="mt-4">{action}</div>}</Card>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <Card className="flex min-h-44 flex-col items-center justify-center text-center"><AlertCircle className="mb-3 text-rose-400"/><h3 className="font-bold">مشکلی پیش آمد</h3><p className="mt-2 text-xs text-slate-400">{message}</p>{onRetry && <button onClick={onRetry} className="btn-secondary mt-4">تلاش دوباره</button>}</Card>; }
export function LoadingButton({ loading, children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) { return <button {...props} disabled={loading || props.disabled} className={cn('btn-primary', className)}>{loading && <LoaderCircle size={18} className="animate-spin"/>}{children}</button>; }
export function StatusPill({ status }: { status: string }) {
  const labels: Record<string,string> = { scheduled: 'زمان‌بندی‌شده', live: 'زنده', finished: 'تمام‌شده', cancelled: 'لغوشده', active: 'فعال', draft: 'پیش‌نویس' };
  return <span className={cn('chip', status === 'live' || status === 'active' ? 'border-pitch-400/30 bg-pitch-500/10 text-pitch-300' : status === 'cancelled' ? 'border-rose-400/20 bg-rose-500/10 text-rose-300' : '')}>{labels[status] ?? status}</span>;
}
