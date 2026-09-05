import { Router, Request, Response } from 'express';
import { verifyRazorpayWebhookSignature, signWebhookPayload } from '../razorpay/webhooks';
import { getRazorpayConfig } from '../config/settings';
import {
  buildSimulatedDisputeWebhookPayload,
  processDisputeWebhookEvent,
  recordWebhookEvent,
} from '../services/disputeIngestion';
import { requireReviewerAuth, AuthenticatedRequest } from '../middleware/auth';
import { RazorpayWebhookPayload } from '../razorpay/types';

export const webhookRouter = Router();

// Razorpay webhook — requires raw body (mounted with express.raw in app.ts)
webhookRouter.post('/razorpay', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body);

    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const valid = verifyRazorpayWebhookSignature(rawBody, signature);

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const disputeId = payload.payload?.dispute?.entity?.id || null;

    await recordWebhookEvent(payload.event, disputeId, payload, valid);

    if (!valid) {
      res.status(400).json({ error: 'Invalid signature', message: 'Webhook signature verification failed.' });
      return;
    }

    const result = await processDisputeWebhookEvent(payload);

    res.json({
      message: 'Webhook processed',
      event: payload.event,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Server Error', message });
  }
});

// Simulate Razorpay dispute webhook (JWT protected — for demo when test account has no disputes)
webhookRouter.post(
  '/simulate',
  requireReviewerAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        payment_id,
        amount,
        reason_code,
        status = 'open',
      } = req.body as {
        payment_id?: string;
        amount?: number;
        reason_code?: string;
        status?: string;
      };

      const payload = buildSimulatedDisputeWebhookPayload({
        payment_id,
        amount,
        reason_code,
        status,
      });

      const rawBody = JSON.stringify(payload);
      const signature = signWebhookPayload(rawBody);

      await recordWebhookEvent(payload.event, payload.payload.dispute?.entity.id || null, payload, true);
      const result = await processDisputeWebhookEvent(payload);

      res.json({
        message: 'Simulated Razorpay dispute webhook ingested',
        event: payload.event,
        signature,
        webhookPayload: payload,
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      res.status(500).json({ error: 'Server Error', message });
    }
  }
);

// Public info about webhook configuration
webhookRouter.get('/status', (_req: Request, res: Response) => {
  const config = getRazorpayConfig();
  res.json({
    webhookEndpoint: '/api/webhooks/razorpay',
    simulateEndpoint: '/api/webhooks/simulate',
    razorpayConfigured: config.isConfigured,
    contestMode: config.contestMode,
    note: 'Razorpay test mode cannot create disputes via API. Use /simulate for demo ingestion.',
  });
});
