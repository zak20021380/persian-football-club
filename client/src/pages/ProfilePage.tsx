import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isDemoDataEnabled } from '@/lib/featureFlags';
import {
  ArrowLeft,
  Award,
  Check,
  Coins,
  Copy,
  Flame,
  Gem,
  Headset,
  Medal,
  Pencil,
  Rocket,
  Share2,
  ShieldCheck,
  Shirt,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Wrench,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { ClubCrest } from '@/components/ClubCrest';
import { WalletShortcut } from '@/components/WalletShortcut';
import { Card, ErrorState, LoadingButton, PageSkeleton } from '@/components/ui';
import { useBootstrap } from '@/hooks/useBootstrap';
import { api } from '@/lib/api';
import { impact, notify, openTelegramProfile } from '@/lib/telegram';
import { cn, faNumber, tehranDate } from '@/lib/utils';
import type { Badge, User } from '@/types/api';

interface ReferralData {
  link: string;
  successful: number;
  earnedPoints: number;
  referrals: unknown[];
}

interface ProfileRankingEntry {
  userId: string;
  clubName: string;
  ownerName: string;
  score: number;
  rank: number;
  formation?: string;
  playerCount: number;
  logoUrl?: string;
}

interface ProfileRankingData {
  current: ProfileRankingEntry;
}

interface ProfileClubPlayer {
  _id: string;
  name: string;
}

interface ProfileClubDetails {
  logoUrl?: string;
  formation?: string;
  starters: Array<ProfileClubPlayer|null>;
  substitutes: ProfileClubPlayer[];
  captainId?: string;
  totalSquadValue: number;
  totalFantasyPoints: number;
  recentWeeks: Array<{ startsAt: string; points: number }>;
}

interface ProfileClubView {
  name: string;
  logoUrl?: string;
  managerName: string;
  formation?: string;
  rank?: number;
  fantasyPoints?: number;
  squadValue?: number;
  coinBalance: number;
  captainName?: string;
  form: number[];
  playerCount: number;
  demo?: boolean;
}

const badgeIcons: Record<string, typeof Award> = { rocket: Rocket, target: Target, users: Users, flame: Flame };

function showSupportPendingToast() {
  notify('warning');
  toast.custom((t) => (
    <div
      dir="rtl"
      role="status"
      className={cn(
        'pointer-events-auto flex w-[min(92vw,360px)] items-start gap-3 overflow-hidden rounded-[1.15rem] border border-amber-300/[.16] bg-ink-900/95 p-3 shadow-[0_18px_40px_rgba(1,2,13,.4)] backdrop-blur-xl',
        t.visible ? 'animate-[toast-in_.28s_cubic-bezier(.16,1,.3,1)]' : 'animate-[toast-out_.2s_ease-in_forwards]'
      )}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-amber-300/40 to-transparent" aria-hidden="true"/>
      <span className="relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/[.18] bg-amber-300/[.1] text-amber-300 shadow-[inset_0_1px_rgba(255,255,255,.08)]">
        <Wrench size={19} strokeWidth={2.2}/>
        <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-amber-400">
          <span className="absolute inset-[-3px] animate-ping rounded-full bg-amber-400/50"/>
        </span>
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[12px] font-black text-white">راه ارتباطی هنوز آماده نشده</p>
        <p className="mt-1 text-[9.5px] leading-5 text-slate-400">تیم پشتیبانی در حال راه‌اندازی این بخش است. کمی بعد دوباره سر بزن.</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="بستن"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition active:scale-90 active:bg-white/[.06]"
      >
        <X size={15}/>
      </button>
    </div>
  ), { duration: 4200 });
}

function Avatar({ user }: { user: User }) {
  return user.photoUrl ? (
    <img src={user.photoUrl} alt={user.firstName} className="h-[86px] w-[86px] rounded-[1.75rem] object-cover ring-4 ring-emerald-300/15"/>
  ) : (
    <div className="grid h-[86px] w-[86px] place-items-center rounded-[1.75rem] bg-gradient-to-br from-emerald-300 to-emerald-600 text-3xl font-black text-ink-950 ring-4 ring-emerald-300/10">{user.firstName.slice(0, 1)}</div>
  );
}

function ProfileStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="group min-w-0 rounded-2xl border border-white/[.075] bg-ink-900/95 px-3 py-3 shadow-lg shadow-black/15 transition duration-300 active:scale-[.98]">
      <div className={cn('mb-2 flex items-center gap-1.5 text-[9px] font-bold', tone)}>{icon}<span className="truncate text-slate-500">{label}</span></div>
      <strong className="block truncate text-base font-black text-white">{value}</strong>
    </div>
  );
}

function PerformanceMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex min-h-[48px] items-center gap-2.5 rounded-2xl bg-white/[.035] px-2.5">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', tone)}>{icon}</span>
      <div className="min-w-0 flex-1"><strong className="block truncate text-xs font-black">{value}</strong><span className="block truncate text-[9px] text-slate-500">{label}</span></div>
    </div>
  );
}

function AccuracyRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="profile-accuracy-ring relative grid h-24 w-24 place-items-center rounded-full" style={{ '--accuracy': `${safeValue * 3.6}deg` } as CSSProperties}>
      <div className="grid h-[74px] w-[74px] place-items-center rounded-full border border-white/[.06] bg-ink-900 text-center shadow-inner">
        <div><strong className="block text-xl font-black text-white">{faNumber(safeValue)}٪</strong><span className="text-[8px] text-slate-500">دقت کوییز</span></div>
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const Icon = badgeIcons[badge.icon] || Award;
  return (
    <div className="min-w-[132px] snap-start rounded-[1.3rem] border border-amber-300/10 bg-gradient-to-b from-amber-300/[.07] to-transparent p-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/[.12] text-amber-300"><Icon size={19}/></div>
      <h3 className="mt-3 line-clamp-1 text-[11px] font-black">{badge.name}</h3>
      <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-slate-500">{badge.description}</p>
    </div>
  );
}

