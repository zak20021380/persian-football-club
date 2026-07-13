import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { initializeTelegram } from './lib/telegram';
import { authenticateMiniApp } from './lib/api';

initializeTelegram();
const root = createRoot(document.getElementById('root')!);
root.render(
  <main className="safe-top flex min-h-screen items-center justify-center p-4" dir="rtl">
    <div className="text-center">
      <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-emerald-300/20 border-t-emerald-300"/>
      <p className="mt-3 text-xs font-bold text-slate-400">در حال ورود امن...</p>
    </div>
  </main>
);

async function start() {
  try {
    await authenticateMiniApp();
  } catch (error) {
    root.render(
      <main className="safe-top flex min-h-screen items-center justify-center p-4" dir="rtl">
        <section className="w-full max-w-sm rounded-3xl border border-rose-300/15 bg-ink-900 p-5 text-center">
          <h1 className="text-sm font-black text-rose-200">ورود امن انجام نشد</h1>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">{(error as Error).message}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-10 w-full rounded-2xl bg-white/[.07] text-xs font-bold">تلاش دوباره</button>
        </section>
      </main>
    );
    return;
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: 0 } } });
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App/>
          <Toaster position="top-center" toastOptions={{ style: { background: '#102036', color: '#fff', border: '1px solid rgba(255,255,255,.1)', borderRadius: '16px', fontSize: '13px' } }}/>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  );
}

void start();
