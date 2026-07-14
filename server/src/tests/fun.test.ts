import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { FunPost, FunPostShare } from '../models/index.js';
import { detectImage, toTelegramShareJpeg, validateFunImage } from '../services/funImage.js';
import { sanitizeFunCaption } from '../services/fun.js';
import {
  buildFunDeepLink,
  buildFunInlinePhotoResult,
  buildSavePreparedMessageBody,
  completeFunPostShare,
  FUN_SHARE_COMPLETION_TTL_MS,
  hashCompletionToken
} from '../services/funShare.js';

afterEach(() => vi.restoreAllMocks());

function png(): Buffer {
  const buffer = Buffer.alloc(45);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(1, 16); buffer.writeUInt32BE(1, 20);
  buffer.write('IEND', 37, 'ascii');
  return buffer;
}

function jpeg(): Buffer {
  const buffer = Buffer.alloc(20);
  buffer[0] = 0xff; buffer[1] = 0xd8; buffer[2] = 0xff; buffer[3] = 0xc0;
  buffer.writeUInt16BE(1, 7); buffer.writeUInt16BE(1, 9);
  buffer[18] = 0xff; buffer[19] = 0xd9;
  return buffer;
}

function webp(): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii'); buffer.writeUInt32LE(22, 4); buffer.write('WEBP', 8, 'ascii'); buffer.write('VP8X', 12, 'ascii');
  return buffer;
}

describe('fun image validation', () => {
  it('detects the three allowed image formats', () => {
    expect(detectImage(png())?.mime).toBe('image/png');
    expect(detectImage(jpeg())?.mime).toBe('image/jpeg');
    expect(detectImage(webp())?.mime).toBe('image/webp');
  });

  it('rejects GIF and arbitrary content even when MIME is forged', () => {
    const gif = Buffer.from('GIF89a fake image');
    expect(() => validateFunImage({ buffer: gif, size: gif.length, mimetype: 'image/png', originalname: 'fake.png' })).toThrow('محتوای فایل');
    expect(() => validateFunImage({ buffer: gif, size: gif.length, mimetype: 'image/gif', originalname: 'fake.gif' })).toThrow('فقط تصویر');
  });

  it('rejects a valid image with a mismatched MIME or extension', () => {
    const file = png();
    expect(() => validateFunImage({ buffer: file, size: file.length, mimetype: 'image/jpeg', originalname: 'photo.jpg' })).toThrow('محتوای فایل');
    expect(() => validateFunImage({ buffer: file, size: file.length, mimetype: 'image/png', originalname: 'photo.webp' })).toThrow('پسوند فایل');
  });
});

describe('fun caption sanitization', () => {
  it('normalizes plain text and removes markup and control characters', () => {
    expect(sanitizeFunCaption('  <script>گل\u0000 بود!</script>  ')).toBe('scriptگل بود!/script');
  });

  it('treats an empty sanitized caption as absent', () => {
    expect(sanitizeFunCaption(' <> \n ')).toBeUndefined();
  });

  it('rejects captions beyond the storage limit', () => {
    expect(() => sanitizeFunCaption('ف'.repeat(601))).toThrow('حداکثر ۶۰۰');
  });
});

describe('fun Telegram sharing payload', () => {
  it('builds an exact meme deep link without hardcoding a deployment URL', () => {
    expect(buildFunDeepLink('507f1f77bcf86cd799439011')).toBe('https://t.me/test_bot/test_app?startapp=fun_507f1f77bcf86cd799439011');
  });

  it('builds a JPEG photo result with caption, brand footer and deep-link button', () => {
    const result = buildFunInlinePhotoResult({
      postId: '507f1f77bcf86cd799439011',
      caption: 'میم تستی',
      imageUrl: 'https://example.com/meme.jpg',
      deepLink: 'https://t.me/test_bot/test_app?startapp=fun_507f1f77bcf86cd799439011'
    });
    expect(result.type).toBe('photo');
    expect(result.photo_url).toBe('https://example.com/meme.jpg');
    expect(result.thumbnail_url).toBe(result.photo_url);
    expect(result.caption).toContain('میم تستی');
    expect(result.caption).toContain('باشگاه فوتبالی');
    expect(result.reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'مشاهده میم ⚽',
      url: 'https://t.me/test_bot/test_app?startapp=fun_507f1f77bcf86cd799439011'
    });
    expect(Buffer.byteLength(result.id)).toBeLessThanOrEqual(64);
  });

  it('allows users, groups and channels while keeping bot chats disabled', () => {
    const result = buildFunInlinePhotoResult({ postId: '507f1f77bcf86cd799439011', imageUrl: 'https://example.com/meme.jpg', deepLink: 'https://t.me/test_bot/test_app' });
    expect(buildSavePreparedMessageBody(123456, result)).toMatchObject({
      user_id: 123456,
      allow_user_chats: true,
      allow_bot_chats: false,
      allow_group_chats: true,
      allow_channel_chats: true
    });
  });

  it('converts PNG and WEBP content to a Telegram-compatible JPEG under 5MB', async () => {
    const source = await sharp({ create: { width: 24, height: 24, channels: 4, background: '#ff00aa80' } }).webp().toBuffer();
    const converted = await toTelegramShareJpeg(source);
    expect(detectImage(converted)?.mime).toBe('image/jpeg');
    expect(converted.length).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it('uses a short-lived hashed completion token', () => {
    const token = 'a'.repeat(43);
    expect(FUN_SHARE_COMPLETION_TTL_MS).toBe(10 * 60 * 1_000);
    expect(hashCompletionToken(token)).toMatch(/^[a-f\d]{64}$/);
    expect(hashCompletionToken(token)).not.toContain(token);
  });

  it('atomically binds completion to the authenticated user, post and one pending token', async () => {
    const postId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();
    const completionToken = 'b'.repeat(43);
    const session = {} as mongoose.ClientSession;
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async callback => callback(session));
    const shareUpdate = vi.spyOn(FunPostShare, 'findOneAndUpdate').mockResolvedValue({ status: 'completed' } as never);
    const lean = vi.fn().mockResolvedValue({ shareCount: 9 });
    vi.spyOn(FunPost, 'findOneAndUpdate').mockReturnValue({ lean } as never);

    await expect(completeFunPostShare({ postId, userId, completionToken })).resolves.toEqual({ shareCount: 9, counted: true });
    expect(shareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        postId,
        userId,
        completionTokenHash: hashCompletionToken(completionToken),
        status: 'pending',
        expiresAt: { $gt: expect.any(Date) }
      }),
      { $set: { status: 'completed', completedAt: expect.any(Date) } },
      { new: true, session }
    );
    expect(FunPost.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: postId },
      { $inc: { shareCount: 1 } },
      { new: true, session, projection: { shareCount: 1 } }
    );
  });

  it('returns an idempotent result without incrementing twice for a completed token', async () => {
    const postId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();
    const completionToken = 'c'.repeat(43);
    const session = {} as mongoose.ClientSession;
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async callback => callback(session));
    vi.spyOn(FunPostShare, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(FunPostShare, 'findOne').mockResolvedValue({ status: 'completed' } as never);
    const lean = vi.fn().mockResolvedValue({ shareCount: 4 });
    vi.spyOn(FunPost, 'findOne').mockReturnValue({ lean } as never);
    const increment = vi.spyOn(FunPost, 'findOneAndUpdate');

    await expect(completeFunPostShare({ postId, userId, completionToken })).resolves.toEqual({ shareCount: 4, counted: false });
    expect(increment).not.toHaveBeenCalled();
  });
});
