import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
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
import { TradeOffersPage } from '@/pages/TradeOffersPage';
import { TransferMarketPage } from '@/pages/TransferMarketPage';
import { SquadPage } from '@/pages/SquadPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { AdminPage } from '@/pages/AdminPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PageSkeleton } from '@/components/ui';
import { funPostIdFromTelegramStartParam } from '@/lib/telegram';

const FunPage = lazy(() => import('@/pages/FunPage').then((module) => ({ default: module.FunPage })));
const FunModerationPage = lazy(() => import('@/pages/FunModerationPage').then((module) => ({ default: module.FunModerationPage })));
const FantasyAdminPage = lazy(() => import('@/pages/FantasyAdminPage').then((module) => ({ default: module.FantasyAdminPage })));

function TelegramDeepLinkRouter() {
  const navigate = useNavigate();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const postId = funPostIdFromTelegramStartParam();
    if (postId) navigate(`/fun?post=${postId}`, { replace: true });
  }, [navigate]);
  return null;
}

export default function App(){return <><TelegramDeepLinkRouter/><Routes><Route element={<AppShell/>}><Route index element={<HomePage/>}/><Route path="competition" element={<CompetitionHubPage/>}/><Route path="matches" element={<MatchesPage/>}/><Route path="competitions" element={<CompetitionsPage/>}/><Route path="quiz" element={<QuizPage/>}/><Route path="rankings" element={<RankingsPage/>}/><Route path="rewards" element={<RewardsPage/>}/><Route path="club" element={<ClubPage/>}/><Route path="club/squad" element={<SquadPage/>}/><Route path="club/players" element={<PlayersPage/>}/><Route path="club/transfer-market" element={<TransferMarketPage/>}/><Route path="club/trade-offers" element={<TradeOffersPage/>}/><Route path="club/transactions" element={<ClubFeaturePage slug="transactions"/>}/><Route path="club/customization" element={<ClubFeaturePage slug="customization"/>}/><Route path="store" element={<StorePage/>}/><Route path="fun" element={<Suspense fallback={<PageSkeleton/>}><FunPage/></Suspense>}/><Route path="profile" element={<ProfilePage/>}/></Route><Route path="matches/:id" element={<MatchDetailPage/>}/><Route path="competitions/:id" element={<CompetitionDetailPage/>}/><Route path="admin" element={<AdminPage/>}/><Route path="admin/fantasy" element={<Suspense fallback={<PageSkeleton/>}><FantasyAdminPage/></Suspense>}/><Route path="admin/fun" element={<Suspense fallback={<PageSkeleton/>}><FunModerationPage/></Suspense>}/><Route path="404" element={<NotFoundPage/>}/><Route path="*" element={<Navigate to="/404" replace/>}/></Routes></>}
