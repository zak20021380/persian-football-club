export type Id = string;
export interface User { _id: Id; firstName: string; lastName?: string; username?: string; photoUrl?: string; favoriteTeam?: string; points: number; coinBalance: number; weeklyPoints: number; streak: number; quizAccuracy: number; correctPredictions: number; exactPredictions: number; successfulReferrals: number; weeklyRank?: number; allTimeRank?: number; createdAt: string; activity?: Activity[]; badges?: Badge[]; }
export interface Activity { type: string; title: string; points: number; at: string; }
export interface Badge { _id: Id; name: string; description: string; icon: string; category: string; threshold: number; }
export interface Bootstrap { user: User; membershipConfirmed: boolean; joinUrl: string; botUsername: string; isAdmin: boolean; timezone: string; }
export interface Match { _id: Id; homeTeam: string; awayTeam: string; competitionName: string; kickoffAt: string; predictionDeadline: string; homeLogo?: string; awayLogo?: string; description?: string; status: 'scheduled'|'live'|'finished'|'cancelled'; homeScore?: number; awayScore?: number; predictionOpen: boolean; prediction?: Prediction|null; }
export interface Prediction { _id: Id; outcome: 'home'|'draw'|'away'; homeScore?: number; awayScore?: number; pointsAwarded: number; scored: boolean; }
export interface Question { _id: Id; text: string; options: string[]; category: string; difficulty: string; score: number; explanation?: string; }
export interface Quiz { _id: Id; title: string; description?: string; questionIds: Question[]; startsAt: string; endsAt: string; timerSeconds?: number; attempted: boolean; attempt?: { score: number; correctCount: number }|null; }
export interface Competition { _id: Id; title: string; coverImage?: string; description: string; type: string; startsAt: string; endsAt: string; prize?: string; status: string; questionIds?: Question[]; attemptLimit: number; attempts?: Array<{score:number; correctCount:number}>; }
export interface Reward { _id: Id; title: string; description: string; image?: string; type: string; pointsRequired?: number; rankRequired?: number; endsAt: string; eligible: boolean; }
export interface Sponsor { _id: Id; name: string; logo?: string; promotionalText: string; ctaText: string; clickUrl: string; }
export interface HomeClubSummary { name: string; logo?: string; squadValue: number; formation: string; playerCount: number; newOfferCount: number; }
export interface HomeCompetitionSummary extends Competition { rank: number|null; attempted: boolean; }
export interface HomeData { user: { firstName: string; points: number; coinBalance: number; weeklyRank: number; streak: number }; club: HomeClubSummary|null; transferStatus: { activeListings: number; receivedOffers: number; expiringOffers: number }; activeCompetition: HomeCompetitionSummary|null; matches: Match[]; competitions: Competition[]; dailyQuiz: Quiz|null; leaders: User[]; rewards: Reward[]; sponsor: Sponsor|null; predictionsCount: number; }
export interface FunPost { _id: Id; caption?: string; imageUrl?: string; likeCount: number; liked: boolean; isOwner: boolean; createdAt: string; owner: { _id: Id; firstName: string; lastName?: string; username?: string; photoUrl?: string }; }
export interface FunFeedPage { items: FunPost[]; nextCursor: string|null; }
export interface CoinPackage { _id: Id; title: string; coins: number; price: number; originalPrice?: number; badge?: string; active: boolean; sortOrder: number; }
export interface CoinTransaction { _id: Id; type: 'purchase'|'daily_reward'; status: 'pending'|'processing'|'completed'|'failed'; coins: number; balanceAfter?: number; packageTitle?: string; price?: number; currency: 'IRT'; provider: 'test'|'none'; completedAt?: string; createdAt: string; }
export interface StoreData { balance: number; packages: CoinPackage[]; dailyReward: { amount: number; claimable: boolean; nextClaimAt: string|null }; transactions: CoinTransaction[]; paymentMode: 'test'|'unavailable'; }
export type SquadFormation = '4-3-3'|'4-4-2'|'4-2-3-1';
export interface ClubPlayer { _id: Id; name: string; position: 'GK'|'RB'|'CB'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST'; overall: number; photoUrl?: string; nationality?: string; }
export interface SquadData { formation: SquadFormation; starters: Array<ClubPlayer|null>; substitutes: ClubPlayer[]; }
