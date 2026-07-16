import { bindMiniAppCssVars, bindThemeParamsCssVars, bindViewportCssVars, expandViewport, hapticFeedback, init, miniAppReady, mountMiniAppSync, mountThemeParamsSync, mountViewport, retrieveRawInitData } from '@telegram-apps/sdk-react';

let initialized = false;
export function initializeTelegram(): void {
  if (initialized) return;
  initialized = true;
  try {
    init();
    mountThemeParamsSync();
    mountMiniAppSync();
    void mountViewport().then(() => { bindViewportCssVars(); expandViewport(); }).catch(() => undefined);
    bindThemeParamsCssVars();
    bindMiniAppCssVars();
    miniAppReady();
  } catch { /* Browser preview is supported in development. */ }
}
export function telegramInitData(): string {
  const raw = window.Telegram?.WebApp?.initData;
  if (typeof raw === 'string') return raw;
  try { return retrieveRawInitData() ?? ''; } catch { return ''; }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { start_param?: string };
        isVersionAtLeast?: (version: string) => boolean;
        openTelegramLink?: (url: string) => void;
        shareMessage?: (preparedMessageId: string) => void;
        onEvent?: (event: 'shareMessageSent' | 'shareMessageFailed', handler: (payload?: { error?: string } | string) => void) => void;
        offEvent?: (event: 'shareMessageSent' | 'shareMessageFailed', handler: (payload?: { error?: string } | string) => void) => void;
      };
    };
  }
}

export function telegramStartParam(): string | undefined {
  const unsafe = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (unsafe) return unsafe;
  const queryValue = new URLSearchParams(window.location.search).get('tgWebAppStartParam');
  if (queryValue) return queryValue;
  const initData = telegramInitData();
  return initData ? new URLSearchParams(initData).get('start_param') ?? undefined : undefined;
}

export function funPostIdFromTelegramStartParam(value = telegramStartParam()): string | undefined {
  return value?.match(/^fun_([a-f\d]{24})$/i)?.[1];
}

export function openTelegramProfile(username: string): boolean {
  const normalized = username.trim().replace(/^@/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalized)) return false;
  const url = `https://t.me/${normalized}`;
  try {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(url);
      return true;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

export function canUseNativeTelegramShare(): boolean {
  const webApp = window.Telegram?.WebApp;
  return Boolean(
    webApp?.initData
    && webApp.shareMessage
    && webApp.isVersionAtLeast?.('8.0')
  );
}

export type TelegramShareResult =
  | { status: 'sent' }
  | { status: 'cancelled' }
  | { status: 'failed'; error?: string };

export function sharePreparedTelegramMessage(preparedMessageId: string): Promise<TelegramShareResult> {
  const webApp = window.Telegram?.WebApp;
  if (!canUseNativeTelegramShare() || !webApp?.shareMessage) return Promise.resolve({ status: 'failed', error: 'UNSUPPORTED' });
  const shareMessage = webApp.shareMessage.bind(webApp);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: TelegramShareResult) => {
      if (settled) return;
      settled = true;
      webApp.offEvent?.('shareMessageSent', onSent);
      webApp.offEvent?.('shareMessageFailed', onFailed);
      resolve(result);
    };
    const onSent = () => finish({ status: 'sent' });
    const onFailed = (payload?: { error?: string } | string) => {
      const error = typeof payload === 'string' ? payload : payload?.error;
      finish(error === 'USER_DECLINED' ? { status: 'cancelled' } : { status: 'failed', error });
    };
    webApp.onEvent?.('shareMessageSent', onSent);
    webApp.onEvent?.('shareMessageFailed', onFailed);
    try {
      shareMessage(preparedMessageId);
    } catch {
      finish({ status: 'failed', error: 'UNKNOWN_ERROR' });
    }
  });
}
export function impact(style: 'light'|'medium'|'heavy' = 'light'): void {
  try { hapticFeedback.impactOccurred(style); } catch { /* unsupported client */ }
}
export function notify(type: 'success'|'error'|'warning'): void {
  try { hapticFeedback.notificationOccurred(type); } catch { /* unsupported client */ }
}
