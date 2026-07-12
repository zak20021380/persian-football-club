import { cn } from '@/lib/utils';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <div className={cn('brand-mark', className)} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" role="img">
        <path d="M24 4.5 39 10v11.7c0 9.4-6.1 17.4-15 21.8-8.9-4.4-15-12.4-15-21.8V10l15-5.5Z" fill="currentColor" opacity=".16"/>
        <path d="M24 7.5 36 12v9.5c0 7.6-4.7 14.3-12 18.2-7.3-3.9-12-10.6-12-18.2V12l12-4.5Z" stroke="currentColor" strokeWidth="2"/>
        <circle cx="24" cy="22" r="7.2" fill="currentColor"/>
        <path d="m24 17.7 3.6 2.6-1.4 4.2h-4.4l-1.4-4.2 3.6-2.6Z" fill="#07111f"/>
        <path d="M19.6 15.7 16 13.8M28.4 15.7l3.6-1.9M17.3 24.5l-3.7 2.2M30.7 24.5l3.7 2.2M24 29.2v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
