import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { MembershipGate } from '@/components/MembershipGate';
import { HomePage } from '@/pages/HomePage';
import { MatchesPage } from '@/pages/MatchesPage';
import { MatchDetailPage } from '@/pages/MatchDetailPage';
import { QuizPage } from '@/pages/QuizPage';
import { CompetitionsPage } from '@/pages/CompetitionsPage';
import { CompetitionDetailPage } from '@/pages/CompetitionDetailPage';
import { RankingsPage } from '@/pages/RankingsPage';
import { RewardsPage } from '@/pages/RewardsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { StorePage } from '@/pages/StorePage';
import { CompetitionHubPage } from '@/pages/CompetitionHubPage';
import { ClubFeaturePage, ClubPage } from '@/pages/ClubPage';
import { SquadPage } from '@/pages/SquadPage';
import { AdminPage } from '@/pages/AdminPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PageSkeleton } from '@/components/ui';

const FunPage = lazy(() => import('@/pages/FunPage').then((module) => ({ default: module.FunPage })));
const FunModerationPage = lazy(() => import('@/pages/FunModerationPage').then((module) => ({ default: module.FunModerationPage })));

export default function App(){return <MembershipGate><Routes><Route element={<AppShell/>}><Route index element={<HomePage/>}/><Route path="competition" element={<CompetitionHubPage/>}/><Route path="matches" element={<MatchesPage/>}/><Route path="competitions" element={<CompetitionsPage/>}/><Route path="quiz" element={<QuizPage/>}/><Route path="rankings" element={<RankingsPage/>}/><Route path="rewards" element={<RewardsPage/>}/><Route path="club" element={<ClubPage/>}/><Route path="club/players" element={<ClubFeaturePage slug="players"/>}/><Route path="club/transfer-market" element={<ClubFeaturePage slug="transfer-market"/>}/><Route path="club/trade-offers" element={<ClubFeaturePage slug="trade-offers"/>}/><Route path="club/transactions" element={<ClubFeaturePage slug="transactions"/>}/><Route path="club/customization" element={<ClubFeaturePage slug="customization"/>}/><Route path="store" element={<StorePage/>}/><Route path="fun" element={<Suspense fallback={<PageSkeleton/>}><FunPage/></Suspense>}/><Route path="profile" element={<ProfilePage/>}/></Route><Route path="club/squad" element={<SquadPage/>}/><Route path="matches/:id" element={<MatchDetailPage/>}/><Route path="competitions/:id" element={<CompetitionDetailPage/>}/><Route path="admin" element={<AdminPage/>}/><Route path="admin/fun" element={<Suspense fallback={<PageSkeleton/>}><FunModerationPage/></Suspense>}/><Route path="404" element={<NotFoundPage/>}/><Route path="*" element={<Navigate to="/404" replace/>}/></Routes></MembershipGate>}
