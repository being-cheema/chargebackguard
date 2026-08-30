import { calculateDisputeScore } from '../src/scoring/engine';
import { DisputeRecord } from '../src/types';

describe('ChargebackGuard Scoring Engine Tests', () => {
  const createBaseDispute = (overrides: Partial<DisputeRecord> = {}): DisputeRecord => {
    const now = Math.floor(Date.now() / 1000);
    return {
      id: 'disp_test123456789',
      payment_id: 'pay_test123456789',
      amount: 450000, // ₹4,500
      currency: 'INR',
      reason_code: 'RZP01',
      respond_by: now + 86400 * 7,
      status: 'open',
      phase: 'chargeback',
      created_at: now - 86400 * 5,
      evidence: {
        shipping_proof: null,
        billing_proof: null,
        cancellation_proof: null,
        customer_communication: null,
        proof_of_service: null,
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
      split: 'train',
      days_since_transaction: 5,
      customer_dispute_history_count: 0,
      ip_matches_billing_country: true,
      merchant_response_time_hours: 6.0,
      ground_truth_outcome: 'won',
      ...overrides,
    };
  };

  test('RZP01: High score when primary evidence (proof_of_service & shipping_proof) is present', () => {
    const dispute = createBaseDispute({
      reason_code: 'RZP01',
      evidence: {
        shipping_proof: 'https://cdn.razorpay.com/evidence/disp_1/shipping.pdf',
        proof_of_service: 'https://cdn.razorpay.com/evidence/disp_1/service.pdf',
        customer_communication: 'https://cdn.razorpay.com/evidence/disp_1/comms.pdf',
        billing_proof: null,
        cancellation_proof: null,
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const result = calculateDisputeScore(dispute);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.recommendation).toBe('AUTO_SUBMIT');
    expect(result.missingRequiredEvidence).toHaveLength(0);
    expect(result.factors.positive.some((f) => f.includes('All primary evidence present'))).toBe(true);
  });

  test('RZP01: Low score when primary evidence is completely missing', () => {
    const dispute = createBaseDispute({
      reason_code: 'RZP01',
    });

    const result = calculateDisputeScore(dispute);
    expect(result.score).toBeLessThan(0.40);
    expect(result.recommendation).toBe('HUMAN_REVIEW');
    expect(result.missingRequiredEvidence).toContain('proof_of_service');
    expect(result.missingRequiredEvidence).toContain('shipping_proof');
    expect(result.factors.negative.some((f) => f.includes('Completely missing primary evidence'))).toBe(true);
  });

  test('RZP04: Refund not processed requires refund_confirmation and billing_proof', () => {
    const dispute = createBaseDispute({
      reason_code: 'RZP04',
      evidence: {
        shipping_proof: null,
        proof_of_service: null,
        customer_communication: null,
        billing_proof: 'https://cdn.razorpay.com/evidence/disp_2/billing.pdf',
        cancellation_proof: null,
        explanation_letter: null,
        refund_confirmation: 'https://cdn.razorpay.com/evidence/disp_2/arn_receipt.pdf',
        access_activity_log: null,
        refund_cancellation_policy: 'https://cdn.razorpay.com/evidence/disp_2/policy.pdf',
        term_and_conditions: null,
        others: null,
      },
    });

    const result = calculateDisputeScore(dispute);
    expect(result.score).toBeGreaterThanOrEqual(0.80);
    expect(result.missingRequiredEvidence).toHaveLength(0);
  });

  test('RZP05: Account debited no confirmation requires access_activity_log', () => {
    const disputeWithLog = createBaseDispute({
      reason_code: 'RZP05',
      evidence: {
        shipping_proof: null,
        proof_of_service: null,
        customer_communication: null,
        billing_proof: null,
        cancellation_proof: null,
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: 'https://cdn.razorpay.com/evidence/disp_3/server_logs.pdf',
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const result = calculateDisputeScore(disputeWithLog);
    expect(result.score).toBeGreaterThanOrEqual(0.75);

    const disputeWithoutLog = createBaseDispute({
      reason_code: 'RZP05',
    });
    const resultWithout = calculateDisputeScore(disputeWithoutLog);
    expect(resultWithout.score).toBeLessThan(0.40);
  });

  test('13.2 / 4841 / C28: Cancelled recurring requires cancellation_proof & refund_cancellation_policy', () => {
    const dispute = createBaseDispute({
      reason_code: '13.2',
      evidence: {
        shipping_proof: null,
        proof_of_service: null,
        customer_communication: null,
        billing_proof: null,
        cancellation_proof: 'https://cdn.razorpay.com/evidence/disp_4/cancel_receipt.pdf',
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: 'https://cdn.razorpay.com/evidence/disp_4/login_events.pdf',
        refund_cancellation_policy: 'https://cdn.razorpay.com/evidence/disp_4/subscription_terms.pdf',
        term_and_conditions: null,
        others: null,
      },
    });

    const result = calculateDisputeScore(dispute);
    expect(result.score).toBeGreaterThanOrEqual(0.80);
    expect(result.recommendation).toBe('AUTO_SUBMIT');
  });

  test('Timing penalty applied when dispute is filed >60 days late', () => {
    const freshDispute = createBaseDispute({
      days_since_transaction: 10,
      evidence: {
        shipping_proof: 'https://cdn.razorpay.com/evidence/disp_5/shipping.pdf',
        proof_of_service: 'https://cdn.razorpay.com/evidence/disp_5/service.pdf',
        billing_proof: null,
        cancellation_proof: null,
        customer_communication: null,
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const lateDispute = createBaseDispute({
      days_since_transaction: 75, // >60 days
      evidence: freshDispute.evidence,
    });

    const freshResult = calculateDisputeScore(freshDispute);
    const lateResult = calculateDisputeScore(lateDispute);

    expect(lateResult.score).toBeLessThan(freshResult.score);
    expect(lateResult.factors.negative.some((f) => f.includes('>60 days'))).toBe(true);
  });

  test('Merchant slow response time (>48h) degrades score', () => {
    const fastMerchant = createBaseDispute({
      merchant_response_time_hours: 4,
    });
    const slowMerchant = createBaseDispute({
      merchant_response_time_hours: 72,
    });

    const fastResult = calculateDisputeScore(fastMerchant);
    const slowResult = calculateDisputeScore(slowMerchant);

    expect(slowResult.score).toBeLessThan(fastResult.score);
    expect(slowResult.factors.negative.some((f) => f.includes('> 48h'))).toBe(true);
  });

  test('Determinism test: Multiple executions on the same input return exact identical outputs', () => {
    const dispute = createBaseDispute({
      reason_code: '1064',
      evidence: {
        shipping_proof: 'https://cdn.razorpay.com/evidence/disp_6/track.pdf',
        customer_communication: 'https://cdn.razorpay.com/evidence/disp_6/chat.pdf',
        billing_proof: null,
        cancellation_proof: null,
        proof_of_service: null,
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const result1 = calculateDisputeScore(dispute);
    const result2 = calculateDisputeScore(dispute);

    expect(result1.score).toEqual(result2.score);
    expect(result1.confidenceLevel).toEqual(result2.confidenceLevel);
    expect(result1.recommendation).toEqual(result2.recommendation);
    expect(result1.factors).toEqual(result2.factors);
  });
});
