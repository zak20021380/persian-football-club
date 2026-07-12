import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Bootstrap } from '@/types/api';
export function useBootstrap() { return useQuery({ queryKey: ['bootstrap'], queryFn: async () => (await api.get<Bootstrap>('/bootstrap')).data, staleTime: 60_000, retry: 1 }); }
