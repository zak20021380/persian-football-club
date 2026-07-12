export const FUN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FUN_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export async function validateFunImageFile(file: File): Promise<string | null> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) return 'فقط تصویر JPG، PNG یا WEBP مجاز است.';
  if (file.size <= 0 || file.size > FUN_IMAGE_MAX_BYTES) return 'حجم تصویر باید کمتر از ۵ مگابایت باشد.';

  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtension = file.type === 'image/jpeg' ? extension === 'jpg' || extension === 'jpeg' : extension === file.type.split('/')[1];
  if (!validExtension) return 'پسوند فایل با نوع تصویر مطابقت ندارد.';

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageMime(bytes);
  if (detected !== file.type) return 'محتوای فایل یک تصویر معتبر نیست.';
  return null;
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (isPng(bytes)) return 'image/png';
  if (isJpeg(bytes)) return 'image/jpeg';
  if (isWebp(bytes)) return 'image/webp';
  return null;
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= 45 && signature.every((value, index) => bytes[index] === value) && ascii(bytes, 12, 16) === 'IHDR' && ascii(bytes, bytes.length - 8, bytes.length - 4) === 'IEND';
}

function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false;
  for (let index = 2; index < bytes.length - 9; index += 1) if (bytes[index] === 0xff && [0xc0, 0xc1, 0xc2].includes(bytes[index + 1])) return true;
  return false;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP' || !['VP8 ', 'VP8L', 'VP8X'].includes(ascii(bytes, 12, 16))) return false;
  const declared = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  return declared + 8 === bytes.length;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
