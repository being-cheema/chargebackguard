import { DisputeRecord, DisputeStatus, ScoreResult } from '../types';
import { calculateDisputeScore } from '../scoring/engine';
import { draftExplanationLetter } from '../drafting/drafter';
import { createAuditLogEntry } from '../audit/auditService';
import { getDb } from '../db';

export interface GateDecisionResult {
  dispute: DisputeRecord;
  scoreResult: ScoreResult;
  status: DisputeStatus;
  explanationLetter: string;
  auditLogId: string;
  isAutoSubmitted: boolean;
}

export async function processDisputeDecisionGate(
  dispute: DisputeRecord,
  threshold: number = 0.75
): Promise<GateDecisionResult> {
  // 1. Deterministic Scoring
  const scoreResult = calculateDisputeScore(dispute, { threshold });
  
  // 2. Draft natural-language explanation letter with anti-hallucination validation
  const draftResult = await draftExplanationLetter(dispute, scoreResult);
  const validatedLetter = draftResult.letter;

  // 3. Decision Gating
  const isAutoApproved = scoreResult.score >= threshold;
  const newStatus: DisputeStatus = isAutoApproved ? 'ready_to_submit' : 'needs_human_review';
  const decisionText = isAutoApproved
    ? 'AUTO_APPROVED_READY_TO_SUBMIT'
    : 'ROUTED_TO_HUMAN_REVIEW_QUEUE';

  // 4. Update dispute in database with letter, score, and factors
  const updatedEvidence = {
    ...dispute.evidence,
    explanation_letter: validatedLetter,
  };

  const db = await getDb();
  await db.query(
    `
    UPDATE disputes
    SET status = $1,
        evidence = $2,
        win_score = $3,
        factors = $4
    WHERE id = $5
  `,
    [
      newStatus,
      JSON.stringify(updatedEvidence),
      scoreResult.score,
      JSON.stringify(scoreResult.factors),
      dispute.id,
    ]
  );

  // 5. Immutable Audit Log Entry
  const auditLog = await createAuditLogEntry({
    dispute_id: dispute.id,
    action: 'DECISION_GATED',
    score: scoreResult.score,
    decision: decisionText,
    threshold_used: threshold,
    factors: scoreResult.factors,
    explanation_letter: validatedLetter,
    reviewer_notes: isAutoApproved
      ? `Auto-approved by ChargebackGuard gate (Score ${scoreResult.score} >= ${threshold}). Package staged in ready_to_submit state.`
      : `Routed to human review (Score ${scoreResult.score} < ${threshold}). Missing or weak evidence requires risk analyst inspection.`,
  });

  const updatedDispute: DisputeRecord = {
    ...dispute,
    status: newStatus,
    evidence: updatedEvidence,
    win_score: scoreResult.score,
    factors: scoreResult.factors,
  };

  return {
    dispute: updatedDispute,
    scoreResult,
    status: newStatus,
    explanationLetter: validatedLetter,
    auditLogId: auditLog.id,
    isAutoSubmitted: isAutoApproved,
  };
}
