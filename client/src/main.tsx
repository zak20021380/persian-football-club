import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { initializeTelegram } from './lib/telegram';

initializeTelegram();
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:20_000,retry:1,refetchOnWindowFocus:false},mutations:{retry:0}}});
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App/><Toaster position="top-center" toastOptions={{style:{background:'#102036',color:'#fff',border:'1px solid rgba(255,255,255,.1)',borderRadius:'16px',fontSize:'13px'}}}/></BrowserRouter></QueryClientProvider></StrictMode>);
