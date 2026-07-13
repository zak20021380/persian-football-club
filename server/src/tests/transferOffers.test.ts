import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClubPlayer, Squad, TransferOffer, User } from '../models/index.js';
import { acceptTransferOffer, assertOfferExpiration, calculateTransferSettlement, cancelTransferOffer, createTransferOffer, rejectTransferOffer } from '../services/transferOffers.js';

afterEach(() => vi.restoreAllMocks());

describe('transfer offer validation', () => {
  it('requires distinct buyer and seller identities', async () => {
    const userId = new Types.ObjectId();
    const offer = new TransferOffer({ playerId: new Types.ObjectId(), buyerId: userId, sellerId: userId, senderId: userId, recipientId: new Types.ObjectId(), amount: 100, expiresAt: new Date(Date.now() + 60_000), clientRequestId: crypto.randomUUID() });
    await expect(offer.validate()).rejects.toThrow('خریدار و فروشنده باید متفاوت باشند');
  });

  it('rejects invalid amounts and unsupported statuses', () => {
    const buyerId = new Types.ObjectId();
    const sellerId = new Types.ObjectId();
    const offer = new TransferOffer({ playerId: new Types.ObjectId(), buyerId, sellerId, senderId: buyerId, recipientId: sellerId, amount: 0, status: 'unknown', expiresAt: new Date(Date.now() + 60_000), clientRequestId: crypto.randomUUID() });
    const errors = offer.validateSync()?.errors;
    expect(errors?.amount).toBeTruthy();
    expect(errors?.status).toBeTruthy();
  });

  it('has unique indexes for request idempotency and one active buyer offer per player', () => {
    const indexes = TransferOffer.schema.indexes();
    expect(indexes.some(([fields, options]) => fields.senderId === 1 && fields.clientRequestId === 1 && options.unique)).toBe(true);
    expect(indexes.some(([fields, options]) => fields.playerId === 1 && fields.buyerId === 1 && options.unique && options.partialFilterExpression?.status === 'active')).toBe(true);
  });

  it('calculates the configured fee without creating coins', () => {
    expect(calculateTransferSettlement(9_150, 5)).toEqual({ buyerDebit: 9_150, sellerCredit: 8_693, feeAmount: 457 });
  });

  it('accepts only bounded future expirations', () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    expect(() => assertOfferExpiration(new Date(now.getTime() + 4 * 60_000), now)).toThrow('۵ دقیقه');
    expect(() => assertOfferExpiration(new Date(now.getTime() + 8 * 24 * 60 * 60_000), now)).toThrow('۷ روز');
    expect(() => assertOfferExpiration(new Date(now.getTime() + 24 * 60 * 60_000), now)).not.toThrow();
  });
});

