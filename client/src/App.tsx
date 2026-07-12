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
import { AdminPage } from '@/pages/AdminPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App(){return <MembershipGate><Routes><Route element={<AppShell/>}><Route index element={<HomePage/>}/><Route path="matches" element={<MatchesPage/>}/><Route path="competitions" element={<CompetitionsPage/>}/><Route path="rankings" element={<RankingsPage/>}/><Route path="rewards" element={<RewardsPage/>}/><Route path="profile" element={<ProfilePage/>}/></Route><Route path="matches/:id" element={<MatchDetailPage/>}/><Route path="quiz" element={<QuizPage/>}/><Route path="competitions/:id" element={<CompetitionDetailPage/>}/><Route path="admin" element={<AdminPage/>}/><Route path="404" element={<NotFoundPage/>}/><Route path="*" element={<Navigate to="/404" replace/>}/></Routes></MembershipGate>}
