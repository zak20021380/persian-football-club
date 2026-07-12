import { cn } from '@/lib/utils';

const localCrests: Array<[string[], string]> = [
  [['پرسپولیس', 'perspolis', 'persepolis'], '/clubs/persepolis.svg'],
  [['استقلال', 'esteghlal'], '/clubs/esteghlal.svg'],
  [['رئال مادرید', 'real madrid'], '/clubs/real-madrid.svg'],
  [['بارسلونا', 'barcelona'], '/clubs/barcelona.svg']
];

function crestFor(name: string) {
  const normalized = name.trim().toLowerCase();
  return localCrests.find(([names]) => names.some((item) => normalized.includes(item)))?.[1];
}

function fallbackTone(name: string) {
  const tones = ['from-emerald-400 to-teal-700', 'from-blue-400 to-indigo-800', 'from-rose-400 to-red-800', 'from-amber-300 to-orange-700'];
  const score = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[score % tones.length];
}

export function ClubCrest({ name, logo, className = '' }: { name: string; logo?: string; className?: string }) {
  const source = logo || crestFor(name);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');

  return (
    <div className={cn('club-crest', className)}>
      {source ? (
        <img src={source} alt={`نشان ${name}`} loading="lazy" />
      ) : (
        <div className={cn('grid h-full w-full place-items-center bg-gradient-to-br text-sm font-black text-white', fallbackTone(name))} aria-label={`نشان ${name}`}>
          {initials}
        </div>
      )}
    </div>
  );
}