describe('atomic offer acceptance', () => {
  it('checks recipient, ownership and buyer balance before transferring player and coins', async () => {
    const offerId = new Types.ObjectId();
    const playerId = new Types.ObjectId();
    const buyerId = new Types.ObjectId();
    const sellerId = new Types.ObjectId();
    const offer = { _id: offerId, playerId, buyerId, sellerId, recipientId: sellerId, senderId: buyerId, status: 'active', amount: 1_000, expiresAt: new Date(Date.now() + 60_000), save: vi.fn() };
    const player = { _id: playerId, ownerId: sellerId, transferListing: { isListed: true, status: 'active' }, save: vi.fn() };
    const session = {};
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async callback => callback(session as never));
    vi.spyOn(TransferOffer, 'findOne').mockReturnValue({ session: vi.fn().mockResolvedValue(offer) } as never);
    vi.spyOn(ClubPlayer, 'findById').mockReturnValue({ session: vi.fn().mockResolvedValue(player) } as never);
    const buyerUpdate = vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ coinBalance: 4_000 } as never);
    vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({ coinBalance: 950 } as never);
    vi.spyOn(Squad, 'findOne').mockReturnValue({ session: vi.fn().mockResolvedValue(null) } as never);
    vi.spyOn(Squad, 'findOneAndUpdate').mockResolvedValue({} as never);
    const cancelConflicts = vi.spyOn(TransferOffer, 'updateMany').mockResolvedValue({ modifiedCount: 2 } as never);

    const result = await acceptTransferOffer(sellerId, String(offerId));

    expect(buyerUpdate).toHaveBeenCalledWith({ _id: buyerId, coinBalance: { $gte: 1_000 } }, { $inc: { coinBalance: -1_000 } }, expect.objectContaining({ session }));
    expect(player.ownerId).toEqual(buyerId);
    expect(player.transferListing).toEqual({ isListed: false, status: 'sold', sellerId });
    expect(offer.status).toBe('accepted');
    expect(cancelConflicts).toHaveBeenCalledWith({ _id: { $ne: offerId }, playerId, status: 'active' }, expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelled' }) }), { session });
    expect(result.feeAmount).toBe(50);
  });

  it('aborts before ownership transfer when the buyer balance is insufficient', async () => {
    const offerId = new Types.ObjectId();
    const playerId = new Types.ObjectId();
    const buyerId = new Types.ObjectId();
    const sellerId = new Types.ObjectId();
    const offer = { _id: offerId, playerId, buyerId, sellerId, recipientId: sellerId, senderId: buyerId, status: 'active', amount: 2_000, expiresAt: new Date(Date.now() + 60_000), save: vi.fn() };
    const player = { _id: playerId, ownerId: sellerId, transferListing: { isListed: true, status: 'active' }, save: vi.fn() };
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async callback => callback({} as never));
    vi.spyOn(TransferOffer, 'findOne').mockReturnValue({ session: vi.fn().mockResolvedValue(offer) } as never);
    vi.spyOn(ClubPlayer, 'findById').mockReturnValue({ session: vi.fn().mockResolvedValue(player) } as never);
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);

    await expect(acceptTransferOffer(sellerId, String(offerId))).rejects.toMatchObject({ code: 'INSUFFICIENT_BUYER_BALANCE' });
    expect(player.save).not.toHaveBeenCalled();
    expect(offer.save).not.toHaveBeenCalled();
  });
});

describe('offer action ownership', () => {
  it('allows cancellation only through an active sender-owned offer filter', async () => {
    const senderId = new Types.ObjectId();
    const offerId = new Types.ObjectId();
    const update = vi.spyOn(TransferOffer, 'findOneAndUpdate').mockResolvedValue({ _id: offerId } as never);
    await expect(cancelTransferOffer(senderId, String(offerId))).resolves.toEqual({ offerId: String(offerId), status: 'cancelled' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ _id: String(offerId), senderId, status: 'active', expiresAt: expect.any(Object) }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelled' }) }),
      { new: true }
    );
  });

  it('allows rejection only through an active recipient-owned offer filter', async () => {
    const recipientId = new Types.ObjectId();
    const offerId = new Types.ObjectId();
    const update = vi.spyOn(TransferOffer, 'findOneAndUpdate').mockResolvedValue({ _id: offerId } as never);
    await expect(rejectTransferOffer(recipientId, String(offerId))).resolves.toEqual({ offerId: String(offerId), status: 'rejected' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ _id: String(offerId), recipientId, status: 'active', expiresAt: expect.any(Object) }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'rejected' }) }),
      { new: true }
    );
  });
});

describe('market offer rules', () => {
  it('accepts the negotiable listing status in the player schema', () => {
    const player = new ClubPlayer({ ownerId: new Types.ObjectId(), name: 'بازیکن بازار', position: 'CM', overall: 70, transferListing: { isListed: true, status: 'negotiable', askingPrice: 500 } });
    expect(player.validateSync()?.errors['transferListing.status']).toBeUndefined();
  });

  it('rejects an offer below the fixed asking price before checking out', async () => {
    const buyerId = new Types.ObjectId();
    const sellerId = new Types.ObjectId();
    vi.spyOn(TransferOffer, 'findOne').mockResolvedValue(null);
    vi.spyOn(ClubPlayer, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(), ownerId: sellerId, transferListing: { isListed: true, status: 'active', askingPrice: 1_000 } }) } as never);
    const userLookup = vi.spyOn(User, 'findById');
    await expect(createTransferOffer(buyerId, { playerId: String(new Types.ObjectId()), amount: 900, expiresAt: new Date(Date.now() + 60 * 60_000), clientRequestId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'OFFER_BELOW_ASKING_PRICE' });
    expect(userLookup).not.toHaveBeenCalled();
  });
});
