import { DisputeRecord, DisputePhase, DisputeStatus } from '../types';
import { RazorpayDisputeEntity } from './types';

function mapRazorpayStatus(status: string): DisputeStatus {
  switch (status) {
    case 'open':
      return 'open';
    case 'under_review':
      return 'under_review';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    case 'closed':
      return 'lost';
    default:
      return 'open';
  }
}

function mapRazorpayPhase(phase?: string | null): DisputePhase {
  switch (phase) {
    case 'pre_arbitration':
      return 'pre_arbitration';
    case 'arbitration':
      return 'arbitration';
    default:
      return 'chargeback';
  }
}

function emptyEvidence(): DisputeRecord['evidence'] {
  return {
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
  };
}

export function mapRazorpayDisputeToRecord(
  entity: RazorpayDisputeEntity,
  extras: Partial<DisputeRecord> = {}
): DisputeRecord {
  const evidence = emptyEvidence();
  const rawEvidence = entity.evidence || {};

  for (const key of Object.keys(evidence) as (keyof DisputeRecord['evidence'])[]) {
    const val = rawEvidence[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      evidence[key] = val;
    }
  }

  const now = Math.floor(Date.now() / 1000);

  return {
    id: entity.id,
    payment_id: entity.payment_id,
    amount: entity.amount,
    currency: (entity.currency as 'INR') || 'INR',
    reason_code: entity.reason_code || 'RZP00',
    respond_by: entity.respond_by || now + 7 * 86400,
    status: mapRazorpayStatus(entity.status),
    phase: mapRazorpayPhase(entity.phase),
    created_at: entity.created_at,
    evidence,
    split: 'train',
    days_since_transaction: extras.days_since_transaction ?? 14,
    customer_dispute_history_count: extras.customer_dispute_history_count ?? 0,
    ip_matches_billing_country: extras.ip_matches_billing_country ?? true,
    merchant_response_time_hours: extras.merchant_response_time_hours ?? 12,
    ground_truth_outcome: extras.ground_truth_outcome ?? 'won',
    ...extras,
  };
}
