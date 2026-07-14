import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { FunPost, FunPostLike, FunPostShare } from '../models/index.js';
import { detectImage, toTelegramShareJpeg, validateFunImage } from '../services/funImage.js';
import { listFunPosts, sanitizeFunCaption } from '../services/fun.js';
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

describe('listFunPosts sort', () => {
  const userId = new mongoose.Types.ObjectId();

  function buildChain(posts: Array<{ _id: string; likeCount: number }>) {
    const sortFn = vi.fn().mockReturnThis();
    const limitFn = vi.fn().mockReturnThis();
    const populateFn = vi.fn().mockReturnThis();
    const leanFn = vi.fn().mockResolvedValue(posts.map(post => ({ _id: new mongoose.Types.ObjectId(post._id), likeCount: post.likeCount, ownerId: { _id: new mongoose.Types.ObjectId() } })));
    vi.spyOn(FunPost, 'find').mockReturnValue({ sort: sortFn, limit: limitFn, populate: populateFn, lean: leanFn } as never);
    vi.spyOn(FunPostLike, 'find').mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) } as never);
    return { sortFn };
  }

  it('sorts by _id desc for newest and encodes the next cursor as the last _id', async () => {
    const lastId = new mongoose.Types.ObjectId().toString();
    const { sortFn } = buildChain([
      { _id: new mongoose.Types.ObjectId().toString(), likeCount: 1 },
      { _id: lastId, likeCount: 1 },
      { _id: new mongoose.Types.ObjectId().toString(), likeCount: 99 }
    ]);
    const result = await listFunPosts(userId, undefined, 2, 'newest');
    expect(sortFn).toHaveBeenCalledWith({ _id: -1 });
    expect(result.nextCursor).toBe(lastId);
  });

  it('sorts by _id asc for oldest and applies a greater-than cursor', async () => {
    const { sortFn } = buildChain([
      { _id: new mongoose.Types.ObjectId().toString(), likeCount: 1 }
    ]);
    const cursorId = new mongoose.Types.ObjectId().toString();
    await listFunPosts(userId, cursorId, 10, 'oldest');
    expect(sortFn).toHaveBeenCalledWith({ _id: 1 });
    const findCall = (FunPost.find as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(findCall._id).toEqual({ $gt: expect.any(mongoose.Types.ObjectId) });
  });

  it('sorts by likeCount desc, then _id desc for mostLiked and encodes a compound cursor', async () => {
    const lastId = new mongoose.Types.ObjectId().toString();
    const { sortFn } = buildChain([
      { _id: new mongoose.Types.ObjectId().toString(), likeCount: 50 },
      { _id: lastId, likeCount: 10 },
      { _id: new mongoose.Types.ObjectId().toString(), likeCount: 1 }
    ]);
    const result = await listFunPosts(userId, undefined, 2, 'mostLiked');
    expect(sortFn).toHaveBeenCalledWith({ likeCount: -1, _id: -1 });
    expect(result.nextCursor).toBe(`10_${lastId}`);
  });

  it('parses the mostLiked compound cursor and applies the correct $or filter', async () => {
    const { sortFn } = buildChain([{ _id: new mongoose.Types.ObjectId().toString(), likeCount: 0 }]);
    const cursorId = new mongoose.Types.ObjectId().toString();
    await listFunPosts(userId, `25_${cursorId}`, 10, 'mostLiked');
    expect(sortFn).toHaveBeenCalledWith({ likeCount: -1, _id: -1 });
    const findCall = (FunPost.find as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(findCall.$or).toEqual([
      { likeCount: { $lt: 25 } },
      { likeCount: 25, _id: { $lt: expect.any(mongoose.Types.ObjectId) } }
    ]);
  });

  it('rejects an invalid mostLiked cursor with a 400', async () => {
    buildChain([]);
    await expect(listFunPosts(userId, 'not-a-cursor', 10, 'mostLiked')).rejects.toMatchObject({ statusCode: 400, code: 'FUN_CURSOR_INVALID' });
  });
});