function MyClubSection({ club, loading, onEdit }: { club: ProfileClubView|null; loading: boolean; onEdit: () => void }) {
  if (loading) return <div className="profile-club-card broadcast-skeleton h-[246px] rounded-[1.45rem]" aria-label="در حال دریافت اطلاعات باشگاه"/>;
  if (!club) return (
    <section className="profile-club-empty profile-animate relative isolate overflow-hidden rounded-[1.45rem] border border-dashed border-emerald-300/[.16] px-5 py-6 text-center">
      <ShieldCheck size={104} strokeWidth={1} className="absolute -left-7 -top-7 -rotate-12 text-emerald-300/[.045]"/>
      <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-[1.15rem] border border-emerald-300/[.12] bg-emerald-300/[.08] text-emerald-300"><Shirt size={24}/></span>
      <p className="relative mt-3 text-[7px] font-black tracking-[.17em] text-cyan-300" dir="ltr">CREATE YOUR FANTASY CLUB</p>
      <h2 className="relative mt-1 text-sm font-black">باشگاه فانتزی هنوز ساخته نشده</h2>
      <p className="relative mx-auto mt-1 max-w-[250px] text-[8px] leading-4 text-slate-500">نام باشگاهت را انتخاب کن، بازیکن بگیر و اولین ترکیب را بچین.</p>
      <Link to="/club" className="relative mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-300 to-cyan-300 px-6 text-[9px] font-black text-ink-950 shadow-[0_10px_24px_rgba(52,211,153,.12)]">ساخت باشگاه<ArrowLeft size={14}/></Link>
    </section>
  );

  return (
    <section className="profile-club-card profile-animate relative isolate overflow-hidden rounded-[1.45rem] border border-cyan-200/[.12] p-3.5">
      <div className="profile-club-grid absolute inset-0"/>
      <div className="relative flex items-center gap-3">
        <div className="profile-club-crest grid h-[70px] w-[70px] shrink-0 place-items-center rounded-[1.35rem] border border-white/[.08] bg-white/[.045]"><ClubCrest name={club.name} logo={club.logoUrl} className="h-[58px] w-[58px] !overflow-visible !rounded-none"/></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className="text-[7px] font-black tracking-[.16em] text-cyan-300" dir="ltr">MY FANTASY CLUB</span>{club.demo && <span className="rounded-full border border-fuchsia-300/[.16] bg-fuchsia-300/[.08] px-1.5 py-0.5 text-[5px] font-black text-fuchsia-200" dir="ltr">DEMO</span>}</div>
          <h2 className="mt-1 truncate text-[14px] font-black leading-6 tracking-[-.02em] text-white min-[360px]:text-[16px]" dir="ltr">{club.name}</h2>
          <p className="mt-0.5 truncate text-[7.5px] text-slate-500">مدیر / مالک: <strong className="text-slate-300">{club.managerName}</strong></p>
        </div>
        <span className="profile-club-rank grid h-12 w-12 shrink-0 place-items-center rounded-xl text-center"><span><small className="block text-[5px] font-black tracking-[.1em] text-amber-300" dir="ltr">RANK</small><strong className="mt-0.5 block text-[13px] text-white">{club.rank === undefined ? '—' : `#${faNumber(club.rank)}`}</strong></span></span>
      </div>

      <div className="relative mt-3 grid grid-cols-4 gap-1.5">
        <ClubMetric icon={<Trophy size={12}/>} label="امتیاز فانتزی" value={club.fantasyPoints === undefined ? '—' : faNumber(club.fantasyPoints)} tone="text-cyan-300"/>
        <ClubMetric icon={<Gem size={12}/>} label="ارزش تیم" value={club.squadValue === undefined ? '—' : faNumber(club.squadValue)} tone="text-violet-300"/>
        <ClubMetric icon={<Coins size={12}/>} label="موجودی سکه" value={faNumber(club.coinBalance)} tone="text-amber-300"/>
        <ClubMetric icon={<UsersRound size={12}/>} label="بازیکنان" value={faNumber(club.playerCount)} tone="text-emerald-300"/>
      </div>

      <div className="relative mt-2 grid grid-cols-[.8fr_1.2fr_1.45fr] divide-x divide-x-reverse divide-white/[.055] rounded-xl border border-white/[.055] bg-white/[.025] px-1 py-2.5 text-center">
        <ClubInfo label="آرایش" value={club.formation || '—'} dir="ltr"/>
        <ClubInfo label="کاپیتان" value={club.captainName || 'ثبت نشده'} dir="ltr"/>
        <ClubForm values={club.form}/>
      </div>

      <div className="relative mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Link to="/club" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-300 to-cyan-300 px-3 text-[9px] font-black text-ink-950 shadow-[0_9px_22px_rgba(52,211,153,.1)] transition active:scale-[.98]">مشاهده باشگاه<ArrowLeft size={14}/></Link>
        <button type="button" onClick={onEdit} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[.075] bg-white/[.045] px-3 text-[8px] font-bold text-slate-300 transition active:scale-[.97] active:bg-white/[.08]"><Pencil size={12}/>ویرایش نام</button>
      </div>
    </section>
  );
}

function ClubMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return <div className="profile-club-metric min-w-0 rounded-xl border border-white/[.055] px-1 py-2 text-center"><span className={cn('mx-auto grid h-6 w-6 place-items-center rounded-lg bg-white/[.035]', tone)}>{icon}</span><strong className="mt-1 block truncate text-[8px] text-white">{value}</strong><span className="mt-0.5 block truncate text-[5.5px] text-slate-600">{label}</span></div>;
}

function ClubInfo({ label, value, dir }: { label: string; value: string; dir?: 'ltr'|'rtl' }) {
  return <div className="min-w-0 px-1"><span className="block text-[5.5px] text-slate-600">{label}</span><strong className="mt-1 block truncate text-[7px] text-slate-200" dir={dir}>{value}</strong></div>;
}

