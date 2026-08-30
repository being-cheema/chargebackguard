import { DisputeRecord, EvidenceKey, ScoreResult } from '../types';
import { getReasonCodeConfig } from '../config/reasonCodes';

export interface ScoringContext {
  threshold?: number;
}

/**
 * Pure, deterministic, inspectable scoring engine.
 * STRICTLY NO LLM IS USED IN THIS FUNCTION.
 * All weights and rules are explicit, explainable, and fully auditable.
 */
export function calculateDisputeScore(
  dispute: DisputeRecord,
  context: ScoringContext = {}
): ScoreResult {
  const threshold = context.threshold ?? 0.75;
  const config = getReasonCodeConfig(dispute.reason_code);
  const evidence = dispute.evidence || {};

  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  let score = config.baseWinRate;
  positiveFactors.push(`Base win rate for ${config.code} (${config.category}): ${(config.baseWinRate * 100).toFixed(0)}%`);

  // 1. Primary Evidence Analysis
  const presentPrimary: EvidenceKey[] = [];
  const missingPrimary: EvidenceKey[] = [];

  for (const key of config.primaryEvidence) {
    if (evidence[key] && typeof evidence[key] === 'string' && evidence[key]!.trim().length > 0) {
      presentPrimary.push(key);
    } else {
      missingPrimary.push(key);
    }
  }

  const primaryCompleteness = config.primaryEvidence.length > 0 
    ? presentPrimary.length / config.primaryEvidence.length 
    : 1;

  if (primaryCompleteness === 1) {
    score += 0.32;
    positiveFactors.push(`All primary evidence present: [${presentPrimary.join(', ')}] (+32%)`);
  } else if (primaryCompleteness > 0) {
    score += 0.08;
    positiveFactors.push(`Partial primary evidence present: [${presentPrimary.join(', ')}] (+8%)`);
    negativeFactors.push(`Missing critical primary evidence: [${missingPrimary.join(', ')}] (-15%)`);
    score -= 0.15;
  } else {
    score -= 0.45;
    negativeFactors.push(`Completely missing primary evidence for ${config.code}: [${missingPrimary.join(', ')}] (-45%)`);
  }

  // 2. Secondary Evidence Analysis
  const presentSecondary: EvidenceKey[] = [];
  for (const key of config.secondaryEvidence) {
    if (evidence[key] && typeof evidence[key] === 'string' && evidence[key]!.trim().length > 0) {
      presentSecondary.push(key);
    }
  }

  const secondaryCompleteness = config.secondaryEvidence.length > 0
    ? presentSecondary.length / config.secondaryEvidence.length
    : 0;

  if (secondaryCompleteness > 0) {
    const secondaryBoost = secondaryCompleteness * 0.12;
    score += secondaryBoost;
    positiveFactors.push(`Supporting secondary evidence present: [${presentSecondary.join(', ')}] (+${(secondaryBoost * 100).toFixed(0)}%)`);
  }

  // Overall evidence completeness
  const allExpectedKeys = Array.from(new Set([...config.primaryEvidence, ...config.secondaryEvidence]));
  const allPresentKeys = [...presentPrimary, ...presentSecondary];
  const overallEvidenceCompleteness = allExpectedKeys.length > 0
    ? allPresentKeys.length / allExpectedKeys.length
    : 0;

  // 3. Operational & Timing Penalties
  let timingPenalty = 0;
  if (dispute.days_since_transaction > 60) {
    timingPenalty += 0.18;
    score -= 0.18;
    negativeFactors.push(`Dispute filed >60 days after transaction (${dispute.days_since_transaction} days) (-18%)`);
  } else if (dispute.days_since_transaction > 30) {
    timingPenalty += 0.05;
    score -= 0.05;
    negativeFactors.push(`Dispute filed >30 days after transaction (${dispute.days_since_transaction} days) (-5%)`);
  }

  if (dispute.merchant_response_time_hours <= 12) {
    score += 0.06;
    positiveFactors.push(`Rapid merchant response time (${dispute.merchant_response_time_hours}h <= 12h) (+6%)`);
  } else if (dispute.merchant_response_time_hours > 48) {
    score -= 0.12;
    negativeFactors.push(`Delayed merchant response time (${dispute.merchant_response_time_hours}h > 48h) (-12%)`);
  }

  // 4. Customer History & Dispute Fraud Signals
  let fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (dispute.customer_dispute_history_count >= 3) {
    fraudRisk = 'HIGH';
    if (primaryCompleteness === 1) {
      // Repeat disputer with strong merchant proof increases merchant defense validity
      score += 0.08;
      positiveFactors.push(`Cardholder has history of ${dispute.customer_dispute_history_count} disputes; strong merchant proof counters false claim (+8%)`);
    } else {
      score -= 0.12;
      negativeFactors.push(`Cardholder has history of ${dispute.customer_dispute_history_count} disputes without decisive merchant proof (-12%)`);
    }
  } else if (dispute.customer_dispute_history_count === 0) {
    fraudRisk = 'LOW';
    positiveFactors.push('Cardholder has clean dispute history');
  } else {
    fraudRisk = 'MEDIUM';
  }

  // 5. Geolocation / IP Billing match
  if (dispute.ip_matches_billing_country) {
    score += 0.05;
    positiveFactors.push('Transaction IP matches billing country (+5%)');
  } else {
    score -= 0.10;
    negativeFactors.push('Geolocation mismatch: Transaction IP does not match billing country (-10%)');
  }

  // Clamping score between 0.02 and 0.98
  const clampedScore = Math.max(0.02, Math.min(0.98, Math.round(score * 1000) / 1000));

  // Determine confidence & urgency
  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (clampedScore >= 0.80 || clampedScore <= 0.25) {
    confidenceLevel = 'HIGH';
  } else if (clampedScore >= 0.65 || clampedScore <= 0.35) {
    confidenceLevel = 'MEDIUM';
  } else {
    confidenceLevel = 'LOW';
  }

  const now = Math.floor(Date.now() / 1000);
  const timeRemainingSeconds = dispute.respond_by - now;
  let urgency: 'CRITICAL' | 'MODERATE' | 'NORMAL' = 'NORMAL';
  if (timeRemainingSeconds < 86400 * 2) {
    urgency = 'CRITICAL';
  } else if (timeRemainingSeconds < 86400 * 5) {
    urgency = 'MODERATE';
  }

  const recommendation: 'AUTO_SUBMIT' | 'HUMAN_REVIEW' =
    clampedScore >= threshold ? 'AUTO_SUBMIT' : 'HUMAN_REVIEW';

  const presentEvidence = Object.keys(evidence).filter(
    (k) => !!evidence[k as EvidenceKey] && evidence[k as EvidenceKey] !== null
  ) as EvidenceKey[];

  return {
    score: clampedScore,
    confidenceLevel,
    evidenceCompleteness: Math.round(overallEvidenceCompleteness * 100) / 100,
    recommendation,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors,
    },
    missingRequiredEvidence: missingPrimary,
    presentEvidence,
    riskAssessment: {
      fraudRisk,
      urgency,
      timingPenalty,
      evidenceMultiplier: primaryCompleteness,
    },
  };
}
