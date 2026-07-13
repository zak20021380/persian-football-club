import axios from 'axios';
import { telegramInitData } from './telegram';

let sessionToken = '';

export const api = axios.create({ baseURL: '/api', timeout: 20_000 });
api.interceptors.request.use((config) => {
  if (sessionToken) config.headers.authorization = `Bearer ${sessionToken}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  const message = error?.response?.data?.error || error?.message || 'ارتباط با سرور برقرار نشد';
  return Promise.reject(new Error(message));
});

export async function authenticateMiniApp(): Promise<void> {
  const initData = telegramInitData();
  const response = await api.post<{ token: string; expiresAt: string }>('/auth/telegram', { initData });
  sessionToken = response.data.token;
}
