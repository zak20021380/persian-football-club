import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

export type StoredImage = { key: string; url: string };
export type StoredImageDownload = {
  stream: Readable;
  contentType: string;
  length: number;
  etag: string;
  uploadedAt: Date;
};

export interface ImageStorage {
  save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredImage>;
  read(key: string): Promise<Buffer>;
  open(key: string): Promise<StoredImageDownload>;
  delete(key: string): Promise<void>;
}

const bucketName = 'funImages';
const maximumStoredImageBytes = 5 * 1024 * 1024;

class MongoGridFsImageStorage implements ImageStorage {
  async save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredImage> {
    if (!buffer.length || buffer.length > maximumStoredImageBytes) throw new AppError(413, 'حجم تصویر ذخیره‌شده معتبر نیست', 'FUN_IMAGE_STORAGE_SIZE');
    const month = new Date().toISOString().slice(0, 7);
    const key = `fun/${month}/${crypto.randomUUID()}.${extension}`;
    const upload = gridFsBucket().openUploadStream(key, {
      chunkSizeBytes: 255 * 1024,
      metadata: { contentType: contentTypeForExtension(extension) }
    });
    await pipeline(Readable.from([buffer]), upload);
    return { key, url: `/uploads/${key}` };
  }

  async read(key: string): Promise<Buffer> {
    const file = await storedFile(key);
    if (!file) throw new AppError(404, 'تصویر ذخیره‌شده پیدا نشد', 'FUN_IMAGE_STORAGE_NOT_FOUND');
    if (file.length > maximumStoredImageBytes) throw new AppError(413, 'حجم تصویر ذخیره‌شده معتبر نیست', 'FUN_IMAGE_STORAGE_SIZE');
    const chunks: Buffer[] = [];
    for await (const chunk of gridFsBucket().openDownloadStream(file._id)) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async open(key: string): Promise<StoredImageDownload> {
    const file = await storedFile(key);
    if (!file) throw new AppError(404, 'تصویر پیدا نشد', 'FUN_IMAGE_STORAGE_NOT_FOUND');
    if (file.length <= 0 || file.length > maximumStoredImageBytes) throw new AppError(413, 'حجم تصویر ذخیره‌شده معتبر نیست', 'FUN_IMAGE_STORAGE_SIZE');
    const metadata = file.metadata as { contentType?: unknown } | undefined;
    const contentType = typeof metadata?.contentType === 'string' && ['image/jpeg', 'image/png', 'image/webp'].includes(metadata.contentType)
      ? metadata.contentType
      : contentTypeForKey(key);
    return {
      stream: gridFsBucket().openDownloadStream(file._id),
      contentType,
      length: file.length,
      etag: String(file._id),
      uploadedAt: file.uploadDate
    };
  }

  async delete(key: string): Promise<void> {
    const file = await storedFile(key);
    if (file) await gridFsBucket().delete(file._id);
  }
}

function gridFsBucket(): mongoose.mongo.GridFSBucket {
  const database = mongoose.connection.db;
  if (!database) throw new AppError(503, 'فضای ذخیره‌سازی تصاویر در دسترس نیست', 'FUN_IMAGE_STORAGE_UNAVAILABLE');
  return new mongoose.mongo.GridFSBucket(database, { bucketName });
}

async function storedFile(key: string): Promise<mongoose.mongo.GridFSFile | null> {
  const safe = safeKey(key);
  return gridFsBucket().find({ filename: safe }, { limit: 1 }).next();
}

function safeKey(key: string): string {
  const normalized = key.replaceAll('\\', '/');
  if (!/^fun\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(normalized)) throw new AppError(400, 'شناسه تصویر نامعتبر است', 'FUN_IMAGE_STORAGE_KEY');
  return normalized;
}

function contentTypeForExtension(extension: 'jpg' | 'png' | 'webp'): string {
  return extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
}

function contentTypeForKey(key: string): string {
  if (/\.png$/i.test(key)) return 'image/png';
  if (/\.webp$/i.test(key)) return 'image/webp';
  return 'image/jpeg';
}

export const imageStorage: ImageStorage = new MongoGridFsImageStorage();
