import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Check,
  Copy,
  Flame,
  Laugh,
  Medal,
  Pencil,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { Card, ErrorState, LoadingButton, PageSkeleton } from '@/components/ui';
import { useBootstrap } from '@/hooks/useBootstrap';
import { api } from '@/lib/api';
import { cn, faNumber, tehranDate } from '@/lib/utils';
import type { Badge, User } from '@/types/api';

interface ReferralData {
  link: string;
  successful: number;
  earnedPoints: number;
  referrals: unknown[];
}

const badgeIcons: Record<string, typeof Award> = { rocket: Rocket, target: Target, users: Users, flame: Flame };

function Avatar({ user }: { user: User }) {
  return user.photoUrl ? (
    <img src={user.photoUrl} alt={`${user.firstName} ${user.lastName || ''}`} className="h-[86px] w-[86px] rounded-[1.75rem] object-cover ring-4 ring-emerald-300/15"/>
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

export function ProfilePage() {
  const bootstrap = useBootstrap();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.get<User>('/profile')).data });
  const referrals = useQuery({ queryKey: ['referrals'], queryFn: async () => (await api.get<ReferralData>('/referrals')).data });
  const [editing, setEditing] = useState(false);
  const [team, setTeam] = useState('');
  const save = useMutation({
    mutationFn: async () => (await api.patch('/profile', { favoriteTeam: team })).data,
    onSuccess: async () => {
      toast.success('تیم محبوب ذخیره شد');
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => toast.error((error as Error).message)
  });

  if (profile.isLoading) return <PageSkeleton/>;
  if (profile.error || !profile.data) return <div className="p-4"><ErrorState message={(profile.error as Error)?.message || 'پروفایل دریافت نشد'}/></div>;

  const user = profile.data;
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
    setTeam(user.favoriteTeam || '');
    setEditing(true);
  };

  return (
    <main className="profile-page pb-5">
      <header className="profile-hero safe-top relative overflow-hidden px-4 pb-11 pt-3">
        <div className="home-hero-grid absolute inset-0 opacity-40"/>
        <div className="profile-hero-glow absolute -left-14 top-10 h-56 w-56 rounded-full bg-emerald-300/[.1] blur-3xl"/>
        <div className="absolute -right-20 top-28 h-52 w-52 rounded-full border border-emerald-300/[.07]"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3"><BrandMark className="h-11 w-11"/><div><p className="text-[9px] font-bold text-emerald-300">حساب کاربری</p><h1 className="mt-0.5 text-lg font-black">پروفایل من</h1></div></div>
          <button type="button" onClick={openEditor} aria-label="ویرایش پروفایل" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[.08] bg-white/[.05] text-slate-300 transition duration-300 active:scale-90 active:bg-white/10"><Pencil size={17}/></button>
        </div>

        <div className="profile-animate relative mt-7 flex items-center gap-4">
          <div className="relative shrink-0"><Avatar user={user}/><span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-4 border-ink-950 bg-emerald-400"/></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300"><Sparkles size={12}/> عضو باشگاه فوتبالی</div>
            <h2 className="mt-1 truncate text-xl font-black">{user.firstName} {user.lastName}</h2>
            <p className="mt-1 truncate text-[10px] text-slate-500">@{user.username || 'footballer'}</p>
            <button type="button" onClick={openEditor} className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[.07] px-3 py-1.5 text-[9px] font-bold text-emerald-300 transition active:scale-95"><ShieldCheck size={12}/><span className="truncate">{user.favoriteTeam || 'تیم محبوبت را انتخاب کن'}</span></button>
          </div>
        </div>
      </header>

      <div className="profile-animate relative -mt-6 grid grid-cols-3 gap-2 px-4" style={{ animationDelay: '70ms' }}>
        <ProfileStat icon={<Trophy size={13}/>} label="امتیاز کل" value={faNumber(user.points)} tone="text-amber-300"/>
        <ProfileStat icon={<Medal size={13}/>} label="رتبه هفته" value={`#${faNumber(user.weeklyRank ?? 0)}`} tone="text-emerald-300"/>
        <ProfileStat icon={<Flame size={13}/>} label="استریک" value={`${faNumber(user.streak)} روز`} tone="text-orange-300"/>
      </div>

      <div className="mt-6 space-y-6 px-4">
        {editing && (
          <Card className="profile-editor profile-animate border-emerald-300/20 bg-emerald-300/[.045]">
            <div className="mb-4"><p className="text-[9px] font-bold text-emerald-300">شخصی‌سازی پروفایل</p><h3 className="mt-1 text-sm font-black">تیم محبوبت کدام است؟</h3></div>
            <label className="label" htmlFor="favorite-team">نام تیم محبوب</label>
            <input id="favorite-team" className="input" value={team} onChange={(event) => setTeam(event.target.value)} placeholder="مثلاً پرسپولیس یا رئال مادرید" autoFocus/>
            <div className="mt-3 flex gap-2"><button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>انصراف</button><LoadingButton loading={save.isPending} disabled={team.trim().length < 2} className="flex-1" onClick={() => save.mutate()}><Check size={17}/>ذخیره</LoadingButton></div>
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

        {bootstrap.data?.isAdmin && <div className="profile-animate grid grid-cols-2 gap-2"><Link to="/admin" className="btn-secondary w-full border-emerald-300/20 px-2 text-[10px] text-emerald-300"><ShieldCheck size={16}/>پنل مدیریت</Link><Link to="/admin/fun" className="btn-secondary w-full border-fuchsia-300/20 px-2 text-[10px] text-fuchsia-300"><Laugh size={16}/>مدیریت فان</Link></div>}

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
