import request from 'supertest';
import { app } from '../src/app';
import { getDb } from '../src/db';
import { seedDatabase } from '../src/dataset/seed';

describe('ChargebackGuard API Integration Tests', () => {
  let reviewerToken = '';
  let sampleDisputeId = '';

  beforeAll(async () => {
    // Seed test dataset
    await seedDatabase(50);

    const db = await getDb();
    const result = await db.query(`SELECT id FROM disputes LIMIT 1`);
    sampleDisputeId = result.rows[0].id;
  });

  test('GET /health returns healthy status and dispute count', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.totalDisputesInDb).toBeGreaterThan(0);
  });

  test('POST /api/auth/login succeeds with valid credentials and returns JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'analyst@razorpay.com',
      password: 'Chargeback@2026',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.reviewer.email).toBe('analyst@razorpay.com');
    reviewerToken = res.body.token;
  });

  test('POST /api/auth/login fails with invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'analyst@razorpay.com',
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid Credentials');
  });

  test('GET /api/disputes returns paginated disputes list and status counts', async () => {
    const res = await request(app).get('/api/disputes?limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.disputes.length).toBeLessThanOrEqual(10);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.statusCounts).toBeDefined();
  });

  test('GET /api/disputes/:id returns single dispute with score breakdown', async () => {
    const res = await request(app).get(`/api/disputes/${sampleDisputeId}`);
    expect(res.status).toBe(200);
    expect(res.body.dispute.id).toBe(sampleDisputeId);
    expect(res.body.scoreResult).toBeDefined();
    expect(res.body.scoreResult.score).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/disputes/:id/score calculates and updates score', async () => {
    const res = await request(app).post(`/api/disputes/${sampleDisputeId}/score`).send({
      threshold: 0.75,
    });
    expect(res.status).toBe(200);
    expect(res.body.scoreResult.score).toBeDefined();
    expect(res.body.scoreResult.factors).toBeDefined();
  });

  test('POST /api/disputes/:id/draft generates non-hallucinating letter', async () => {
    const res = await request(app).post(`/api/disputes/${sampleDisputeId}/draft`);
    expect(res.status).toBe(200);
    expect(res.body.draftResult.letter.length).toBeGreaterThan(0);
    expect(res.body.draftResult.validation.isValid).toBe(true);
    expect(res.body.draftResult.characterCount).toBeLessThanOrEqual(1000);
  });

  test('POST /api/disputes/:id/gate executes decision gate and updates status', async () => {
    const res = await request(app).post(`/api/disputes/${sampleDisputeId}/gate`).send({
      threshold: 0.75,
    });
    expect(res.status).toBe(200);
    expect(res.body.gateResult.status).toBeDefined();
    expect(['ready_to_submit', 'needs_human_review']).toContain(res.body.gateResult.status);
  });

  test('POST /api/disputes/:id/review rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(`/api/disputes/${sampleDisputeId}/review`).send({
      action: 'APPROVE_SUBMISSION',
      reviewer_notes: 'Approving without auth token',
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/disputes/:id/review accepts authenticated reviewer action and writes audit log', async () => {
    const res = await request(app)
      .post(`/api/disputes/${sampleDisputeId}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        action: 'APPROVE_SUBMISSION',
        reviewer_notes: 'Manually approved after verifying customer proof.',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready_to_submit');
    expect(res.body.auditLogId).toBeDefined();

    // Verify audit log has the reviewer entry
    const auditRes = await request(app).get(`/api/audit/${sampleDisputeId}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.logs.some((l: any) => l.action === 'HUMAN_APPROVED')).toBe(true);
  });

  test('GET /api/metrics returns held-out metrics report and sensitivity curve', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.metrics.precision).toBeGreaterThan(0);
    expect(res.body.metrics.recall).toBeGreaterThan(0);
    expect(res.body.threshold_sensitivity_curve.length).toBeGreaterThan(0);
  });

  test('POST /api/simulate performs interactive real-time scoring and drafting', async () => {
    const res = await request(app).post('/api/simulate').send({
      reason_code: 'RZP01',
      amount: 850000,
      days_since_transaction: 4,
      customer_dispute_history_count: 0,
      ip_matches_billing_country: true,
      merchant_response_time_hours: 5,
      evidence: {
        shipping_proof: 'https://cdn.razorpay.com/shipping.pdf',
        proof_of_service: 'https://cdn.razorpay.com/service.pdf',
      },
      threshold: 0.75,
    });

    expect(res.status).toBe(200);
    expect(res.body.scoreResult.score).toBeGreaterThanOrEqual(0.75);
    expect(res.body.isAutoSubmitted).toBe(true);
    expect(res.body.draftResult.validation.isValid).toBe(true);
  });
});
