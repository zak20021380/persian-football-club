import crypto from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export type StoredImage = { key: string; url: string };

export interface ImageStorage {
  save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredImage>;
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

  async delete(key: string): Promise<void> {
    const normalized = key.replaceAll('\\', '/');
    if (normalized.startsWith('/') || normalized.includes('..')) return;
    try {
      await unlink(path.join(uploadRoot(), normalized));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export const imageStorage: ImageStorage = new LocalImageStorage();
