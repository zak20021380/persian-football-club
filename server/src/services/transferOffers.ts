import mongoose, { type ClientSession, type Types } from 'mongoose';
import { ClubPlayer, Squad, TransferOffer, User, type TransferOfferStatus } from '../models/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const MIN_EXPIRY_MS = 5 * 60 * 1000;
const MAX_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateOfferInput {
  playerId: string;
  amount: number;
  expiresAt: Date;
  clientRequestId: string;
  note?: string;
}

export interface CounterOfferInput {
  amount: number;
  expiresAt: Date;
  clientRequestId: string;
}

export function calculateTransferSettlement(amount: number, feePercent: number) {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new AppError(422, 'مبلغ پیشنهاد نامعتبر است', 'INVALID_OFFER_AMOUNT');
  if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > 50) throw new AppError(500, 'کارمزد انتقال نامعتبر است', 'INVALID_TRANSFER_FEE');
  const feeAmount = Math.floor(amount * feePercent / 100);
  return { buyerDebit: amount, sellerCredit: amount - feeAmount, feeAmount };
}

export function assertOfferExpiration(expiresAt: Date, now = new Date()) {
  const duration = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(expiresAt.getTime()) || duration < MIN_EXPIRY_MS || duration > MAX_EXPIRY_MS) {
    throw new AppError(422, 'مهلت پیشنهاد باید بین ۵ دقیقه تا ۷ روز باشد', 'INVALID_OFFER_EXPIRY');
  }
}

export async function listTransferOffers(userId: Types.ObjectId) {
  const now = new Date();
  await TransferOffer.updateMany({ status: 'active', expiresAt: { $lte: now } }, { $set: { status: 'expired', resolvedAt: now } });
  const offers = await TransferOffer.find({ $or: [{ senderId: userId }, { recipientId: userId }] }).sort({ createdAt: -1 }).lean();
  const playerIds = [...new Set(offers.map(offer => String(offer.playerId)))];
  const partyIds = [...new Set(offers.flatMap(offer => [String(offer.senderId), String(offer.recipientId)]))];
  const [players, parties] = await Promise.all([
    ClubPlayer.find({ _id: { $in: playerIds } }).select('name position photoUrl nationality club marketValue contractStatus transferListing').lean(),
    User.find({ _id: { $in: partyIds } }).select('firstName lastName username photoUrl').lean(),
  ]);
  const playerById = new Map(players.map(player => [String(player._id), player]));
  const partyById = new Map(parties.map(party => [String(party._id), party]));
  const views = offers.flatMap(offer => {
    const player = playerById.get(String(offer.playerId));
    if (!player) return [];
    const direction = String(offer.senderId) === String(userId) ? 'sent' as const : 'received' as const;
    const counterpartyId = direction === 'sent' ? offer.recipientId : offer.senderId;
    const party = partyById.get(String(counterpartyId));
    const counterpartyName = [party?.firstName, party?.lastName].filter(Boolean).join(' ') || party?.username || 'باشگاه ناشناس';
    return [{
      _id: String(offer._id),
      direction,
      kind: String(offer.senderId) === String(offer.buyerId) ? 'buy' as const : 'sell' as const,
      status: offer.status,
      amount: offer.amount,
      createdAt: offer.createdAt,
      expiresAt: offer.expiresAt,
      note: offer.note,
      parentOfferId: offer.parentOfferId ? String(offer.parentOfferId) : undefined,
      player: {
        _id: String(player._id), name: player.name, position: player.position, photoUrl: player.photoUrl,
        nationality: player.nationality, club: player.club, marketValue: player.marketValue, contractStatus: player.contractStatus,
      },
      counterparty: { _id: String(counterpartyId), name: counterpartyName, username: party?.username, photoUrl: party?.photoUrl },
      listingAskingPrice: player.transferListing?.askingPrice,
    }];
  });
  return {
    received: views.filter(offer => offer.direction === 'received'),
    sent: views.filter(offer => offer.direction === 'sent'),
    transferFeePercent: env.TRANSFER_FEE_PERCENT,
  };
}

