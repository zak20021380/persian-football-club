import path from 'node:path';
import sharp from 'sharp';
import { AppError } from '../utils/errors.js';

export const FUN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FUN_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type FunImageMime = typeof FUN_IMAGE_MIME_TYPES[number];
type FunImageExtension = 'jpg' | 'png' | 'webp';

export interface FunImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export function validateFunImage(file: FunImageFile): { mime: FunImageMime; extension: FunImageExtension } {
  if (file.size <= 0 || file.size > FUN_IMAGE_MAX_BYTES) throw new AppError(413, 'حجم تصویر باید کمتر از ۵ مگابایت باشد', 'FUN_IMAGE_TOO_LARGE');
  if (!FUN_IMAGE_MIME_TYPES.includes(file.mimetype as FunImageMime)) throw new AppError(415, 'فقط تصویر JPG، PNG یا WEBP مجاز است', 'FUN_IMAGE_TYPE');

  const detected = detectImage(file.buffer);
  if (!detected || detected.mime !== file.mimetype) throw new AppError(415, 'محتوای فایل با یک تصویر معتبر مطابقت ندارد', 'FUN_IMAGE_SIGNATURE');

  const originalExtension = path.extname(file.originalname).slice(1).toLowerCase();
  const allowedExtensions = detected.extension === 'jpg' ? ['jpg', 'jpeg'] : [detected.extension];
  if (!allowedExtensions.includes(originalExtension)) throw new AppError(415, 'پسوند فایل تصویر معتبر نیست', 'FUN_IMAGE_EXTENSION');
  return detected;
}

export function detectImage(buffer: Buffer): { mime: FunImageMime; extension: FunImageExtension } | null {
  if (isPng(buffer)) return { mime: 'image/png', extension: 'png' };
  if (isJpeg(buffer)) return { mime: 'image/jpeg', extension: 'jpg' };
  if (isWebp(buffer)) return { mime: 'image/webp', extension: 'webp' };
  return null;
}

export async function toTelegramShareJpeg(buffer: Buffer): Promise<Buffer> {
  const attempts = [
    { width: 2_000, quality: 85 },
    { width: 1_600, quality: 76 },
    { width: 1_280, quality: 68 }
  ];
  for (const attempt of attempts) {
    const jpeg = await sharp(buffer, { failOn: 'warning', limitInputPixels: 40_000_000 })
      .rotate()
      .flatten({ background: '#101827' })
      .resize({ width: attempt.width, height: attempt.width, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();
    if (jpeg.length <= FUN_IMAGE_MAX_BYTES) return jpeg;
  }
  throw new AppError(413, 'تبدیل تصویر به نسخه قابل اشتراک تلگرام ممکن نشد', 'FUN_SHARE_IMAGE_TOO_LARGE');
}

function isPng(buffer: Buffer): boolean {
  if (buffer.length < 45) return false;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const hasSignature = buffer.subarray(0, 8).equals(signature);
  const hasHeader = buffer.subarray(12, 16).toString('ascii') === 'IHDR' && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0;
  const hasEnd = buffer.subarray(buffer.length - 8, buffer.length - 4).toString('ascii') === 'IEND';
  return hasSignature && hasHeader && hasEnd;
}

function isJpeg(buffer: Buffer): boolean {
  if (buffer.length < 16 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) return false;
  for (let index = 2; index < buffer.length - 9; index += 1) {
    if (buffer[index] !== 0xff || ![0xc0, 0xc1, 0xc2].includes(buffer[index + 1])) continue;
    return buffer.readUInt16BE(index + 5) > 0 && buffer.readUInt16BE(index + 7) > 0;
  }
  return false;
}

function isWebp(buffer: Buffer): boolean {
  if (buffer.length < 30) return false;
  const container = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const chunk = buffer.subarray(12, 16).toString('ascii');
  const declaredSize = buffer.readUInt32LE(4) + 8;
  return container && ['VP8 ', 'VP8L', 'VP8X'].includes(chunk) && declaredSize === buffer.length;
}