function ClubForm({ values }: { values: number[] }) {
  if (!values.length) return <div className="min-w-0 px-1"><span className="block text-[5.5px] text-slate-600">فرم هفتگی</span><strong className="mt-1 block text-[7px] text-slate-600">ثبت نشده</strong></div>;
  const recent = values.slice(-5);
  const max = Math.max(...recent.map(value => Math.abs(value)), 1);
  return <div className="min-w-0 px-1"><span className="block text-[5.5px] text-slate-600">فرم هفتگی</span><span className="mt-1 flex h-4 items-end justify-center gap-[3px]" dir="ltr">{recent.map((value, index) => <i key={`${value}-${index}`} title={`${value}`} className={cn('block w-1 rounded-t-full not-italic', index === recent.length - 1 ? 'bg-emerald-300' : 'bg-cyan-300/45')} style={{ height: `${Math.max(4, Math.round(Math.abs(value) / max * 16))}px` }}/>)}</span></div>;
}

const demoClub: Omit<ProfileClubView, 'managerName'|'coinBalance'> = {
  name: 'Manchester City',
  logoUrl: 'https://media.api-sports.io/football/teams/50.png',
  formation: '4-3-3',
  rank: 1,
  fantasyPoints: 864,
  squadValue: 17_450,
  captainName: 'Erling Haaland',
  form: [61, 74, 68, 82, 79],
  playerCount: 16,
  demo: true
};

