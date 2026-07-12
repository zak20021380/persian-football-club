import axios from 'axios';
import { telegramInitData } from './telegram';

export const api = axios.create({ baseURL: '/api', timeout: 20_000 });
api.interceptors.request.use((config) => {
  const initData = telegramInitData();
  if (initData) config.headers['x-telegram-init-data'] = initData;
  else if (import.meta.env.DEV) config.headers['x-dev-telegram-id'] = localStorage.getItem('devTelegramId') ?? '900001';
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  const message = error?.response?.data?.error || error?.message || 'ارتباط با سرور برقرار نشد';
  return Promise.reject(new Error(message));
});
