export type Id = string;
export interface User { _id: Id; firstName: string; displayName?: string; clubName?: string; photoUrl?: string; favoriteTeam?: string; points: number; coinBalance: number; weeklyPoints: number; streak: number; quizAccuracy: number; correctPredictions: number; exactPredictions: number; successfulReferrals: number; weeklyRank?: number; allTimeRank?: number; createdAt: string; activity?: Activity[]; badges?: Badge[]; }
export interface Activity { type: string; title: string; points: number; at: string; }
export interface Badge { _id: Id; name: string; description: string; icon: string; category: string; threshold: number; }
export interface Bootstrap { user: User; membershipConfirmed: boolean; joinUrl: string; botUsername: string; isAdmin: boolean; timezone: string; }
export interface Match { _id: Id; externalApiId?: number; homeTeamId?: Id; awayTeamId?: Id; homeTeam: string; awayTeam: string; competitionName: string; kickoffAt: string; predictionDeadline: string; homeLogo?: string; awayLogo?: string; description?: string; status: 'scheduled'|'live'|'finished'|'cancelled'; homeScore?: number; awayScore?: number; predictionOpen: boolean; prediction?: Prediction|null; reminder?: MatchReminder|null; reminderOptions?: MatchReminderMinutes[]; reminderError?: { code: string; message: string }|null; }
export type MatchReminderMinutes = 15|30|60;
export interface MatchReminder { _id: Id; minutes: MatchReminderMinutes; sendAt: string; status: 'pending'|'processing'|'sent'|'failed'; }
export interface Prediction { _id: Id; outcome: 'home'|'draw'|'away'; homeScore?: number; awayScore?: number; pointsAwarded: number; scored: boolean; }
export interface Question { _id: Id; text: string; options: string[]; category: string; difficulty: string; score: number; explanation?: string; }
export interface Quiz { _id: Id; title: string; description?: string; questionIds: Question[]; startsAt: string; endsAt: string; timerSeconds?: number; attempted: boolean; attempt?: { score: number; correctCount: number }|null; }
export interface Competition { _id: Id; title: string; coverImage?: string; description: string; type: string; startsAt: string; endsAt: string; prize?: string; status: string; questionIds?: Question[]; attemptLimit: number; attempts?: Array<{score:number; correctCount:number}>; }
export interface Reward { _id: Id; title: string; description: string; image?: string; type: string; pointsRequired?: number; rankRequired?: number; endsAt: string; eligible: boolean; }
export interface Sponsor { _id: Id; name: string; logo?: string; promotionalText: string; ctaText: string; clickUrl: string; }
export interface HomeClubSummary { name: string; logo?: string; squadValue: number; formation: string; playerCount: number; newOfferCount: number; }
export interface HomeCompetitionSummary extends Competition { rank: number|null; attempted: boolean; }
export interface HomeData { user: { firstName: string; points: number; coinBalance: number; weeklyRank: number; streak: number }; club: HomeClubSummary|null; transferStatus: { activeListings: number; receivedOffers: number; expiringOffers: number }; activeCompetition: HomeCompetitionSummary|null; matches: Match[]; competitions: Competition[]; dailyQuiz: Quiz|null; leaders: User[]; rewards: Reward[]; sponsor: Sponsor|null; predictionsCount: number; }
export interface FunPost { _id: Id; caption?: string; imageUrl?: string; likeCount: number; shareCount: number; shareUrl: string; liked: boolean; isOwner: boolean; createdAt: string; owner: { _id: Id; firstName: string; clubName?: string; photoUrl?: string }; }
export interface FunFeedPage { items: FunPost[]; nextCursor: string|null; }
export interface CoinPackage { _id: Id; title: string; coins: number; price: number; originalPrice?: number; badge?: string; active: boolean; sortOrder: number; }
export interface CoinTransaction { _id: Id; type: 'purchase'|'daily_reward'; status: 'pending'|'processing'|'completed'|'failed'; coins: number; balanceAfter?: number; packageTitle?: string; price?: number; currency: 'IRT'; provider: 'test'|'none'; completedAt?: string; createdAt: string; }
export interface StoreData { balance: number; packages: CoinPackage[]; dailyReward: { amount: number; claimable: boolean; nextClaimAt: string|null }; transactions: CoinTransaction[]; paymentMode: 'test'|'unavailable'; }
export type BuiltInSquadFormation = '4-3-3'|'4-4-2'|'4-2-3-1'|'3-5-2'|'3-4-3'|'5-3-2'|'4-1-4-1';
export type SquadFormation = BuiltInSquadFormation|'custom';
export type TransferOfferStatus = 'active'|'accepted'|'rejected'|'cancelled'|'countered'|'expired';
export interface PlayerTransferOffer { _id: Id; amount: number; createdAt: string; expiresAt?: string; status: TransferOfferStatus; }
export interface PlayerTransferListing { isListed: boolean; askingPrice?: number; status?: 'active'|'negotiable'|'paused'|'sold'|'expired'; expiresAt?: string; }
export interface ClubPlayer { _id: Id; name: string; position: 'GK'|'RB'|'CB'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST'; overall: number; photoUrl?: string; nationality?: string; club?: string; marketValue?: number; contractStatus?: string; transferListing?: PlayerTransferListing; transferOffers?: PlayerTransferOffer[]; }
export interface ClubPlayersData { players: ClubPlayer[]; }
export interface TradeOfferView { _id: Id; direction: 'received'|'sent'; kind: 'buy'|'sell'; status: TransferOfferStatus; amount: number; createdAt: string; expiresAt: string; note?: string; parentOfferId?: Id; player: Pick<ClubPlayer, '_id'|'name'|'position'|'photoUrl'|'nationality'|'club'|'marketValue'|'contractStatus'>; counterparty: { _id: Id; name: string; username?: string; photoUrl?: string }; listingAskingPrice?: number; }
export interface TradeOffersData { received: TradeOfferView[]; sent: TradeOfferView[]; transferFeePercent: number; }
export interface TransferMarketListing { _id: Id; name: string; position: ClubPlayer['position']; photoUrl?: string; nationality?: string; club?: string; marketValue?: number; askingPrice?: number; status: 'active'|'negotiable'|'sold'; expiresAt?: string; sellerClub: string; activeOfferCount: number; ownedByCurrentUser: boolean; hasActiveOfferFromCurrentUser: boolean; }
export interface TransferMarketData { listings: TransferMarketListing[]; userBalance: number; }
export interface SquadPosition { role: string; x: number; y: number; }
export interface SavedSquadFormation { _id: Id; name: string; positions: SquadPosition[]; starters: Array<ClubPlayer|null>; }
export interface SquadData { formation: SquadFormation; starters: Array<ClubPlayer|null>; substitutes: ClubPlayer[]; customPositions: SquadPosition[]; savedFormations: SavedSquadFormation[]; updatedAt?: string; }
