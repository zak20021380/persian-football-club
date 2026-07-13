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
    Telegram?: { WebApp?: { initData?: string } };
  }
}
export function impact(style: 'light'|'medium'|'heavy' = 'light'): void {
  try { hapticFeedback.impactOccurred(style); } catch { /* unsupported client */ }
}
export function notify(type: 'success'|'error'|'warning'): void {
  try { hapticFeedback.notificationOccurred(type); } catch { /* unsupported client */ }
}
