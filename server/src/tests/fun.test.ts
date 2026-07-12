import { describe, expect, it } from 'vitest';
import { detectImage, validateFunImage } from '../services/funImage.js';
import { sanitizeFunCaption } from '../services/fun.js';

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
