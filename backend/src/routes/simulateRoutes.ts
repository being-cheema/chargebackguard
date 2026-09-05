import { Router, Request, Response } from 'express';
import { REASON_CODE_REGISTRY } from '../config/reasonCodes';
import { calculateDisputeScore } from '../scoring/engine';
import { getDecisionGateThreshold } from '../config/settings';
import { draftExplanationLetter } from '../drafting/drafter';
import { DisputeRecord } from '../types';
import { validateBody, simulateDisputeSchema } from '../middleware/validation';

export const simulateRouter = Router();

// GET /api/reason-codes - get full reason code registry
simulateRouter.get('/reason-codes', (req: Request, res: Response) => {
  res.json({
    reasonCodes: Object.values(REASON_CODE_REGISTRY),
  });
});

// POST /api/simulate - simulate scoring and drafting for arbitrary parameters
simulateRouter.post(
  '/',
  validateBody(simulateDisputeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        reason_code,
        amount,
        days_since_transaction,
        customer_dispute_history_count,
        ip_matches_billing_country,
        merchant_response_time_hours,
        evidence,
        threshold = getDecisionGateThreshold(),
      } = req.body;

      const now = Math.floor(Date.now() / 1000);

      // Create transient dispute record matching domain model
      const simulatedDispute: DisputeRecord = {
        id: 'disp_simulated_' + Math.random().toString(36).substring(2, 9),
        payment_id: 'pay_simulated_' + Math.random().toString(36).substring(2, 9),
        amount,
        currency: 'INR',
        reason_code,
        respond_by: now + 86400 * 7,
        status: 'open',
        phase: 'chargeback',
        created_at: now - days_since_transaction * 86400,
        evidence: {
          shipping_proof: evidence.shipping_proof || null,
          billing_proof: evidence.billing_proof || null,
          cancellation_proof: evidence.cancellation_proof || null,
          customer_communication: evidence.customer_communication || null,
          proof_of_service: evidence.proof_of_service || null,
          explanation_letter: null,
          refund_confirmation: evidence.refund_confirmation || null,
          access_activity_log: evidence.access_activity_log || null,
          refund_cancellation_policy: evidence.refund_cancellation_policy || null,
          term_and_conditions: evidence.term_and_conditions || null,
          others: evidence.others || null,
        },
        split: 'train',
        days_since_transaction,
        customer_dispute_history_count,
        ip_matches_billing_country,
        merchant_response_time_hours,
        ground_truth_outcome: 'won', // not used in simulation scoring
      };

      const scoreResult = calculateDisputeScore(simulatedDispute, { threshold });
      const draftResult = await draftExplanationLetter(simulatedDispute, scoreResult);

      res.json({
        dispute: simulatedDispute,
        scoreResult,
        draftResult,
        thresholdUsed: threshold,
        isAutoSubmitted: scoreResult.score >= threshold,
      });
    } catch (err: any) {
      console.error('Simulation error:', err);
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);
