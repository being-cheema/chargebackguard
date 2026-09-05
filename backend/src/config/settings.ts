import dotenv from 'dotenv';

dotenv.config();

export function getDecisionGateThreshold(): number {
  const raw = process.env.DECISION_GATE_THRESHOLD;
  if (raw) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed >= 0.1 && parsed <= 0.99) {
      return parsed;
    }
  }
  return 0.75;
}

export function getRazorpayConfig(): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  contestMode: 'draft' | 'submit';
  isConfigured: boolean;
} {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'chargebackguard_webhook_dev_secret';
  const contestMode = process.env.RAZORPAY_CONTEST_MODE === 'submit' ? 'submit' : 'draft';

  return {
    keyId,
    keySecret,
    webhookSecret,
    contestMode,
    isConfigured: keyId.length > 0 && keySecret.length > 0,
  };
}
