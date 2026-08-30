import Anthropic from '@anthropic-ai/sdk';
import { DisputeRecord, EvidenceKey, ScoreResult } from '../types';
import { getReasonCodeConfig } from '../config/reasonCodes';
import { validateExplanationLetter, ValidationResult } from './validator';

export interface DraftResult {
  letter: string;
  characterCount: number;
  provider: 'anthropic_claude' | 'deterministic_fallback';
  validation: ValidationResult;
  model?: string;
}

/**
 * ARCHITECTURAL NOTE: LLM BOUNDARY & GOVERNANCE
 * 
 * In ChargebackGuard, the LLM is strictly bounded to natural-language drafting only.
 * The core dispute win/loss scoring engine is 100% deterministic rules+weights.
 * 
 * Language generation is the proper use-case for LLMs (synthesizing structured facts
 * into professional, polite, and persuasive formal responses for banking reviewers).
 * However, the LLM is NEVER trusted to invent evidence: every output is audited
 * by the deterministic Anti-Hallucination Validator before acceptance.
 */
export async function draftExplanationLetter(
  dispute: DisputeRecord,
  scoreResult: ScoreResult
): Promise<DraftResult> {
  const config = getReasonCodeConfig(dispute.reason_code);
  const presentEvidenceKeys = scoreResult.presentEvidence;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const anthropic = new Anthropic({ apiKey });

      const prompt = `You are a Senior Risk and Dispute Operations Specialist preparing an official contest explanation letter to an issuing bank for a Razorpay chargeback dispute.

DISPUTE METADATA:
- Dispute ID: ${dispute.id}
- Payment ID: ${dispute.payment_id}
- Amount: INR ${(dispute.amount / 100).toFixed(2)}
- Reason Code: ${dispute.reason_code} - ${config.description}
- Days Since Transaction: ${dispute.days_since_transaction} days
- Available Evidence Files Present: ${
        presentEvidenceKeys.length > 0 ? presentEvidenceKeys.join(', ') : 'None attached'
      }

CRITICAL RULES:
1. STRICT CONSTRAINT: Total response length MUST be under 900 characters (Razorpay's hard limit is 1000 characters).
2. ZERO HALLUCINATION RULE: Reference ONLY the evidence files explicitly listed as present above (${
        presentEvidenceKeys.length > 0 ? presentEvidenceKeys.join(', ') : 'None'
      }).
3. DO NOT claim or mention any missing evidence (such as shipping proof, refund confirmation, server logs) unless it is explicitly listed in the available evidence files above.
4. Tone: Professional, authoritative, polite, and factual. State transaction details, how the merchant fulfilled the obligation per the attached evidence, and request chargeback reversal.
5. Return ONLY the letter body text. No greetings, placeholders, or markdown headers.`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 350,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawLetter =
        response.content[0]?.type === 'text'
          ? response.content[0].text.trim()
          : '';

      // Validate the draft against Anti-Hallucination checks
      const validation = validateExplanationLetter(rawLetter, dispute);

      if (validation.isValid) {
        return {
          letter: rawLetter,
          characterCount: rawLetter.length,
          provider: 'anthropic_claude',
          validation,
          model: 'claude-3-5-sonnet-20241022',
        };
      } else {
        console.warn(
          `⚠️ Claude draft failed anti-hallucination validation: ${validation.violations.join('; ')}. Falling back to verified generator.`
        );
      }
    } catch (err: any) {
      console.warn(`⚠️ Anthropic API call failed (${err.message}). Using deterministic fallback drafter.`);
    }
  }

  // Deterministic Fallback Drafter (guaranteed valid, zero hallucination, <= 1000 chars)
  const fallbackLetter = generateDeterministicLetter(dispute, scoreResult);
  const validation = validateExplanationLetter(fallbackLetter, dispute);

  return {
    letter: fallbackLetter,
    characterCount: fallbackLetter.length,
    provider: 'deterministic_fallback',
    validation,
  };
}

/**
 * Deterministic template drafter that references ONLY present evidence.
 * Guaranteed to pass anti-hallucination validation and stay under 1000 characters.
 */
export function generateDeterministicLetter(
  dispute: DisputeRecord,
  scoreResult: ScoreResult
): string {
  const config = getReasonCodeConfig(dispute.reason_code);
  const present = scoreResult.presentEvidence;
  const amountFormatted = `INR ${(dispute.amount / 100).toLocaleString('en-IN')}`;

  const lines: string[] = [];
  lines.push(
    `Re: Chargeback contest for Dispute ${dispute.id} (Payment ${dispute.payment_id}) for ${amountFormatted}.`
  );
  lines.push(
    `The dispute was filed under reason code ${dispute.reason_code} (${config.category}).`
  );

  if (present.length > 0) {
    const evidenceDescriptions: string[] = [];
    if (present.includes('shipping_proof')) {
      evidenceDescriptions.push('verified shipping proof confirming successful dispatch/delivery');
    }
    if (present.includes('proof_of_service')) {
      evidenceDescriptions.push('proof of service records demonstrating fulfillment');
    }
    if (present.includes('refund_confirmation')) {
      evidenceDescriptions.push('official refund confirmation with bank reference details');
    }
    if (present.includes('billing_proof')) {
      evidenceDescriptions.push('billing proof and matched settlement invoice');
    }
    if (present.includes('customer_communication')) {
      evidenceDescriptions.push('customer communication logs showing complete support interactions');
    }
    if (present.includes('access_activity_log')) {
      evidenceDescriptions.push('access activity log verifying customer usage and authorization');
    }
    if (present.includes('cancellation_proof')) {
      evidenceDescriptions.push('cancellation proof establishing valid terms');
    }
    if (present.includes('refund_cancellation_policy')) {
      evidenceDescriptions.push('explicit refund and cancellation policy acknowledged by user');
    }
    if (present.includes('term_and_conditions')) {
      evidenceDescriptions.push('agreed terms and conditions');
    }
    if (present.includes('others')) {
      evidenceDescriptions.push('supporting transaction documentation');
    }

    lines.push(
      `We have attached conclusive merchant records: ${evidenceDescriptions.join('; ')}.`
    );
  } else {
    lines.push(
      `Merchant records indicate the transaction of ${amountFormatted} was legitimately processed and authorized without cancellation.`
    );
  }

  if (dispute.ip_matches_billing_country) {
    lines.push('The transaction originated from a matching billing country IP.');
  }

  lines.push(
    'Based on the factual documentation provided, the merchant has satisfied all commercial obligations. We respectfully request this dispute be resolved in the merchant’s favor.'
  );

  let letter = lines.join(' ');
  if (letter.length > 980) {
    letter = letter.substring(0, 977) + '...';
  }

  return letter;
}
