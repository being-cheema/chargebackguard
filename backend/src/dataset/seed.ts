import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { generateSyntheticDisputes } from './generator';
import { DisputeRecord } from '../types';

export async function seedDatabase(count: number = 450): Promise<{
  total: number;
  trainCount: number;
  heldOutCount: number;
  manifestPath: string;
}> {
  console.log(`🌱 Generating ${count} synthetic dispute cases across Razorpay reason codes...`);
  const disputes: DisputeRecord[] = generateSyntheticDisputes(count);

  const trainCount = disputes.filter((d) => d.split === 'train').length;
  const heldOutCount = disputes.filter((d) => d.split === 'held_out').length;

  // Calculate SHA256 checksum of generated dataset to guarantee immutable split
  const datasetJson = JSON.stringify(disputes);
  const datasetHash = crypto.createHash('sha256').update(datasetJson).digest('hex');

  const manifest = {
    generated_at: new Date().toISOString(),
    dataset_sha256: datasetHash,
    total_records: disputes.length,
    train_records: trainCount,
    held_out_records: heldOutCount,
    split_ratio: '70/30',
    reason_codes_represented: Array.from(new Set(disputes.map((d) => d.reason_code))),
    notes: 'Committed fixed train/held-out split for ChargebackGuard AI Buildathon Track 02 evaluation.',
  };

  const dataDir = path.resolve(__dirname, '../../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const manifestPath = path.join(dataDir, 'split_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`📝 Fixed split manifest saved to: ${manifestPath}`);

  // Also write raw dataset backup
  const rawDatasetPath = path.join(dataDir, 'synthetic_disputes.json');
  fs.writeFileSync(rawDatasetPath, datasetJson, 'utf-8');
  console.log(`💾 Raw dataset backup saved to: ${rawDatasetPath}`);

  // Seed database
  const db = await getDb();

  // Clear existing records
  await db.query('DELETE FROM disputes');
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM reviewers');

  console.log('Inserting disputes into database...');
  for (const d of disputes) {
    await db.query(
      `
      INSERT INTO disputes (
        id, payment_id, amount, currency, reason_code, respond_by,
        status, phase, created_at, evidence, split, days_since_transaction,
        customer_dispute_history_count, ip_matches_billing_country,
        merchant_response_time_hours, ground_truth_outcome
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `,
      [
        d.id,
        d.payment_id,
        d.amount,
        d.currency,
        d.reason_code,
        d.respond_by,
        d.status,
        d.phase,
        d.created_at,
        JSON.stringify(d.evidence),
        d.split,
        d.days_since_transaction,
        d.customer_dispute_history_count,
        d.ip_matches_billing_country,
        d.merchant_response_time_hours,
        d.ground_truth_outcome,
      ]
    );
  }

  // Create default reviewer user
  const passwordHash = await bcrypt.hash('Chargeback@2026', 10);
  await db.query(
    `
    INSERT INTO reviewers (id, email, password_hash, name, role, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
    [
      'rev_razorpay_admin',
      'analyst@razorpay.com',
      passwordHash,
      'Senior Risk Analyst',
      'risk_analyst',
      Math.floor(Date.now() / 1000),
    ]
  );

  console.log('✅ Seed complete:');
  console.log(`   - Total Disputes: ${disputes.length}`);
  console.log(`   - Train Set: ${trainCount} (70%)`);
  console.log(`   - Held-Out Set: ${heldOutCount} (30%)`);
  console.log(`   - Default Reviewer: analyst@razorpay.com / Chargeback@2026`);

  return {
    total: disputes.length,
    trainCount,
    heldOutCount,
    manifestPath,
  };
}

if (require.main === module) {
  seedDatabase(450)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
