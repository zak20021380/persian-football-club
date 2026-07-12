export function escapeTelegramHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function withTelegramRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      const retryAfter = extractRetryAfter(error);
      if (attempt >= maxAttempts || !retryAfter) throw error;
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
    }
  }
  throw new Error('Telegram retry exhausted');
}

function extractRetryAfter(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const response = (error as { response?: { parameters?: { retry_after?: number } } }).response;
  return response?.parameters?.retry_after ?? null;
}
