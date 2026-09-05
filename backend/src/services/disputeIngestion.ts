import crypto from 'crypto';
import { getDb } from '../db';
import { mapRazorpayDisputeToRecord } from '../razorpay/mapper';
import { RazorpayDisputeEntity, RazorpayWebhookPayload } from '../razorpay/types';
import { calculateDisputeScore } from '../scoring/engine';
import { getDecisionGateThreshold } from '../config/settings';

export async function upsertDisputeFromRazorpay(
  entity: RazorpayDisputeEntity,
  ingestionSource: 'webhook' | 'sync' | 'simulate'
): Promise<{ disputeId: string; isNew: boolean }> {
  const db = await getDb();
  const mapped = mapRazorpayDisputeToRecord(entity);

  const existing = await db.query(`SELECT id FROM disputes WHERE id = $1`, [entity.id]);

  if (existing.rows.length === 0) {
    await db.query(
      `
      INSERT INTO disputes (
        id, payment_id, amount, currency, reason_code, respond_by,
        status, phase, created_at, evidence, split, days_since_transaction,
        customer_dispute_history_count, ip_matches_billing_country,
        merchant_response_time_hours, ground_truth_outcome, label_source,
        ingestion_source, razorpay_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    `,
      [
        mapped.id,
        mapped.payment_id,
        mapped.amount,
        mapped.currency,
        mapped.reason_code,
        mapped.respond_by,
        mapped.status,
        mapped.phase,
        mapped.created_at,
        JSON.stringify(mapped.evidence),
        'train',
        mapped.days_since_transaction,
        mapped.customer_dispute_history_count,
        mapped.ip_matches_billing_country,
        mapped.merchant_response_time_hours,
        'won',
        'razorpay_live',
        ingestionSource,
        entity.status,
      ]
    );
    return { disputeId: mapped.id, isNew: true };
  }

  await db.query(
    `
    UPDATE disputes SET
      payment_id = $2, amount = $3, reason_code = $4, respond_by = $5,
      status = $6, phase = $7, evidence = $8, ingestion_source = $9,
      razorpay_status = $10, label_source = 'razorpay_live'
    WHERE id = $1
  `,
    [
      mapped.id,
      mapped.payment_id,
      mapped.amount,
      mapped.reason_code,
      mapped.respond_by,
      mapped.status,
      mapped.phase,
      JSON.stringify(mapped.evidence),
      ingestionSource,
      entity.status,
    ]
  );

  return { disputeId: mapped.id, isNew: false };
}

export async function recordWebhookEvent(
  eventType: string,
  disputeId: string | null,
  payload: unknown,
  signatureValid: boolean
): Promise<string> {
  const db = await getDb();
  const id = 'whk_' + crypto.randomBytes(8).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  await db.query(
    `
    INSERT INTO webhook_events (id, event_type, dispute_id, payload, signature_valid, processed_at, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,
    [id, eventType, disputeId, JSON.stringify(payload), signatureValid, now, now]
  );

  return id;
}

export async function processDisputeWebhookEvent(
  payload: RazorpayWebhookPayload
): Promise<{ disputeId: string | null; action: string }> {
  const disputeEntity = payload.payload?.dispute?.entity;
  if (!disputeEntity) {
    return { disputeId: null, action: 'ignored_no_dispute_entity' };
  }

  const { disputeId, isNew } = await upsertDisputeFromRazorpay(disputeEntity, 'webhook');

  if (payload.event === 'payment.dispute.created' && isNew) {
    const db = await getDb();
    const result = await db.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
    const row = result.rows[0];
    if (row) {
      const threshold = getDecisionGateThreshold();
      const score = calculateDisputeScore({
        ...row,
        evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence,
      }, { threshold });
      await db.query(
        `UPDATE disputes SET win_score = $1, factors = $2, status = $3 WHERE id = $4`,
        [
          score.score,
          JSON.stringify(score.factors),
          score.recommendation === 'AUTO_SUBMIT' ? 'needs_human_review' : 'needs_human_review',
          disputeId,
        ]
      );
    }
    return { disputeId, action: 'dispute_created_scored' };
  }

  if (payload.event === 'payment.dispute.under_review') {
    await getDb().then((db) =>
      db.query(`UPDATE disputes SET status = 'under_review', razorpay_status = 'under_review' WHERE id = $1`, [
        disputeId,
      ])
    );
    return { disputeId, action: 'status_under_review' };
  }

  if (payload.event === 'payment.dispute.won') {
    await getDb().then((db) =>
      db.query(`UPDATE disputes SET status = 'won', razorpay_status = 'won' WHERE id = $1`, [disputeId])
    );
    return { disputeId, action: 'status_won' };
  }

  if (payload.event === 'payment.dispute.lost') {
    await getDb().then((db) =>
      db.query(`UPDATE disputes SET status = 'lost', razorpay_status = 'lost' WHERE id = $1`, [disputeId])
    );
    return { disputeId, action: 'status_lost' };
  }

  return { disputeId, action: 'dispute_upserted' };
}

export function buildSimulatedDisputeWebhookPayload(
  overrides: Partial<RazorpayDisputeEntity> = {}
): RazorpayWebhookPayload {
  const now = Math.floor(Date.now() / 1000);
  const disputeId = overrides.id || `disp_sim_${crypto.randomBytes(6).toString('hex')}`;
  const paymentId = overrides.payment_id || `pay_sim_${crypto.randomBytes(6).toString('hex')}`;

  const entity: RazorpayDisputeEntity = {
    id: disputeId,
    entity: 'dispute',
    payment_id: paymentId,
    amount: overrides.amount ?? 450000,
    currency: 'INR',
    reason_code: overrides.reason_code ?? 'RZP01',
    respond_by: overrides.respond_by ?? now + 7 * 86400,
    status: overrides.status ?? 'open',
    phase: overrides.phase ?? 'chargeback',
    created_at: overrides.created_at ?? now,
    evidence: overrides.evidence ?? {},
  };

  return {
    entity: 'event',
    account_id: 'acc_simulated',
    event: 'payment.dispute.created',
    contains: ['payment', 'dispute'],
    payload: {
      payment: { entity: { id: paymentId, amount: entity.amount, currency: 'INR' } },
      dispute: { entity },
    },
    created_at: now,
  };
}