export function ProfilePage() {
  const bootstrap = useBootstrap();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.get<User>('/profile')).data });
  const referrals = useQuery({ queryKey: ['referrals'], queryFn: async () => (await api.get<ReferralData>('/referrals')).data });
  const fantasyRanking = useQuery({
    queryKey: ['rankings', 'fantasy', 'season'],
    queryFn: async () => (await api.get<ProfileRankingData>('/rankings', { params: { type: 'fantasy', period: 'season' } })).data,
    enabled: Boolean(profile.data?._id)
  });
  const clubDetails = useQuery({
    queryKey: ['rankingClubDetails', profile.data?._id, 'season'],
    queryFn: async () => (await api.get<ProfileClubDetails>(`/rankings/${profile.data!._id}`, { params: { period: 'season' } })).data,
    enabled: Boolean(profile.data?._id)
  });
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [clubName, setClubName] = useState('');
  const MAX_NAME_LENGTH = 50;
  const MAX_CLUB_LENGTH = 80;
  const save = useMutation({
    mutationFn: async () => (await api.patch('/profile', {
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      ...(clubName.trim() ? { clubName: clubName.trim() } : {})
    })).data,
    onSuccess: async () => {
      toast.success('پروفایل ذخیره شد');
      setEditing(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['profile'] }), queryClient.invalidateQueries({ queryKey: ['bootstrap'] })]);
    },
    onError: (error) => toast.error((error as Error).message)
  });

  if (profile.isLoading) return <PageSkeleton/>;
  if (profile.error || !profile.data) return <div className="p-4"><ErrorState message={(profile.error as Error)?.message || 'پروفایل دریافت نشد'}/></div>;

  const user = profile.data;
  const details = clubDetails.data;
  const ranking = fantasyRanking.data?.current;
  const starterCount = details?.starters.filter(Boolean).length ?? 0;
  const rosterCount = starterCount + (details?.substitutes.length ?? 0);
  const hasBackendClub = Boolean(user.clubName || rosterCount > 0);
  const captain = details?.captainId
    ? [...details.starters.filter((player): player is ProfileClubPlayer => Boolean(player)), ...(details.substitutes ?? [])].find(player => player._id === details.captainId)
    : undefined;
  const backendClub: ProfileClubView|null = hasBackendClub ? {
    name: user.clubName || ranking?.clubName || user.favoriteTeam || 'باشگاه من',
    logoUrl: details?.logoUrl || ranking?.logoUrl,
    managerName: user.displayName || user.firstName,
    formation: details?.formation || ranking?.formation,
    rank: ranking?.rank,
    fantasyPoints: ranking?.score ?? details?.totalFantasyPoints,
    squadValue: details?.totalSquadValue,
    coinBalance: user.coinBalance,
    captainName: captain?.name,
    form: details?.recentWeeks.map(week => week.points) ?? [],
    playerCount: rosterCount || ranking?.playerCount || 0
  } : null;
  const club = backendClub ?? (isDemoDataEnabled() ? { ...demoClub, managerName: user.displayName || user.firstName, coinBalance: user.coinBalance } : null);
  const clubLoading = bootstrap.isLoading || fantasyRanking.isLoading || clubDetails.isLoading;
  const copy = async (showToast = true) => {
    if (!referrals.data?.link) return;
    await navigator.clipboard.writeText(referrals.data.link);
    if (showToast) toast.success('لینک دعوت کپی شد');
  };
  const share = async () => {
    if (!referrals.data?.link) return;
    if (navigator.share) {
      await navigator.share({ title: 'باشگاه فوتبالی', text: 'بیا با هم رقابت کنیم!', url: referrals.data.link });
      return;
    }
    await copy();
  };
  const openEditor = () => {
    setDisplayName(user.displayName || '');
    setClubName(user.clubName || '');
    setEditing(true);
  };
  const contactAdmin = () => {
    const username = bootstrap.data?.supportTelegramUsername;
    if (!username) {
      showSupportPendingToast();
      return;
    }
    impact('light');
    if (!openTelegramProfile(username)) toast.error('باز کردن تلگرام ممکن نشد');
  };

  return (
    <main className="profile-page pb-5">
      <header className="profile-hero safe-top relative overflow-hidden px-4 pb-11 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-40"/>
        <div className="profile-hero-glow absolute -left-14 top-10 h-56 w-56 rounded-full bg-emerald-300/[.1] blur-3xl"/>
        <div className="absolute -right-20 top-28 h-52 w-52 rounded-full border border-emerald-300/[.07]"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3"><BrandMark className="h-11 w-11"/><div><p className="text-[9px] font-bold text-emerald-300">حساب کاربری</p><h1 className="mt-0.5 text-lg font-black">پروفایل من</h1></div></div>
          <div className="flex items-center gap-2">
            <WalletShortcut/>
            <button type="button" onClick={contactAdmin} aria-label="ارتباط با پشتیبانی" title="ارتباط با پشتیبانی" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-cyan-200/[.14] bg-cyan-300/[.08] text-cyan-200 shadow-[inset_0_1px_rgba(255,255,255,.06)] transition duration-300 active:scale-90 active:bg-cyan-300/[.15]">
              <Headset size={17}/>
              {bootstrap.data?.supportTelegramUsername && (
                <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-emerald-400" aria-hidden="true">
                  <span className="absolute inset-[-2px] animate-ping rounded-full bg-emerald-400/50"/>
                </span>
              )}
            </button>
            <button type="button" onClick={openEditor} aria-label="ویرایش پروفایل" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[.08] bg-white/[.05] text-slate-300 transition duration-300 active:scale-90 active:bg-white/10"><Pencil size={17}/></button>
          </div>
        </div>

        <div className="profile-animate relative mt-7 flex items-center gap-4">
          <div className="relative shrink-0"><Avatar user={user}/><span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-4 border-ink-950 bg-emerald-400"/></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300"><Sparkles size={12}/> عضو باشگاه فوتبالی</div>
            <h2 className="mt-1 truncate text-xl font-black">{user.firstName}</h2>
            <p className="mt-1 truncate text-[10px] text-slate-500">{user.clubName || user.favoriteTeam || 'باشگاه فوتبالی'}</p>
            <button type="button" onClick={openEditor} className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[.07] px-3 py-1.5 text-[9px] font-bold text-emerald-300 transition active:scale-95"><ShieldCheck size={12}/><span className="truncate">{user.clubName || user.favoriteTeam || 'نام باشگاهت را ثبت کن'}</span></button>
          </div>
        </div>
      </header>

      <div className="relative -mt-6 px-4">
        <MyClubSection club={club} loading={clubLoading} onEdit={openEditor}/>
      </div>

      <div className="profile-animate relative mt-3 grid grid-cols-3 gap-2 px-4" style={{ animationDelay: '70ms' }}>
        <ProfileStat icon={<Trophy size={13}/>} label="امتیاز کل" value={faNumber(user.points)} tone="text-amber-300"/>
        <ProfileStat icon={<Medal size={13}/>} label="رتبه هفته" value={`#${faNumber(user.weeklyRank ?? 0)}`} tone="text-emerald-300"/>
        <ProfileStat icon={<Flame size={13}/>} label="استریک" value={`${faNumber(user.streak)} روز`} tone="text-orange-300"/>
      </div>

      <div className="mt-6 space-y-6 px-4">
        {editing && (
          <Card className="profile-editor profile-animate border-emerald-300/20 bg-emerald-300/[.045]">
            <div className="mb-4"><p className="text-[9px] font-bold text-emerald-300">شخصی‌سازی پروفایل</p><h3 className="mt-1 text-sm font-black">نام نمایشی و باشگاه</h3></div>
            <label className="label" htmlFor="display-name">نام نمایشی</label>
            <input id="display-name" className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={user.firstName} maxLength={MAX_NAME_LENGTH} autoFocus/>
            <label className="label mt-3" htmlFor="club-name">نام باشگاه</label>
            <input id="club-name" className="input" value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="مثلاً باشگاه ستاره‌ها" maxLength={MAX_CLUB_LENGTH}/>
            <div className="mt-1.5 flex justify-between text-[9px] text-slate-500"><span>{faNumber(displayName.length)}/{faNumber(MAX_NAME_LENGTH)}</span><span>{faNumber(clubName.length)}/{faNumber(MAX_CLUB_LENGTH)}</span></div>
            <div className="mt-3 flex gap-2"><button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>انصراف</button><LoadingButton loading={save.isPending} disabled={(!displayName.trim() && !clubName.trim()) || (displayName.trim().length > 0 && displayName.trim().length < 2) || (clubName.trim().length > 0 && clubName.trim().length < 2)} className="flex-1" onClick={() => save.mutate()}><Check size={17}/>ذخیره</LoadingButton></div>
          </Card>
        )}

        <section className="profile-animate" style={{ animationDelay: '130ms' }}>
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[9px] font-bold text-emerald-300">نمای کلی</p><h2 className="mt-0.5 text-base font-black">عملکرد فوتبالی</h2></div><span className="rounded-full border border-white/[.07] bg-white/[.035] px-3 py-1.5 text-[9px] text-slate-400">رتبه کل #{faNumber(user.allTimeRank ?? 0)}</span></div>
          <Card className="overflow-hidden p-3">
            <div className="grid grid-cols-[104px_1fr] items-center gap-3">
              <div className="flex flex-col items-center rounded-[1.4rem] bg-emerald-300/[.035] py-4"><AccuracyRing value={user.quizAccuracy}/><span className="mt-3 text-[8px] text-slate-500">میانگین پاسخ صحیح</span></div>
              <div className="space-y-2">
                <PerformanceMetric icon={<Trophy size={15}/>} label="پیش‌بینی صحیح" value={faNumber(user.correctPredictions)} tone="bg-amber-300/[.11] text-amber-300"/>
                <PerformanceMetric icon={<Target size={15}/>} label="نتیجه کاملاً دقیق" value={faNumber(user.exactPredictions)} tone="bg-sky-300/[.11] text-sky-300"/>
                <PerformanceMetric icon={<UserPlus size={15}/>} label="دعوت موفق" value={faNumber(user.successfulReferrals)} tone="bg-violet-300/[.11] text-violet-300"/>
              </div>
            </div>
          </Card>
        </section>

        {user.badges && user.badges.length > 0 && (
          <section className="profile-animate" style={{ animationDelay: '190ms' }}>
            <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-bold text-amber-300">ویترین افتخارات</p><h2 className="mt-0.5 text-base font-black">نشان‌های من</h2></div><span className="text-[9px] text-slate-500">{faNumber(user.badges.length)} نشان</span></div>
            <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">{user.badges.map((badge) => <BadgeCard key={badge._id} badge={badge}/>)}</div>
          </section>
        )}

        <section className="profile-animate" style={{ animationDelay: '250ms' }}>
          <Card className="referral-card relative overflow-hidden border-sky-300/15 bg-gradient-to-br from-sky-400/[.1] via-indigo-400/[.06] to-transparent p-0">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full border-[22px] border-sky-300/[.035]"/>
            <div className="relative p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[9px] font-black text-sky-300">باشگاه بزرگ‌تر، رقابت جذاب‌تر</p><h2 className="mt-1 text-base font-black">دعوت از دوستان</h2><p className="mt-1 text-[9px] leading-5 text-slate-400">با هر دعوت موفق، امتیاز باشگاه بگیر.</p></div>
                <button type="button" onClick={share} aria-label="اشتراک‌گذاری لینک دعوت" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-300 text-ink-950 shadow-lg shadow-sky-500/15 transition duration-300 active:scale-90"><Share2 size={18}/></button>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/[.06] bg-ink-950/70 p-1.5">
                <code className="min-w-0 flex-1 truncate px-2 text-left text-[9px] text-slate-500" dir="ltr">{referrals.data?.link || 'در حال دریافت لینک...'}</code>
                <button type="button" onClick={() => copy()} disabled={!referrals.data?.link} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.07] text-slate-300 transition active:scale-90 disabled:opacity-40"><Copy size={15}/></button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[.035] p-3"><span className="text-[9px] text-slate-500">دعوت موفق</span><strong className="mt-1 block text-lg font-black text-sky-300">{faNumber(referrals.data?.successful ?? 0)}</strong></div>
                <div className="rounded-2xl bg-white/[.035] p-3"><span className="text-[9px] text-slate-500">امتیاز دریافتی</span><strong className="mt-1 block text-lg font-black text-emerald-300">{faNumber(referrals.data?.earnedPoints ?? 0)}</strong></div>
              </div>
            </div>
          </Card>
        </section>

        <section className="profile-animate" style={{ animationDelay: '310ms' }}>
          <div className="mb-3"><p className="text-[9px] font-bold text-emerald-300">آخرین رویدادها</p><h2 className="mt-0.5 text-base font-black">فعالیت‌های اخیر</h2></div>
          <Card className="p-2">
            {user.activity?.length ? user.activity.slice().reverse().slice(0, 12).map((activity, index) => (
              <div key={`${activity.at}-${index}`} className="group flex min-h-[60px] items-center gap-3 rounded-2xl px-2.5 transition duration-300 hover:bg-white/[.03]">
                <div className="relative flex h-full w-5 shrink-0 items-center justify-center"><span className="relative z-10 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-emerald-300 ring-2 ring-emerald-300/15"/>{index < Math.min((user.activity?.length ?? 0), 12) - 1 && <span className="absolute bottom-0 top-1/2 w-px bg-white/[.07]"/>}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{activity.title}</p><p className="mt-1 text-[9px] text-slate-500">{tehranDate(activity.at)}</p></div>
                <span className="rounded-full bg-emerald-300/[.08] px-2.5 py-1 text-[9px] font-black text-emerald-300">+{faNumber(activity.points)}</span>
              </div>
            )) : <div className="py-8 text-center"><Sparkles className="mx-auto text-slate-600"/><h3 className="mt-3 text-xs font-black">شروع ماجراجویی</h3><p className="mt-1 text-[9px] text-slate-500">اولین فعالیتت اینجا ثبت می‌شود.</p></div>}
          </Card>
        </section>
      </div>
    </main>
  );
}
