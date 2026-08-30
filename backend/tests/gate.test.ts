import { processDisputeDecisionGate } from '../src/gate/decisionGate';
import { getAuditLogsForDispute } from '../src/audit/auditService';
import { getDb } from '../src/db';
import { DisputeRecord } from '../src/types';

describe('ChargebackGuard Decision Gate & Audit Log Tests', () => {
  beforeAll(async () => {
    const db = await getDb();
    await db.query('DELETE FROM audit_logs');
    await db.query('DELETE FROM disputes');
  });

  const createDisputeInDb = async (overrides: Partial<DisputeRecord> = {}): Promise<DisputeRecord> => {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    const dispute: DisputeRecord = {
      id: 'disp_gate_' + Math.random().toString(36).substring(2, 9),
      payment_id: 'pay_gate_' + Math.random().toString(36).substring(2, 9),
      amount: 500000,
      currency: 'INR',
      reason_code: 'RZP01',
      respond_by: now + 86400 * 7,
      status: 'open',
      phase: 'chargeback',
      created_at: now - 86400 * 2,
      evidence: {
        shipping_proof: 'https://cdn.razorpay.com/ship.pdf',
        proof_of_service: 'https://cdn.razorpay.com/service.pdf',
        customer_communication: 'https://cdn.razorpay.com/chat.pdf',
        billing_proof: null,
        cancellation_proof: null,
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
      split: 'train',
      days_since_transaction: 2,
      customer_dispute_history_count: 0,
      ip_matches_billing_country: true,
      merchant_response_time_hours: 4.0,
      ground_truth_outcome: 'won',
      ...overrides,
    };

    await db.query(
      `
      INSERT INTO disputes (
        id, payment_id, amount, currency, reason_code, respond_by,
        status, phase, created_at, evidence, split, days_since_transaction,
        customer_dispute_history_count, ip_matches_billing_country,
        merchant_response_time_hours, ground_truth_outcome
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `,
      [
        dispute.id,
        dispute.payment_id,
        dispute.amount,
        dispute.currency,
        dispute.reason_code,
        dispute.respond_by,
        dispute.status,
        dispute.phase,
        dispute.created_at,
        JSON.stringify(dispute.evidence),
        dispute.split,
        dispute.days_since_transaction,
        dispute.customer_dispute_history_count,
        dispute.ip_matches_billing_country,
        dispute.merchant_response_time_hours,
        dispute.ground_truth_outcome,
      ]
    );

    return dispute;
  };

  test('High score dispute is auto-approved to ready_to_submit and writes immutable audit log', async () => {
    const dispute = await createDisputeInDb();
    const result = await processDisputeDecisionGate(dispute, 0.75);

    expect(result.status).toBe('ready_to_submit');
    expect(result.isAutoSubmitted).toBe(true);
    expect(result.scoreResult.score).toBeGreaterThanOrEqual(0.75);
    expect(result.explanationLetter.length).toBeGreaterThan(0);
    expect(result.explanationLetter.length).toBeLessThanOrEqual(1000);

    // Verify audit log exists
    const logs = await getAuditLogsForDispute(dispute.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('DECISION_GATED');
    expect(logs[0].decision).toBe('AUTO_APPROVED_READY_TO_SUBMIT');
    expect(logs[0].threshold_used).toBe(0.75);
  });

  test('Low score dispute is routed to needs_human_review and writes audit log', async () => {
    const weakDispute = await createDisputeInDb({
      reason_code: 'RZP01',
      evidence: {
        shipping_proof: null,
        proof_of_service: null,
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

    const result = await processDisputeDecisionGate(weakDispute, 0.75);

    expect(result.status).toBe('needs_human_review');
    expect(result.isAutoSubmitted).toBe(false);
    expect(result.scoreResult.score).toBeLessThan(0.75);

    const logs = await getAuditLogsForDispute(weakDispute.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].decision).toBe('ROUTED_TO_HUMAN_REVIEW_QUEUE');
  });
});
