import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export interface PaymentIntentInput {
  transactionId: string;
  amountRials: number;
  currency: 'IRR';
  description: string;
}

export interface PaymentIntent {
  mode: 'test';
  provider: 'test';
  reference: string;
  message: string;
}

export interface PaymentService {
  readonly provider: 'test' | 'none';
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
}

class UnavailablePaymentService implements PaymentService {
  readonly provider = 'none' as const;
  async createIntent(): Promise<PaymentIntent> {
    throw new AppError(503, 'درگاه پرداخت هنوز پیکربندی نشده است', 'PAYMENT_NOT_CONFIGURED');
  }
}

class TestPaymentService implements PaymentService {
  readonly provider = 'test' as const;
  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    if (!env.DEMO_DATA_ENABLED) {
      throw new AppError(503, 'پرداخت آزمایشی در محیط واقعی غیرفعال است', 'TEST_PAYMENT_DISABLED');
    }
    return {
      mode: 'test',
      provider: 'test',
      reference: `test_${input.transactionId}`,
      message: 'این پرداخت فقط برای توسعه است و هیچ تراکنش واقعی انجام نمی‌شود.'
    };
  }
}

export function paymentService(): PaymentService {
  if (env.DEMO_DATA_ENABLED) return new TestPaymentService();
  return new UnavailablePaymentService();
}
