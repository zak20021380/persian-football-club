import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { requireConfirmedMembership, verifyLiveMembership } from '../middleware/auth.js';
import { Referral } from '../models/index.js';
import { checkChannelMembership, isAcceptedMember } from '../services/membership.js';
import { rewardPendingReferral } from '../services/referral.js';

afterEach(() => vi.restoreAllMocks());

describe('forced membership', () => {
  it.each([['creator', true], ['administrator', true], ['member', true], ['left', false], ['kicked', false]] as const)(
    '%s maps to %s',
    (status, expected) => expect(isAcceptedMember(status)).toBe(expected)
  );

  it('accepts restricted users only when is_member is true', () => {
    expect(isAcceptedMember('restricted', true)).toBe(true);
    expect(isAcceptedMember('restricted', false)).toBe(false);
  });

  it('bypasses stored and live membership gates when enforcement is disabled', () => {
    expect(env.CHANNEL_MEMBERSHIP_REQUIRED).toBe(false);
    const next = vi.fn() as unknown as NextFunction;
    requireConfirmedMembership({} as Request, {} as Response, next);
    verifyLiveMembership({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it('does not call Telegram when enforcement is disabled', async () => {
    const getChatMember = vi.fn();
    await expect(checkChannelMembership({ getChatMember } as never, 123)).resolves.toBe(true);
    expect(getChatMember).not.toHaveBeenCalled();
  });

  it('does not issue referral rewards while membership enforcement is disabled', async () => {
    const lookup = vi.spyOn(Referral, 'findOneAndUpdate');
    await expect(rewardPendingReferral(new mongoose.Types.ObjectId())).resolves.toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });
});