export async function listTransferMarket(userId: Types.ObjectId) {
  const now = new Date();
  await ClubPlayer.updateMany(
    { 'transferListing.isListed': true, 'transferListing.expiresAt': { $lte: now } },
    { $set: { 'transferListing.isListed': false, 'transferListing.status': 'expired' } }
  );
  const players = await ClubPlayer.find({
    $or: [
      { 'transferListing.isListed': true, 'transferListing.status': { $in: ['active', 'negotiable'] } },
      { 'transferListing.isListed': true, 'transferListing.status': { $exists: false } },
      { 'transferListing.status': 'sold' },
    ],
  }).sort({ updatedAt: -1 }).limit(100).lean();
  const playerIds = players.map(player => player._id);
  const sellerIds = [...new Set(players.map(player => String(player.transferListing?.sellerId ?? player.ownerId)))];
  const [sellers, activeOffers, currentUser] = await Promise.all([
    User.find({ _id: { $in: sellerIds } }).select('firstName lastName username favoriteTeam').lean(),
    TransferOffer.find({ playerId: { $in: playerIds }, status: 'active', expiresAt: { $gt: now } }).select('playerId buyerId').lean(),
    User.findById(userId).select('coinBalance').lean(),
  ]);
  const sellerById = new Map(sellers.map(seller => [String(seller._id), seller]));
  const offersByPlayer = new Map<string, typeof activeOffers>();
  activeOffers.forEach(offer => {
    const key = String(offer.playerId);
    offersByPlayer.set(key, [...(offersByPlayer.get(key) ?? []), offer]);
  });
  return {
    listings: players.map(player => {
      const listing = player.transferListing!;
      const sellerId = listing.sellerId ?? player.ownerId;
      const seller = sellerById.get(String(sellerId));
      const sellerName = [seller?.firstName, seller?.lastName].filter(Boolean).join(' ') || seller?.username;
      const playerOffers = offersByPlayer.get(String(player._id)) ?? [];
      return {
        _id: String(player._id),
        name: player.name,
        position: player.position,
        photoUrl: player.photoUrl,
        nationality: player.nationality,
        club: player.club,
        marketValue: player.marketValue,
        askingPrice: listing.askingPrice,
        status: listing.status ?? 'active',
        expiresAt: listing.expiresAt,
        sellerClub: seller?.favoriteTeam || sellerName || 'باشگاه ثبت نشده',
        activeOfferCount: playerOffers.length,
        ownedByCurrentUser: String(player.ownerId) === String(userId),
        hasActiveOfferFromCurrentUser: playerOffers.some(offer => String(offer.buyerId) === String(userId)),
      };
    }),
    userBalance: currentUser?.coinBalance ?? 0,
  };
}

