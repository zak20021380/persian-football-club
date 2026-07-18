import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Club currency: a minted gold coin embossed with a football. */
export function CoinIcon({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}r`} x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF3C2"/>
          <stop offset="1" stopColor="#C8871F"/>
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(8.6 7.6) rotate(58) scale(15)">
          <stop stopColor="#FFEDAE"/>
          <stop offset=".52" stopColor="#F7CB5D"/>
          <stop offset="1" stopColor="#DE9E2E"/>
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#${id}r)`}/>
      <circle cx="12" cy="12" r="11" stroke="#7A4E0F" strokeOpacity=".4" strokeWidth=".8"/>
      <circle cx="12" cy="12" r="9.9" stroke="#8A5A14" strokeOpacity=".38" strokeWidth="1.15" strokeDasharray="1.05 1.85"/>
      <circle cx="12" cy="12" r="8.9" fill={`url(#${id}f)`}/>
      <circle cx="12" cy="12" r="8.9" stroke="#8A5A14" strokeOpacity=".5" strokeWidth=".7"/>
      <path d="M12 9.4l2.47 1.8-.94 2.9h-3.06l-.94-2.9L12 9.4z" fill="#8A5A14" fillOpacity=".78"/>
      <path d="M12 9.4V7.4M14.47 11.2l1.9-.62M13.53 14.1l1.17 1.62M10.47 14.1L9.3 15.72M9.53 11.2l-1.9-.62" stroke="#8A5A14" strokeOpacity=".65" strokeWidth="1.05" strokeLinecap="round"/>
      <path d="M5.9 8.2a7.1 7.1 0 0 1 5-2.9" stroke="#FFF6D8" strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}
