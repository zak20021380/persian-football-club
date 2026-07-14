import crypto from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export type StoredImage = { key: string; url: string };

export interface ImageStorage {
  save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredImage>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export function uploadRoot(): string {
  return path.resolve(env.UPLOAD_DIR);
}

class LocalImageStorage implements ImageStorage {
  async save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredImage> {
    const month = new Date().toISOString().slice(0, 7);
    const relativeDirectory = path.join('fun', month);
    const directory = path.join(uploadRoot(), relativeDirectory);
    await mkdir(directory, { recursive: true });
    const filename = `${crypto.randomUUID()}.${extension}`;
    const key = path.join(relativeDirectory, filename).replaceAll('\\', '/');
    await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
    return { key, url: `/uploads/${key}` };
  }

  async read(key: string): Promise<Buffer> {
    const normalized = safeKey(key);
    return readFile(path.join(uploadRoot(), normalized));
  }

  async delete(key: string): Promise<void> {
    let normalized: string;
    try { normalized = safeKey(key); } catch { return; }
    try {
      await unlink(path.join(uploadRoot(), normalized));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

function safeKey(key: string): string {
  const normalized = key.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) throw new Error('Invalid storage key');
  return normalized;
}

export const imageStorage: ImageStorage = new LocalImageStorage();
