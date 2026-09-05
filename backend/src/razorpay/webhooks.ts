import crypto from 'crypto';
import { getRazorpayConfig } from '../config/settings';

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  secret?: string
): boolean {
  if (!signature) {
    return false;
  }

  const webhookSecret = secret || getRazorpayConfig().webhookSecret;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function signWebhookPayload(rawBody: string, secret?: string): string {
  const webhookSecret = secret || getRazorpayConfig().webhookSecret;
  return crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
}
