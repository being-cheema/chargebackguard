export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'won'
  | 'lost'
  | 'ready_to_submit'
  | 'needs_human_review';

export type DisputePhase = 'chargeback' | 'pre_arbitration' | 'arbitration';

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
  id: string;
  payment_id: string;
  amount: number;
  currency: 'INR';
  reason_code: string;
  respond_by: number;
  status: DisputeStatus;
  phase: DisputePhase;
  created_at: number;
  evidence: EvidenceObject;
  split: 'train' | 'held_out';
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

export interface ScoreResult {
  score: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceCompleteness: number;
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

export interface DraftResult {
  letter: string;
  characterCount: number;
  provider: 'anthropic_claude' | 'deterministic_fallback';
  validation: {
    isValid: boolean;
    characterCount: number;
    maxAllowedCharacters: number;
    violations: string[];
    referencedPresentEvidence: EvidenceKey[];
    hallucinatedEvidence: EvidenceKey[];
  };
  model?: string;
}

export interface AuditLogRecord {
  id: string;
  dispute_id: string;
  action: string;
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

export interface MetricEvaluationReport {
  evaluated_at: string;
  total_held_out_samples: number;
  threshold_used: number;
  confusion_matrix: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
  };
  metrics: {
    precision: number;
    recall: number;
    f1_score: number;
    accuracy: number;
    specificity: number;
  };
  financial_impact: {
    total_held_out_dispute_volume_inr: number;
    value_recovered_via_auto_approval_inr: number;
    human_review_queue_volume_inr: number;
    ops_and_network_penalty_cost_inr: number;
    net_economic_benefit_auto_path_inr: number;
    assumptions: {
      false_positive_penalty_inr: number;
      human_review_note: string;
    };
  };
  reason_code_performance: Record<
    string,
    {
      total: number;
      won: number;
      lost: number;
      tp: number;
      fp: number;
      tn: number;
      fn: number;
      precision: number;
      recall: number;
      f1: number;
    }
  >;
  threshold_sensitivity_curve: Array<{
    threshold: number;
    precision: number;
    recall: number;
    f1: number;
    auto_submit_rate: number;
    value_recovered_auto_inr: number;
    net_benefit_auto_inr: number;
  }>;
}

export interface ReasonCodeInfo {
  code: string;
  category: string;
  description: string;
  primaryEvidence: EvidenceKey[];
  secondaryEvidence: EvidenceKey[];
  baseWinRate: number;
}

// ============================================================
// Razorpay Integration (real Disputes/Documents/Webhooks APIs)
// ============================================================

export interface RazorpayPaymentRecord {
  payment_id: string;
  amount: number;
  currency: string;
  method: string;
  created_at: number;
  dispute_id?: string | null;
  dispute_status?: string | null;
  reason_code?: string | null;
}

export interface WebhookEventRecord {
  id: string;
  event_type: string;
  dispute_id: string | null;
  signature_valid: boolean;
  processed_at: number | null;
  created_at: number;
}