export async function createTransferOffer(userId: Types.ObjectId, input: CreateOfferInput) {
  assertOfferExpiration(input.expiresAt);
  const existing = await TransferOffer.findOne({ senderId: userId, clientRequestId: input.clientRequestId });
  if (existing) return existing;
  const player = await ClubPlayer.findById(input.playerId).select('ownerId transferListing');
  if (!player) throw new AppError(404, 'بازیکن پیدا نشد', 'PLAYER_NOT_FOUND');
  if (String(player.ownerId) === String(userId)) throw new AppError(409, 'نمی‌توانید برای بازیکن خودتان پیشنهاد ثبت کنید', 'OWN_PLAYER_OFFER');
  const listingStatus = player.transferListing?.status ?? 'active';
  if (!player.transferListing?.isListed || !['active', 'negotiable'].includes(listingStatus) || (player.transferListing.expiresAt && player.transferListing.expiresAt <= new Date())) {
    throw new AppError(409, 'این بازیکن در بازار فعال نیست', 'PLAYER_NOT_LISTED');
  }
  if (listingStatus === 'active' && player.transferListing.askingPrice !== undefined && input.amount < player.transferListing.askingPrice) {
    throw new AppError(422, 'مبلغ پیشنهاد نباید از قیمت درخواستی کمتر باشد', 'OFFER_BELOW_ASKING_PRICE');
  }
  const buyer = await User.findById(userId).select('coinBalance');
  if (!buyer) throw new AppError(404, 'خریدار پیدا نشد', 'BUYER_NOT_FOUND');
  if (buyer.coinBalance < input.amount) throw new AppError(409, 'موجودی سکه برای این پیشنهاد کافی نیست', 'INSUFFICIENT_BALANCE');
  try {
    return await TransferOffer.create({
      playerId: player._id, buyerId: userId, sellerId: player.ownerId, senderId: userId, recipientId: player.ownerId,
      amount: input.amount, expiresAt: input.expiresAt, clientRequestId: input.clientRequestId, note: input.note,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const duplicate = await TransferOffer.findOne({ senderId: userId, clientRequestId: input.clientRequestId });
    if (duplicate) return duplicate;
    throw new AppError(409, 'برای این بازیکن یک پیشنهاد فعال دارید', 'ACTIVE_OFFER_EXISTS');
  }
}

export async function acceptTransferOffer(userId: Types.ObjectId, offerId: string) {
  return mongoose.connection.transaction(async session => {
    const now = new Date();
    const offer = await TransferOffer.findOne({ _id: offerId, recipientId: userId, status: 'active', expiresAt: { $gt: now } }).session(session);
    if (!offer) await throwOfferActionError(offerId, userId, 'recipient', session, now);
    const activeOffer = offer!;
    const player = await ClubPlayer.findById(activeOffer.playerId).session(session);
    if (!player) throw new AppError(404, 'بازیکن پیدا نشد', 'PLAYER_NOT_FOUND');
    if (String(player.ownerId) !== String(activeOffer.sellerId)) throw new AppError(409, 'مالکیت بازیکن تغییر کرده است', 'PLAYER_OWNERSHIP_CHANGED');
    const settlement = calculateTransferSettlement(activeOffer.amount, env.TRANSFER_FEE_PERCENT);
    const buyer = await User.findOneAndUpdate(
      { _id: activeOffer.buyerId, coinBalance: { $gte: settlement.buyerDebit } },
      { $inc: { coinBalance: -settlement.buyerDebit } },
      { new: true, session }
    );
    if (!buyer) throw new AppError(409, 'موجودی خریدار برای انجام معامله کافی نیست', 'INSUFFICIENT_BUYER_BALANCE');
    const seller = await User.findByIdAndUpdate(activeOffer.sellerId, { $inc: { coinBalance: settlement.sellerCredit } }, { new: true, session });
    if (!seller) throw new AppError(404, 'فروشنده پیدا نشد', 'SELLER_NOT_FOUND');

    player.ownerId = activeOffer.buyerId;
    player.transferListing = { ...player.transferListing, isListed: false, status: 'sold', sellerId: activeOffer.sellerId };
    await player.save({ session });
    await movePlayerBetweenSquads(activeOffer.playerId, activeOffer.sellerId, activeOffer.buyerId, session);

    activeOffer.status = 'accepted';
    activeOffer.feeAmount = settlement.feeAmount;
    activeOffer.resolvedAt = now;
    await activeOffer.save({ session });
    await TransferOffer.updateMany(
      { _id: { $ne: activeOffer._id }, playerId: activeOffer.playerId, status: 'active' },
      { $set: { status: 'cancelled', resolvedAt: now } },
      { session }
    );
    return {
      offerId: String(activeOffer._id), status: activeOffer.status, feeAmount: settlement.feeAmount,
      buyerBalance: buyer.coinBalance, sellerBalance: seller.coinBalance,
    };
  });
}

export async function rejectTransferOffer(userId: Types.ObjectId, offerId: string) {
  const now = new Date();
  const offer = await TransferOffer.findOneAndUpdate(
    { _id: offerId, recipientId: userId, status: 'active', expiresAt: { $gt: now } },
    { $set: { status: 'rejected', resolvedAt: now } },
    { new: true }
  );
  if (!offer) await throwOfferActionError(offerId, userId, 'recipient', null, now);
  return { offerId, status: 'rejected' as const };
}

export async function cancelTransferOffer(userId: Types.ObjectId, offerId: string) {
  const now = new Date();
  const offer = await TransferOffer.findOneAndUpdate(
    { _id: offerId, senderId: userId, status: 'active', expiresAt: { $gt: now } },
    { $set: { status: 'cancelled', resolvedAt: now } },
    { new: true }
  );
  if (!offer) await throwOfferActionError(offerId, userId, 'sender', null, now);
  return { offerId, status: 'cancelled' as const };
}

export async function counterTransferOffer(userId: Types.ObjectId, offerId: string, input: CounterOfferInput) {
  assertOfferExpiration(input.expiresAt);
  return mongoose.connection.transaction(async session => {
    const existing = await TransferOffer.findOne({ senderId: userId, clientRequestId: input.clientRequestId }).session(session);
    if (existing) return existing;
    const now = new Date();
    const original = await TransferOffer.findOne({ _id: offerId, recipientId: userId, status: 'active', expiresAt: { $gt: now } }).session(session);
    if (!original) await throwOfferActionError(offerId, userId, 'recipient', session, now);
    const source = original!;
    const player = await ClubPlayer.findById(source.playerId).select('ownerId').session(session);
    if (!player) throw new AppError(404, 'بازیکن پیدا نشد', 'PLAYER_NOT_FOUND');
    if (String(player.ownerId) !== String(source.sellerId)) throw new AppError(409, 'مالکیت بازیکن تغییر کرده است', 'PLAYER_OWNERSHIP_CHANGED');
    source.status = 'countered';
    source.resolvedAt = now;
    await source.save({ session });
    const [counter] = await TransferOffer.create([{
      playerId: source.playerId, buyerId: source.buyerId, sellerId: source.sellerId,
      senderId: userId, recipientId: source.senderId, amount: input.amount, expiresAt: input.expiresAt,
      parentOfferId: source._id, rootOfferId: source.rootOfferId ?? source._id, clientRequestId: input.clientRequestId,
    }], { session });
    return counter;
  });
}

async function throwOfferActionError(offerId: string, userId: Types.ObjectId, role: 'sender'|'recipient', session: ClientSession|null, now: Date): Promise<never> {
  const query = TransferOffer.findById(offerId);
  if (session) query.session(session);
  const offer = await query;
  if (!offer) throw new AppError(404, 'پیشنهاد پیدا نشد', 'OFFER_NOT_FOUND');
  if (String(offer[role === 'sender' ? 'senderId' : 'recipientId']) !== String(userId)) {
    throw new AppError(403, role === 'sender' ? 'فقط فرستنده می‌تواند پیشنهاد را لغو کند' : 'فقط گیرنده می‌تواند به پیشنهاد پاسخ دهد', 'OFFER_FORBIDDEN');
  }
  if (offer.status !== 'active') throw new AppError(409, 'این پیشنهاد دیگر فعال نیست', 'OFFER_NOT_ACTIVE');
  if (offer.expiresAt <= now) {
    offer.status = 'expired';
    offer.resolvedAt = now;
    await offer.save({ session: session ?? undefined });
    throw new AppError(409, 'مهلت این پیشنهاد تمام شده است', 'OFFER_EXPIRED');
  }
  throw new AppError(409, 'پیشنهاد قابل پردازش نیست', 'OFFER_UNAVAILABLE');
}

async function movePlayerBetweenSquads(playerId: Types.ObjectId, sellerId: Types.ObjectId, buyerId: Types.ObjectId, session: ClientSession) {
  const sellerSquad = await Squad.findOne({ userId: sellerId }).session(session);
  if (sellerSquad) {
    sellerSquad.starterIds = sellerSquad.starterIds.map(id => id && String(id) === String(playerId) ? null : id);
    sellerSquad.substituteIds = sellerSquad.substituteIds.filter(id => String(id) !== String(playerId));
    sellerSquad.savedFormations.forEach(saved => {
      saved.starterIds = saved.starterIds.map(id => id && String(id) === String(playerId) ? null : id);
    });
    await sellerSquad.save({ session });
  }
  await Squad.findOneAndUpdate(
    { userId: buyerId },
    {
      $setOnInsert: { formation: '4-3-3', starterIds: Array.from({ length: 11 }, () => null), customPositions: [], savedFormations: [] },
      $addToSet: { substituteIds: playerId },
    },
    { upsert: true, new: true, runValidators: true, session }
  );
}

export function isTerminalOfferStatus(status: TransferOfferStatus) {
  return status !== 'active';
}
