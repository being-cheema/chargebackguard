export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'won'
  | 'lost'
  | 'ready_to_submit'
  | 'needs_human_review';

export type DisputePhase = 'chargeback' | 'pre_arbitration' | 'arbitration';

export type SplitType = 'train' | 'held_out';

export interface EvidenceObject {
  shipping_proof: string | null;
  billing_proof: string | null;
  cancellation_proof: string | null;
  customer_communication: string | null;
  proof_of_service: string | null;
  explanation_letter: string | null;
  refund_confirmation: string | null;
  access_activity_log: string | null;
  refund_cancellation_policy: string | null;
  term_and_conditions: string | null;
  others: string | null;
}

export type EvidenceKey = keyof EvidenceObject;

export interface DisputeRecord {
  id: string; // disp_xxxxx
  payment_id: string; // pay_xxxxx
  amount: number; // in subunits (paise for INR)
  currency: 'INR';
  reason_code: string;
  respond_by: number; // unix timestamp
  status: DisputeStatus;
  phase: DisputePhase;
  created_at: number; // unix timestamp
  evidence: EvidenceObject;
  split: SplitType;
  days_since_transaction: number;
  customer_dispute_history_count: number;
  ip_matches_billing_country: boolean;
  merchant_response_time_hours: number;
  ground_truth_outcome: 'won' | 'lost';
  win_score?: number;
  factors?: {
    positive: string[];
    negative: string[];
  };
}

export interface ReasonCodeConfig {
  code: string;
  category: string;
  description: string;
  primaryEvidence: EvidenceKey[];
  secondaryEvidence: EvidenceKey[];
  baseWinRate: number;
}

export interface ScoreResult {
  score: number; // 0.00 to 1.00
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceCompleteness: number; // 0.00 to 1.00
  recommendation: 'AUTO_SUBMIT' | 'HUMAN_REVIEW';
  factors: {
    positive: string[];
    negative: string[];
  };
  missingRequiredEvidence: EvidenceKey[];
  presentEvidence: EvidenceKey[];
  riskAssessment: {
    fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    urgency: 'CRITICAL' | 'MODERATE' | 'NORMAL';
    timingPenalty: number;
    evidenceMultiplier: number;
  };
}

export type AuditAction =
  | 'SCORED'
  | 'DRAFTED'
  | 'DRAFT_REJECTED_HALLUCINATION'
  | 'DECISION_GATED'
  | 'HUMAN_APPROVED'
  | 'HUMAN_OVERRIDDEN'
  | 'RAZORPAY_DRAFTED'
  | 'RAZORPAY_SUBMITTED';

export interface AuditLogRecord {
  id: string;
  dispute_id: string;
  action: AuditAction;
  score: number | null;
  decision: string;
  threshold_used: number;
  factors: {
    positive: string[];
    negative: string[];
  } | null;
  explanation_letter?: string | null;
  reviewer_id?: string | null;
  reviewer_notes?: string | null;
  created_at: number;
}
