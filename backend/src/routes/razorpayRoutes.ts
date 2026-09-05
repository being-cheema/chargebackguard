import { Router, Response } from 'express';
import { getDb } from '../db';
import { requireReviewerAuth, AuthenticatedRequest } from '../middleware/auth';
import { getRazorpayConfig } from '../config/settings';
import { fetchAllDisputes } from '../razorpay/disputes';
import { upsertDisputeFromRazorpay } from '../services/disputeIngestion';
import { submitDisputeContestToRazorpay } from '../razorpay/contest';
import { parseDisputeRow, toPublicDispute } from '../utils/disputeSerializer';
import { createAuditLogEntry } from '../audit/auditService';
import { RazorpayApiError } from '../razorpay/client';
import { CAPTURED_PAYMENTS } from '../dataset/update_real_payments';

export const razorpayRouter = Router();

razorpayRouter.get('/status', (_req, res) => {
  const config = getRazorpayConfig();
  res.json({
    configured: config.isConfigured,
    contestMode: config.contestMode,
    capturedPaymentsCount: CAPTURED_PAYMENTS.length,
    docsUrl: 'https://razorpay.com/docs/api/disputes/',
  });
});

razorpayRouter.get('/payments', async (_req, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { rows } = await db.query(`
      SELECT p.*, d.id as dispute_id, d.status as dispute_status, d.reason_code
      FROM payments p
      LEFT JOIN disputes d ON d.payment_id = p.payment_id
      ORDER BY p.created_at ASC
    `);

    if (rows.length === 0) {
      res.json({
        payments: CAPTURED_PAYMENTS,
        source: 'hardcoded_fallback',
        note: 'Run npm run seed:payments to load into database.',
      });
      return;
    }

    res.json({ payments: rows, source: 'database', total: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payments';
    res.status(500).json({ error: 'Server Error', message });
  }
});

razorpayRouter.post('/sync', requireReviewerAuth, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = getRazorpayConfig();
    if (!config.isConfigured) {
      res.status(503).json({
        error: 'Not Configured',
        message: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to sync live disputes.',
      });
      return;
    }

    const disputes = await fetchAllDisputes(100);
    const results = [];

    for (const d of disputes) {
      const result = await upsertDisputeFromRazorpay(d, 'sync');
      results.push({ id: d.id, ...result, status: d.status });
    }

    res.json({
      message: `Synced ${disputes.length} disputes from Razorpay`,
      synced: results,
    });
  } catch (err: unknown) {
    if (err instanceof RazorpayApiError) {
      res.status(err.statusCode).json({ error: 'Razorpay API Error', message: err.message, details: err.body });
      return;
    }
    const message = err instanceof Error ? err.message : 'Sync failed';
    res.status(500).json({ error: 'Server Error', message });
  }
});

razorpayRouter.post(
  '/disputes/:id/contest',
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

      if (dispute.status !== 'ready_to_submit' && dispute.status !== 'under_review') {
        res.status(400).json({
          error: 'Invalid State',
          message: 'Dispute must be ready_to_submit before Razorpay contest. Run decision gate first.',
        });
        return;
      }

      const contestResult = await submitDisputeContestToRazorpay(dispute);
      const now = Math.floor(Date.now() / 1000);

      await db.query(
        `UPDATE disputes SET razorpay_status = $1, razorpay_contested_at = $2, razorpay_document_ids = $3, status = $4 WHERE id = $5`,
        [
          contestResult.mode === 'submit' ? 'under_review' : 'ready_to_submit',
          now,
          JSON.stringify(contestResult.documentIds),
          contestResult.mode === 'submit' ? 'under_review' : dispute.status,
          disputeId,
        ]
      );

      const auditLog = await createAuditLogEntry({
        dispute_id: disputeId,
        action: contestResult.mode === 'submit' ? 'RAZORPAY_SUBMITTED' : 'RAZORPAY_DRAFTED',
        score: dispute.win_score ?? null,
        decision: `Razorpay contest ${contestResult.mode} for dispute ${disputeId}`,
        threshold_used: dispute.win_score ?? 0.75,
        factors: dispute.factors || null,
        reviewer_id: req.reviewer?.id,
        reviewer_notes: `Document IDs: [${contestResult.documentIds.join(', ')}]. Sample evidence: ${contestResult.usedSampleEvidence}`,
      });

      res.json({
        message: `Dispute contest ${contestResult.mode} sent to Razorpay`,
        contestResult,
        auditLogId: auditLog.id,
        dispute: toPublicDispute(result.rows[0]),
      });
    } catch (err: unknown) {
      if (err instanceof RazorpayApiError) {
        res.status(err.statusCode).json({ error: 'Razorpay API Error', message: err.message, details: err.body });
        return;
      }
      const message = err instanceof Error ? err.message : 'Contest failed';
      res.status(500).json({ error: 'Server Error', message });
    }
  }
);

razorpayRouter.get('/webhook-events', async (req, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT id, event_type, dispute_id, signature_valid, processed_at, created_at FROM webhook_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ total: rows.length, events: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch webhook events';
    res.status(500).json({ error: 'Server Error', message });
  }
});
