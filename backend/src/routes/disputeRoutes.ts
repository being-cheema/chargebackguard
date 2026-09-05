import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { DisputeRecord } from '../types';
import { calculateDisputeScore } from '../scoring/engine';
import { draftExplanationLetter } from '../drafting/drafter';
import { processDisputeDecisionGate } from '../gate/decisionGate';
import { createAuditLogEntry } from '../audit/auditService';
import { requireReviewerAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, gateDisputeSchema, reviewDisputeSchema } from '../middleware/validation';
import { validateExplanationLetter } from '../drafting/validator';
import { parseDisputeRow, toPublicDispute } from '../utils/disputeSerializer';
import { getDecisionGateThreshold } from '../config/settings';

export const disputeRouter = Router();

// GET /api/disputes - list with search, filter, sort, pagination (Public read-only)
disputeRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const {
      status,
      reason_code,
      phase,
      split,
      search,
      sort = 'respond_by_asc',
      limit = 50,
      offset = 0,
    } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (reason_code && typeof reason_code === 'string' && reason_code !== 'all') {
      conditions.push(`reason_code = $${paramIndex++}`);
      params.push(reason_code);
    }

    if (phase && typeof phase === 'string' && phase !== 'all') {
      conditions.push(`phase = $${paramIndex++}`);
      params.push(phase);
    }

    if (split && typeof split === 'string' && split !== 'all') {
      conditions.push(`split = $${paramIndex++}`);
      params.push(split);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      conditions.push(`(id ILIKE $${paramIndex} OR payment_id ILIKE $${paramIndex} OR reason_code ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY respond_by ASC';
    if (sort === 'respond_by_desc') orderClause = 'ORDER BY respond_by DESC';
    else if (sort === 'amount_desc') orderClause = 'ORDER BY amount DESC';
    else if (sort === 'amount_asc') orderClause = 'ORDER BY amount ASC';
    else if (sort === 'score_desc') orderClause = 'ORDER BY win_score DESC NULLS LAST';
    else if (sort === 'score_asc') orderClause = 'ORDER BY win_score ASC NULLS LAST';
    else if (sort === 'created_at_desc') orderClause = 'ORDER BY created_at DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM disputes ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const query = `
      SELECT * FROM disputes
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);
    const disputes = result.rows.map((row) => toPublicDispute(row));

    // Compute summary counts
    const statusCountsResult = await db.query(`
      SELECT status, COUNT(*) as count FROM disputes GROUP BY status
    `);
    const statusCounts: Record<string, number> = {};
    for (const r of statusCountsResult.rows) {
      statusCounts[r.status] = Number(r.count);
    }

    res.json({
      total,
      limit: Number(limit),
      offset: Number(offset),
      statusCounts,
      disputes,
    });
  } catch (err: any) {
    console.error('Fetch disputes error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/disputes/:id - get single dispute with real-time scoring (Public read-only)
disputeRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const disputeId = String(req.params.id);
    const db = await getDb();
    const result = await db.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not Found', message: `Dispute ${disputeId} not found.` });
      return;
    }

    const dispute = parseDisputeRow(result.rows[0]);
    const scoreResult = calculateDisputeScore(dispute);

    res.json({
      dispute: toPublicDispute(result.rows[0]),
      scoreResult,
    });
  } catch (err: any) {
    console.error('Fetch dispute detail error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/disputes/:id/score - score a single dispute (Requires Reviewer Auth)
disputeRouter.post(
  '/:id/score',
  requireReviewerAuth,
  validateBody(gateDisputeSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const disputeId = String(req.params.id);
      const db = await getDb();
      const result = await db.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Not Found', message: `Dispute ${disputeId} not found.` });
        return;
      }

      const dispute = parseDisputeRow(result.rows[0]);
      const threshold = req.body.threshold ?? getDecisionGateThreshold();
      const scoreResult = calculateDisputeScore(dispute, { threshold });

      // Update dispute score in DB
      await db.query(
        `UPDATE disputes SET win_score = $1, factors = $2 WHERE id = $3`,
        [scoreResult.score, JSON.stringify(scoreResult.factors), dispute.id]
      );

      // Audit log
      await createAuditLogEntry({
        dispute_id: dispute.id,
        action: 'SCORED',
        score: scoreResult.score,
        decision: `Score computed: ${scoreResult.score} (${scoreResult.recommendation})`,
        threshold_used: threshold,
        factors: scoreResult.factors,
        reviewer_id: req.reviewer?.id,
        reviewer_notes: `Deterministic scoring evaluated by ${req.reviewer?.name || 'Reviewer'}: ${scoreResult.factors.positive.length} positive factors, ${scoreResult.factors.negative.length} negative factors.`,
      });

      res.json({
        disputeId: dispute.id,
        scoreResult,
      });
    } catch (err: any) {
      console.error('Score dispute error:', err);
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);

// POST /api/disputes/:id/draft - draft explanation letter (Requires Reviewer Auth)
disputeRouter.post(
  '/:id/draft',
  requireReviewerAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const disputeId = String(req.params.id);
      const db = await getDb();
      const result = await db.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Not Found', message: `Dispute ${disputeId} not found.` });
        return;
      }

      const dispute = parseDisputeRow(result.rows[0]);
      const scoreResult = calculateDisputeScore(dispute);
      const draftResult = await draftExplanationLetter(dispute, scoreResult);

      // Update evidence in DB
      const updatedEvidence = {
        ...dispute.evidence,
        explanation_letter: draftResult.letter,
      };

      await db.query(
        `UPDATE disputes SET evidence = $1 WHERE id = $2`,
        [JSON.stringify(updatedEvidence), dispute.id]
      );

      // Audit log
      await createAuditLogEntry({
        dispute_id: dispute.id,
        action: draftResult.llmRejected ? 'DRAFT_REJECTED_HALLUCINATION' : 'DRAFTED',
        score: scoreResult.score,
        decision: draftResult.llmRejected
          ? `LLM draft rejected; fallback via ${draftResult.provider}`
          : `Letter drafted via ${draftResult.provider} (${draftResult.characterCount} chars)`,
        threshold_used: getDecisionGateThreshold(),
        factors: scoreResult.factors,
        explanation_letter: draftResult.letter,
        reviewer_id: req.reviewer?.id,
        reviewer_notes: draftResult.llmRejected
          ? `LLM REJECTED: ${draftResult.llmViolations?.join('; ')}. Fallback validation: ${draftResult.validation.isValid ? 'PASSED' : 'FAILED'}.`
          : draftResult.validation.isValid
            ? `Anti-hallucination validation PASSED. Referenced: [${draftResult.validation.referencedPresentEvidence.join(', ')}].`
            : `Validation warnings: ${draftResult.validation.violations.join('; ')}`,
      });

      res.json({
        disputeId: dispute.id,
        draftResult,
      });
    } catch (err: any) {
      console.error('Draft letter error:', err);
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);

// POST /api/disputes/:id/gate - execute decision gate pipeline (Requires Reviewer Auth)
disputeRouter.post(
  '/:id/gate',
  requireReviewerAuth,
  validateBody(gateDisputeSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const disputeId = String(req.params.id);
      const db = await getDb();
      const result = await db.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Not Found', message: `Dispute ${disputeId} not found.` });
        return;
      }

      const dispute = parseDisputeRow(result.rows[0]);
      const threshold = req.body.threshold ?? getDecisionGateThreshold();
      const gateResult = await processDisputeDecisionGate(dispute, threshold);

      res.json({
        message: `Dispute decision gate executed successfully.`,
        gateResult,
      });
    } catch (err: any) {
      console.error('Gate dispute error:', err);
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);

// POST /api/disputes/batch-gate - execute decision gate across open disputes (Requires Reviewer Auth)
disputeRouter.post(
  '/batch-gate',
  requireReviewerAuth,
  validateBody(gateDisputeSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const db = await getDb();
      const threshold = req.body.threshold ?? getDecisionGateThreshold();

      const result = await db.query(
        `SELECT * FROM disputes WHERE status IN ('open', 'under_review') ORDER BY created_at DESC LIMIT 100`
      );
      const disputes = result.rows.map(parseDisputeRow);

      const processed = [];
      let autoApprovedCount = 0;
      let reviewCount = 0;

      for (const d of disputes) {
        const gateRes = await processDisputeDecisionGate(d, threshold);
        if (gateRes.isAutoSubmitted) autoApprovedCount++;
        else reviewCount++;
        processed.push({
          id: d.id,
          status: gateRes.status,
          score: gateRes.scoreResult.score,
          isAutoSubmitted: gateRes.isAutoSubmitted,
        });
      }

      res.json({
        message: `Processed decision gate for ${disputes.length} disputes.`,
        totalProcessed: disputes.length,
        autoApprovedCount,
        reviewCount,
        thresholdUsed: threshold,
        disputes: processed,
      });
    } catch (err: any) {
      console.error('Batch gate error:', err);
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);

// POST /api/disputes/:id/review - protected human reviewer approval/override (Requires Reviewer Auth)
disputeRouter.post(
  '/:id/review',
  requireReviewerAuth,
  validateBody(reviewDisputeSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const disputeId = String(req.params.id);
      const db = await getDb();
      const result = await db.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Not Found', message: `Dispute ${disputeId} not found.` });
        return;
      }

      const dispute = parseDisputeRow(result.rows[0]);
      const { action, status, reviewer_notes, explanation_letter } = req.body;
      const reviewer = req.reviewer!;

      let newStatus = dispute.status;
      let newEvidence = { ...dispute.evidence };

      if (action === 'APPROVE_SUBMISSION') {
        newStatus = 'ready_to_submit';
      } else if (action === 'OVERRIDE_STATUS' && status) {
        newStatus = status;
      }

      if (explanation_letter) {
        const validation = validateExplanationLetter(explanation_letter, dispute);
        if (!validation.isValid) {
          res.status(400).json({
            error: 'Anti-Hallucination Validation Error',
            violations: validation.violations,
          });
          return;
        }
        newEvidence.explanation_letter = explanation_letter;
      }

      await db.query(
        `UPDATE disputes SET status = $1, evidence = $2 WHERE id = $3`,
        [newStatus, JSON.stringify(newEvidence), dispute.id]
      );

      const auditAction =
        action === 'APPROVE_SUBMISSION' ? 'HUMAN_APPROVED' : 'HUMAN_OVERRIDDEN';

      const auditLog = await createAuditLogEntry({
        dispute_id: dispute.id,
        action: auditAction,
        score: dispute.win_score || null,
        decision: `Reviewer ${reviewer.name} (${reviewer.email}) performed ${action}. Status: ${newStatus}`,
        threshold_used: getDecisionGateThreshold(),
        factors: dispute.factors || null,
        explanation_letter: newEvidence.explanation_letter,
        reviewer_id: reviewer.id,
        reviewer_notes: `[Action: ${action}] ${reviewer_notes}`,
      });

      res.json({
        message: 'Review action recorded successfully.',
        status: newStatus,
        evidence: newEvidence,
        auditLogId: auditLog.id,
      });
    } catch (err: any) {
      console.error('Review dispute error:', err);
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);
