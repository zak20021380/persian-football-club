import mongoose from 'mongoose';
import { FunPost, FunPostLike, FunPostReport, FunPostShare } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { toTelegramShareJpeg, validateFunImage, type FunImageFile } from './funImage.js';
import { imageStorage } from './storage.js';
import { buildFunDeepLink } from './funShare.js';

type ObjectId = mongoose.Types.ObjectId;
type ReportReason = 'spam' | 'abuse' | 'inappropriate' | 'other';

export function sanitizeFunCaption(input?: string): string | undefined {
  if (!input) return undefined;
  const normalized = input.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[<>]/g, '');
  const clean = Array.from(normalized).filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || (code >= 32 && code !== 127);
  }).join('').trim();
  if (!clean) return undefined;
  if (clean.length > 600) throw new AppError(400, 'متن پست حداکثر ۶۰۰ نویسه است', 'FUN_CAPTION_TOO_LONG');
  return clean;
}

export async function createFunPost(input: { ownerId: ObjectId; caption?: string; file?: FunImageFile; clientRequestId: string }) {
  const caption = sanitizeFunCaption(input.caption);
  if (!caption && !input.file) throw new AppError(400, 'برای پست، متن یا تصویر وارد کنید', 'FUN_CONTENT_REQUIRED');

  const existing = await FunPost.findOne({ ownerId: input.ownerId, clientRequestId: input.clientRequestId });
  if (existing) return { post: existing, created: false };

  let stored: Awaited<ReturnType<typeof imageStorage.save>> | undefined;
  if (input.file) {
    validateFunImage(input.file);
    const jpeg = await toTelegramShareJpeg(input.file.buffer);
    stored = await imageStorage.save(jpeg, 'jpg');
  }

  try {
    const post = await FunPost.create({
      ownerId: input.ownerId,
      caption,
      imageUrl: stored?.url,
      imageKey: stored?.key,
      clientRequestId: input.clientRequestId
    });
    return { post, created: true };
  } catch (error) {
    if (stored) await imageStorage.delete(stored.key);
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await FunPost.findOne({ ownerId: input.ownerId, clientRequestId: input.clientRequestId });
      if (duplicate) return { post: duplicate, created: false };
    }
    throw error;
  }
}

export async function listFunPosts(userId: ObjectId, cursor: string | undefined, limit: number) {
  const query: Record<string, unknown> = { moderationStatus: 'published' };
  if (cursor) query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  const posts = await FunPost.find(query).sort({ _id: -1 }).limit(limit + 1).populate('ownerId', 'displayName clubName favoriteTeam').lean();
  const page = posts.slice(0, limit);
  const likes = await FunPostLike.find({ userId, postId: { $in: page.map((post) => post._id) } }).select('postId').lean();
  const likedIds = new Set(likes.map((like) => String(like.postId)));
  return {
    items: page.map((post) => funPostView(post, userId, likedIds.has(String(post._id)))),
    nextCursor: posts.length > limit ? String(page.at(-1)!._id) : null
  };
}

export async function funPostById(postId: string, userId: ObjectId) {
  const post = await FunPost.findOne({ _id: postId, moderationStatus: 'published' }).populate('ownerId', 'displayName clubName favoriteTeam').lean();
  if (!post) throw new AppError(404, 'پست فان پیدا نشد', 'FUN_POST_NOT_FOUND');
  const liked = Boolean(await FunPostLike.exists({ postId: post._id, userId }));
  return funPostView(post, userId, liked);
}

