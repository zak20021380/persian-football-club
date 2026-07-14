export interface MemeShareData {
  title: string;
  text: string;
  url: string;
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('کپی لینک انجام نشد');
}

export async function shareMemeFallback(data: MemeShareData): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share(data);
    return 'shared';
  }
  await copyText(data.url);
  return 'copied';
}
