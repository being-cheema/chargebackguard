import { verifyRazorpayWebhookSignature, signWebhookPayload } from '../src/razorpay/webhooks';
import { buildSimulatedDisputeWebhookPayload } from '../src/services/disputeIngestion';
import { mapRazorpayDisputeToRecord } from '../src/razorpay/mapper';

describe('Razorpay Webhook Utilities', () => {
  const secret = 'test_webhook_secret_12345';

  test('sign and verify webhook payload round-trip', () => {
    const body = JSON.stringify({ event: 'payment.dispute.created', test: true });
    const sig = signWebhookPayload(body, secret);
    expect(verifyRazorpayWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, 'invalid', secret)).toBe(false);
  });

  test('buildSimulatedDisputeWebhookPayload creates valid structure', () => {
    const payload = buildSimulatedDisputeWebhookPayload({
      reason_code: 'RZP01',
      amount: 450000,
    });
    expect(payload.event).toBe('payment.dispute.created');
    expect(payload.payload.dispute?.entity.id).toMatch(/^disp_/);
    expect(payload.payload.dispute?.entity.reason_code).toBe('RZP01');
  });

  test('mapRazorpayDisputeToRecord maps entity to internal schema', () => {
    const payload = buildSimulatedDisputeWebhookPayload();
    const entity = payload.payload.dispute!.entity;
    const record = mapRazorpayDisputeToRecord(entity);
    expect(record.id).toBe(entity.id);
    expect(record.payment_id).toBe(entity.payment_id);
    expect(record.currency).toBe('INR');
    expect(record.evidence).toBeDefined();
  });
});