export async function setFunPostLike(postId: string, userId: ObjectId, liked: boolean) {
  const post = await FunPost.findOne({ _id: postId, moderationStatus: 'published' });
  if (!post) throw new AppError(404, 'پست فان پیدا نشد', 'FUN_POST_NOT_FOUND');
  if (liked) {
    const result = await FunPostLike.updateOne({ postId: post._id, userId }, { $setOnInsert: { postId: post._id, userId, createdAt: new Date() } }, { upsert: true });
    if (result.upsertedCount) await FunPost.updateOne({ _id: post._id }, { $inc: { likeCount: 1 } });
  } else {
    const result = await FunPostLike.deleteOne({ postId: post._id, userId });
    if (result.deletedCount) await FunPost.updateOne({ _id: post._id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
  }
  const current = await FunPost.findById(post._id).select('likeCount').lean();
  return { liked, likeCount: current?.likeCount ?? 0 };
}

export async function reportFunPost(postId: string, reporterId: ObjectId, reason: ReportReason) {
  const post = await FunPost.findOne({ _id: postId, moderationStatus: 'published' });
  if (!post) throw new AppError(404, 'پست فان پیدا نشد', 'FUN_POST_NOT_FOUND');
  if (String(post.ownerId) === String(reporterId)) throw new AppError(400, 'امکان گزارش پست خودتان وجود ندارد', 'FUN_REPORT_OWN');
  try {
    const result = await FunPostReport.updateOne({ postId: post._id, reporterId }, { $setOnInsert: { postId: post._id, reporterId, reason, createdAt: new Date() } }, { upsert: true });
    if (!result.upsertedCount) throw new AppError(409, 'این پست قبلاً گزارش شده است', 'FUN_ALREADY_REPORTED');
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as { code?: number }).code === 11000) throw new AppError(409, 'این پست قبلاً گزارش شده است', 'FUN_ALREADY_REPORTED');
    throw error;
  }
  await FunPost.updateOne({ _id: post._id }, { $inc: { reportCount: 1 } });
}

export async function deleteFunPost(postId: string, requesterId: ObjectId, admin = false) {
  const post = await FunPost.findById(postId);
  if (!post) throw new AppError(404, 'پست فان پیدا نشد', 'FUN_POST_NOT_FOUND');
  if (!admin && String(post.ownerId) !== String(requesterId)) throw new AppError(403, 'فقط صاحب پست می‌تواند آن را حذف کند', 'FUN_DELETE_FORBIDDEN');
  await Promise.all([
    FunPost.deleteOne({ _id: post._id }),
    FunPostLike.deleteMany({ postId: post._id }),
    FunPostReport.deleteMany({ postId: post._id }),
    FunPostShare.deleteMany({ postId: post._id })
  ]);
  if (post.imageKey) await imageStorage.delete(post.imageKey);
}

export async function listFunModeration(page: number, limit: number, reportedOnly: boolean) {
  const query = reportedOnly ? { reportCount: { $gt: 0 } } : {};
  const [items, total] = await Promise.all([
    FunPost.find(query).sort({ reportCount: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('ownerId', 'displayName clubName favoriteTeam').lean(),
    FunPost.countDocuments(query)
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export async function moderateFunPost(postId: string, moderationStatus: 'published' | 'hidden') {
  const post = await FunPost.findByIdAndUpdate(postId, { $set: { moderationStatus } }, { new: true, runValidators: true });
  if (!post) throw new AppError(404, 'پست فان پیدا نشد', 'FUN_POST_NOT_FOUND');
  return post;
}

function funPostView(post: any, viewerId: ObjectId, liked: boolean) {
  const owner = post.ownerId && typeof post.ownerId === 'object' && '_id' in post.ownerId ? post.ownerId : null;
  const ownerName = owner?.displayName || owner?.clubName || owner?.favoriteTeam || 'بازیکن باشگاه';
  return {
    _id: String(post._id),
    caption: post.caption,
    imageUrl: post.imageUrl,
    likeCount: post.likeCount,
    shareCount: post.shareCount ?? 0,
    shareUrl: buildFunDeepLink(String(post._id)),
    createdAt: post.createdAt,
    liked,
    isOwner: String(owner?._id ?? post.ownerId) === String(viewerId),
    owner: owner ? { _id: String(owner._id), firstName: ownerName, clubName: owner.clubName } : { _id: String(post.ownerId), firstName: 'بازیکن باشگاه' }
  };
}
