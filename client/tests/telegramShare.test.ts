import { afterEach, describe, expect, it, vi } from 'vitest';
import { canUseNativeTelegramShare, funPostIdFromTelegramStartParam, sharePreparedTelegramMessage } from '../src/lib/telegram.js';
import { shareMemeFallback } from '../src/lib/share.js';

type ShareEvent = 'shareMessageSent' | 'shareMessageFailed';

function installTelegramMock(input: {
  versionSupported?: boolean;
  share: (events: Map<ShareEvent, (payload?: { error?: string }) => void>) => void;
}) {
  const events = new Map<ShareEvent, (payload?: { error?: string }) => void>();
  const webApp = {
    initData: 'signed-init-data',
    isVersionAtLeast: vi.fn(() => input.versionSupported ?? true),
    onEvent: vi.fn((event: ShareEvent, handler: (payload?: { error?: string }) => void) => events.set(event, handler)),
    offEvent: vi.fn((event: ShareEvent) => events.delete(event)),
    shareMessage: vi.fn((_id: string) => input.share(events))
  };
  vi.stubGlobal('window', { Telegram: { WebApp: webApp }, setTimeout });
  return webApp;
}

afterEach(() => vi.unstubAllGlobals());

describe('native Telegram prepared-message sharing', () => {
  it('reports success only after Telegram confirms that the message was sent', async () => {
    const webApp = installTelegramMock({ share: (events) => events.get('shareMessageSent')?.() });
    await expect(sharePreparedTelegramMessage('prepared-1')).resolves.toEqual({ status: 'sent' });
    expect(webApp.shareMessage).toHaveBeenCalledWith('prepared-1');
  });

  it('reports cancellation without treating it as a successful share', async () => {
    installTelegramMock({ share: (events) => events.get('shareMessageFailed')?.({ error: 'USER_DECLINED' }) });
    await expect(sharePreparedTelegramMessage('prepared-2')).resolves.toEqual({ status: 'cancelled' });
  });

  it('preserves Telegram failure events for error handling', async () => {
    installTelegramMock({
      share: (events) => events.get('shareMessageFailed')?.({ error: 'MESSAGE_SEND_FAILED' })
    });
    await expect(sharePreparedTelegramMessage('prepared-3')).resolves.toEqual({ status: 'failed', error: 'MESSAGE_SEND_FAILED' });
  });

  it('does not open native sharing on Telegram clients older than 8.0', () => {
    const webApp = installTelegramMock({ versionSupported: false, share: () => undefined });
    expect(canUseNativeTelegramShare()).toBe(false);
    expect(webApp.isVersionAtLeast).toHaveBeenCalledWith('8.0');
    expect(webApp.shareMessage).not.toHaveBeenCalled();
  });
});

describe('sharing outside supported Telegram clients', () => {
  it('copies the exact deep link when Web Share is unavailable', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(shareMemeFallback({ title: 'فان فوتبالی', text: 'میم تستی', url: 'https://t.me/test/app?startapp=fun_123' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://t.me/test/app?startapp=fun_123');
  });
});

describe('meme deep-link start parameters', () => {
  it('recognizes only fun_{POST_ID} values', () => {
    expect(funPostIdFromTelegramStartParam('fun_507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
    expect(funPostIdFromTelegramStartParam('fun_deleted')).toBeUndefined();
    expect(funPostIdFromTelegramStartParam('ref_507f1f77bcf86cd799439011')).toBeUndefined();
  });
});
