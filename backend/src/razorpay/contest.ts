import { DisputeRecord, EvidenceKey } from '../types';
import { getRazorpayConfig } from '../config/settings';
import { contestDispute } from './disputes';
import { uploadDocument, getDefaultEvidenceSamplePath } from './documents';

const EVIDENCE_DOC_FIELD_MAP: Partial<Record<EvidenceKey, keyof Parameters<typeof contestDispute>[1]>> = {
  shipping_proof: 'shipping_proof',
  billing_proof: 'billing_proof',
  cancellation_proof: 'cancellation_proof',
  customer_communication: 'customer_communication',
  proof_of_service: 'proof_of_service',
  refund_confirmation: 'refund_confirmation',
  access_activity_log: 'access_activity_log',
  refund_cancellation_policy: 'refund_cancellation_policy',
  term_and_conditions: 'term_and_conditions',
};

export interface RazorpayContestResult {
  mode: 'draft' | 'submit';
  disputeId: string;
  documentIds: string[];
  razorpayResponse: unknown;
  usedSampleEvidence: boolean;
}

export async function submitDisputeContestToRazorpay(
  dispute: DisputeRecord
): Promise<RazorpayContestResult> {
  const { contestMode, isConfigured } = getRazorpayConfig();
  if (!isConfigured) {
    throw new Error(
      'Razorpay API credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
    );
  }

  const documentIds: string[] = [];
  let usedSampleEvidence = false;

  const presentKeys = Object.entries(dispute.evidence).filter(
    ([key, val]) => key !== 'explanation_letter' && val && typeof val === 'string'
  ) as [EvidenceKey, string][];

  if (presentKeys.length === 0) {
    const samplePath = getDefaultEvidenceSamplePath();
    const doc = await uploadDocument(samplePath);
    documentIds.push(doc.id);
    usedSampleEvidence = true;
  } else {
    const samplePath = getDefaultEvidenceSamplePath();
    const doc = await uploadDocument(samplePath);
    documentIds.push(doc.id);
    usedSampleEvidence = true;
  }

  const payload: Parameters<typeof contestDispute>[1] = {
    action: contestMode,
    summary: dispute.evidence.explanation_letter?.slice(0, 1000) || undefined,
    amount: dispute.amount,
  };

  const primaryField = presentKeys[0]?.[0];
  const mappedField = primaryField ? EVIDENCE_DOC_FIELD_MAP[primaryField] : 'others';

  if (mappedField === 'shipping_proof') payload.shipping_proof = documentIds;
  else if (mappedField === 'billing_proof') payload.billing_proof = documentIds;
  else if (mappedField === 'cancellation_proof') payload.cancellation_proof = documentIds;
  else if (mappedField === 'customer_communication') payload.customer_communication = documentIds;
  else if (mappedField === 'proof_of_service') payload.proof_of_service = documentIds;
  else if (mappedField === 'refund_confirmation') payload.refund_confirmation = documentIds;
  else if (mappedField === 'access_activity_log') payload.access_activity_log = documentIds;
  else if (mappedField === 'refund_cancellation_policy') payload.refund_cancellation_policy = documentIds;
  else if (mappedField === 'term_and_conditions') payload.term_and_conditions = documentIds;
  else payload.others = [{ type: 'supporting_document', document_ids: documentIds }];

  const response = await contestDispute(dispute.id, payload);

  return {
    mode: contestMode,
    disputeId: dispute.id,
    documentIds,
    razorpayResponse: response,
    usedSampleEvidence,
  };
}
