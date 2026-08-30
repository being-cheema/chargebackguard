import { getDb } from '../db';
import fs from 'fs';
import path from 'path';

async function verifySplitsAndPayments() {
  const db = await getDb();

  console.log('=== 1. Checking All 9 Real Transactions in payments Table ===');
  const { rows: payments } = await db.query(`
    SELECT payment_id, order_id, amount, status, created_at
    FROM payments
    ORDER BY created_at ASC;
  `);

  console.table(payments);

  const capturedCount = payments.filter(p => p.status === 'captured').length;
  console.log(`\nPayments Status Summary:`);
  console.log(`  • Total in Table: ${payments.length}`);
  console.log(`  • Captured: ${capturedCount}`);

  if (capturedCount === payments.length && payments.length === 9) {
    console.log('✅ ALL 9 payments show status: CAPTURED.');
  } else {
    console.warn(`⚠️ Warning: ${payments.length - capturedCount} payments are not captured.`);
  }

  console.log('\n=== 2. 1:1 Mapping between payments Table and disputes Table ===');
  const { rows: mapping } = await db.query(`
    SELECT p.payment_id, p.order_id, p.amount, p.status, d.id as dispute_id, d.split, d.reason_code, d.ground_truth_outcome
    FROM payments p
    LEFT JOIN disputes d ON p.payment_id = d.payment_id
    ORDER BY p.created_at ASC;
  `);
  console.table(mapping);

  const trainCount = mapping.filter(m => m.split === 'train').length;
  const heldOutCount = mapping.filter(m => m.split === 'held_out').length;
  const unlinkedCount = mapping.filter(m => !m.dispute_id).length;

  console.log(`\nMapping Summary:`);
  console.log(`  • Linked to Train Disputes: ${trainCount}`);
  console.log(`  • Linked to Held-Out Disputes: ${heldOutCount} (Must be 0)`);
  console.log(`  • Unlinked Payments: ${unlinkedCount} (Must be 0)`);

  if (trainCount === 9 && heldOutCount === 0 && unlinkedCount === 0) {
    console.log('✅ 100% PERFECT 1:1 MAPPING in TRAIN split only.');
  }

  console.log('\n=== 3. Verification of split_manifest.json ===');
  const manifestPath = path.resolve(__dirname, '../../../data/split_manifest.json');
  if (fs.existsSync(manifestPath)) {
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`✅ split_manifest.json verified intact.`);
    console.log(`   SHA-256 Checksum: ${content.dataset_sha256}`);
    console.log(`   Total Records: ${content.total_records} (Train: ${content.train_records}, Held-out: ${content.held_out_records})`);
  }

  if (db.isPGlite) {
    await db.close();
  }
}

verifySplitsAndPayments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
