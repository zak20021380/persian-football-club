import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const faNumber = (value: number|string) => new Intl.NumberFormat('fa-IR').format(Number(value));
export const tehranDate = (value: string|Date, withDate = true) => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', ...(withDate ? { month: 'short', day: 'numeric' } : {}), hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const remaining = (value: string) => {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return 'پایان یافته';
  const hours = Math.floor(ms / 3_600_000); const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 24 ? `${faNumber(Math.ceil(hours/24))} روز مانده` : `${faNumber(hours)}:${String(minutes).padStart(2,'0')} مانده`;
};
