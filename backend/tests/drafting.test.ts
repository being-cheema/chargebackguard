import { validateExplanationLetter } from '../src/drafting/validator';
import { draftExplanationLetter, generateDeterministicLetter } from '../src/drafting/drafter';
import { calculateDisputeScore } from '../src/scoring/engine';
import { DisputeRecord } from '../src/types';

describe('ChargebackGuard Drafting & Anti-Hallucination Validator Tests', () => {
  const createBaseDispute = (overrides: Partial<DisputeRecord> = {}): DisputeRecord => {
    const now = Math.floor(Date.now() / 1000);
    return {
      id: 'disp_sparse_001',
      payment_id: 'pay_sparse_001',
      amount: 750000,
      currency: 'INR',
      reason_code: 'RZP01',
      respond_by: now + 86400 * 7,
      status: 'open',
      phase: 'chargeback',
      created_at: now - 86400 * 3,
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
      days_since_transaction: 3,
      customer_dispute_history_count: 0,
      ip_matches_billing_country: true,
      merchant_response_time_hours: 8.0,
      ground_truth_outcome: 'lost',
      ...overrides,
    };
  };

  test('Anti-Hallucination: Strictly REJECTS draft claiming shipping_proof when shipping_proof is null', () => {
    const disputeWithSparseEvidence = createBaseDispute({
      evidence: {
        shipping_proof: null, // absent!
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
    });

    const hallucinatedLetter =
      'Re: Dispute disp_sparse_001. We have attached verified shipping proof and courier tracking details confirming delivery to the customer. Please reverse the chargeback.';

    const result = validateExplanationLetter(hallucinatedLetter, disputeWithSparseEvidence);

    expect(result.isValid).toBe(false);
    expect(result.hallucinatedEvidence).toContain('shipping_proof');
    expect(result.violations.some((v) => v.includes("Hallucination detected: Draft claims 'shipping_proof'"))).toBe(
      true
    );
  });

  test('Anti-Hallucination: Strictly REJECTS draft claiming refund_confirmation when refund_confirmation is null', () => {
    const dispute = createBaseDispute({
      reason_code: 'RZP04',
      evidence: {
        shipping_proof: null,
        billing_proof: 'https://cdn.razorpay.com/billing.pdf', // present
        cancellation_proof: null,
        customer_communication: null,
        proof_of_service: null,
        explanation_letter: null,
        refund_confirmation: null, // absent!
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const hallucinatedLetter =
      'Re: Dispute disp_sparse_001. See enclosed refund confirmation and ARN receipt proving credit was already sent to cardholder.';

    const result = validateExplanationLetter(hallucinatedLetter, dispute);

    expect(result.isValid).toBe(false);
    expect(result.hallucinatedEvidence).toContain('refund_confirmation');
  });

  test('Anti-Hallucination: Strictly REJECTS multi-field hallucinations on single-file sparse case', () => {
    const dispute = createBaseDispute({
      reason_code: '13.2',
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
        term_and_conditions: 'https://cdn.razorpay.com/terms.pdf', // ONLY single field present
        others: null,
      },
    });

    const hallucinatedLetter =
      'Re: Dispute disp_sparse_001. We provide user activity logs, cancellation proof records, and terms and conditions.';

    const result = validateExplanationLetter(hallucinatedLetter, dispute);

    expect(result.isValid).toBe(false);
    expect(result.referencedPresentEvidence).toContain('term_and_conditions');
    expect(result.hallucinatedEvidence).toContain('access_activity_log');
    expect(result.hallucinatedEvidence).toContain('cancellation_proof');
  });

  test('Anti-Hallucination: ACCEPTS draft referencing ONLY genuine present evidence', () => {
    const dispute = createBaseDispute({
      reason_code: 'RZP04',
      evidence: {
        shipping_proof: null,
        billing_proof: 'https://cdn.razorpay.com/billing.pdf',
        cancellation_proof: null,
        customer_communication: null,
        proof_of_service: null,
        explanation_letter: null,
        refund_confirmation: 'https://cdn.razorpay.com/arn.pdf',
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const validLetter =
      'Re: Dispute disp_sparse_001 for INR 7,500.00. We have attached official refund confirmation and matched billing proof verifying the credit was processed.';

    const result = validateExplanationLetter(validLetter, dispute);

    expect(result.isValid).toBe(true);
    expect(result.referencedPresentEvidence).toContain('refund_confirmation');
    expect(result.referencedPresentEvidence).toContain('billing_proof');
    expect(result.hallucinatedEvidence).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  test('Razorpay API Constraint: Rejects explanation letters exceeding 1000 characters', () => {
    const dispute = createBaseDispute();
    const longLetter = 'A'.repeat(1001);

    const result = validateExplanationLetter(longLetter, dispute);

    expect(result.isValid).toBe(false);
    expect(result.violations.some((v) => v.includes('exceeds Razorpay\'s 1000 character limit'))).toBe(true);
  });

  test('Drafting generator creates valid, non-hallucinating letter under 1000 characters for completely empty sparse evidence', async () => {
    const completelyEmptyDispute = createBaseDispute({
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
    });
    const scoreResult = calculateDisputeScore(completelyEmptyDispute);

    const draft = await draftExplanationLetter(completelyEmptyDispute, scoreResult);

    expect(draft.validation.isValid).toBe(true);
    expect(draft.characterCount).toBeLessThanOrEqual(1000);
    expect(draft.validation.hallucinatedEvidence).toHaveLength(0);
    expect(draft.letter.length).toBeGreaterThan(50);
  });

  test('Drafting generator correctly incorporates present evidence into letter', async () => {
    const richDispute = createBaseDispute({
      reason_code: 'RZP01',
      evidence: {
        shipping_proof: 'https://cdn.razorpay.com/ship.pdf',
        proof_of_service: 'https://cdn.razorpay.com/service.pdf',
        billing_proof: null,
        cancellation_proof: null,
        customer_communication: 'https://cdn.razorpay.com/chat.pdf',
        explanation_letter: null,
        refund_confirmation: null,
        access_activity_log: null,
        refund_cancellation_policy: null,
        term_and_conditions: null,
        others: null,
      },
    });

    const scoreResult = calculateDisputeScore(richDispute);
    const draft = await draftExplanationLetter(richDispute, scoreResult);

    expect(draft.validation.isValid).toBe(true);
    expect(draft.characterCount).toBeLessThanOrEqual(1000);
    expect(draft.letter).toContain('shipping proof');
  });
});
