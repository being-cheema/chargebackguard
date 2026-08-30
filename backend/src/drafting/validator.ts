import { DisputeRecord, EvidenceKey, EvidenceObject } from '../types';

export interface ValidationResult {
  isValid: boolean;
  characterCount: number;
  maxAllowedCharacters: number;
  violations: string[];
  referencedPresentEvidence: EvidenceKey[];
  hallucinatedEvidence: EvidenceKey[];
}

/**
 * Keyword patterns associated with each evidence type.
 * Used by the Anti-Hallucination Validator to detect if a generated draft
 * falsely claims to possess or provide evidence that is absent in the dispute record.
 */
const EVIDENCE_KEYWORD_PATTERNS: Record<EvidenceKey, RegExp[]> = {
  shipping_proof: [
    /shipping\s+proof/i,
    /proof\s+of\s+delivery/i,
    /pod\b/i,
    /tracking\s+(number|details|id|link)/i,
    /courier\s+(receipt|docket|slip)/i,
    /delivery\s+confirmation/i,
    /consignment\s+note/i,
  ],
  billing_proof: [
    /billing\s+proof/i,
    /invoice/i,
    /bank\s+statement/i,
    /tax\s+invoice/i,
    /billing\s+receipt/i,
    /settlement\s+statement/i,
  ],
  cancellation_proof: [
    /cancellation\s+proof/i,
    /cancellation\s+(request|timestamp|email|receipt|notice|record)/i,
    /proof\s+of\s+cancellation/i,
  ],
  customer_communication: [
    /customer\s+communication/i,
    /email\s+(thread|correspondence|exchange|log)/i,
    /chat\s+(transcript|history|log)/i,
    /support\s+ticket/i,
    /communication\s+history/i,
    /whatsapp\s+chat/i,
  ],
  proof_of_service: [
    /proof\s+of\s+service/i,
    /service\s+delivery\s+log/i,
    /work\s+completion/i,
    /service\s+acceptance/i,
    /activation\s+confirmation/i,
  ],
  explanation_letter: [],
  refund_confirmation: [
    /refund\s+confirmation/i,
    /refund\s+(receipt|arn|reference|id|note)/i,
    /acquirer\s+reference\s+number/i,
    /credit\s+note/i,
    /processed\s+refund/i,
  ],
  access_activity_log: [
    /access\s+(activity\s+)?log/i,
    /activity\s+log/i,
    /user\s+activity/i,
    /server\s+log/i,
    /login\s+(history|timestamp|event|ip)/i,
    /system\s+audit\s+log/i,
    /telemetry\s+record/i,
  ],
  refund_cancellation_policy: [
    /cancellation\s+policy/i,
    /refund\s+policy/i,
    /return\s+policy/i,
  ],
  term_and_conditions: [
    /terms\s+and\s+conditions/i,
    /t&c\b/i,
    /user\s+agreement/i,
    /terms\s+of\s+service/i,
  ],
  others: [
    /photographic\s+proof/i,
    /defect\s+inspection/i,
    /product\s+images/i,
  ],
};

/**
 * Strict Anti-Hallucination Validator for drafted explanation letters.
 * 
 * Verifies that:
 * 1. The letter respects Razorpay's hard 1,000-character constraint.
 * 2. The letter DOES NOT reference or claim evidence fields that are null/absent
 *    in the dispute record.
 */
export function validateExplanationLetter(
  letterText: string,
  dispute: DisputeRecord
): ValidationResult {
  const violations: string[] = [];
  const characterCount = letterText ? letterText.trim().length : 0;
  const maxAllowedCharacters = 1000;

  // 1. Hard character count check (Razorpay API constraint)
  if (characterCount === 0) {
    violations.push('Explanation letter is empty.');
  } else if (characterCount > maxAllowedCharacters) {
    violations.push(
      `Explanation letter exceeds Razorpay's 1000 character limit (${characterCount} / ${maxAllowedCharacters} chars).`
    );
  }

  const evidence: EvidenceObject = dispute.evidence || ({} as EvidenceObject);
  const referencedPresentEvidence: EvidenceKey[] = [];
  const hallucinatedEvidence: EvidenceKey[] = [];

  // Check each evidence type
  for (const [key, regexList] of Object.entries(EVIDENCE_KEYWORD_PATTERNS) as [
    EvidenceKey,
    RegExp[]
  ][]) {
    if (key === 'explanation_letter') continue;

    const isPresentInRecord =
      !!evidence[key] &&
      typeof evidence[key] === 'string' &&
      evidence[key]!.trim().length > 0;

    // Check if the drafted letter matches any of the keyword patterns for this evidence type
    const matchesPattern = regexList.some((regex) => regex.test(letterText));

    if (matchesPattern) {
      if (isPresentInRecord) {
        referencedPresentEvidence.push(key);
      } else {
        hallucinatedEvidence.push(key);
        violations.push(
          `Hallucination detected: Draft claims '${key}' evidence, but '${key}' is null/absent in the dispute record.`
        );
      }
    }
  }

  return {
    isValid: violations.length === 0,
    characterCount,
    maxAllowedCharacters,
    violations,
    referencedPresentEvidence,
    hallucinatedEvidence,
  };
}
