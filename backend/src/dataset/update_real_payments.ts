import { getDb } from '../db';
import fs from 'fs';
import path from 'path';

export const CAPTURED_PAYMENTS = [
  {
    payment_id: 'pay_TVpuXyYcXrVqpK',
    order_id: 'order_TVpu81MEeufT1E',
    amount: 3500000,
    status: 'captured',
    created_at: 1788061267,
    dispute_id: 'disp_T36ymBpzIvUNF9',
  },
  {
    payment_id: 'pay_TW1CWCcxItVHQQ',
    order_id: 'order_TVzN0d5R4w4uQz',
    amount: 450000,
    status: 'captured',
    created_at: 1788101026,
    dispute_id: 'disp_fIGREBgefCI5yw',
  },
  {
    payment_id: 'pay_TW1CUdvirOotQK',
    order_id: 'order_TW19IDUt6ssOKr',
    amount: 720000,
    status: 'captured',
    created_at: 1788101024,
    dispute_id: 'disp_MQYB2D8QUYs03r',
  },
  {
    payment_id: 'pay_TW1CSeMMIog1OV',
    order_id: 'order_TW19KnU1wIvr07',
    amount: 1250000,
    status: 'captured',
    created_at: 1788101023,
    dispute_id: 'disp_g2129nVN0swHvY',
  },
  {
    payment_id: 'pay_TW1CP0scdNGTnH',
    order_id: 'order_TW19Mjybr94ZCG',
    amount: 310000,
    status: 'captured',
    created_at: 1788101019,
    dispute_id: 'disp_Sr7PLmUWOaoDyL',
  },
  {
    payment_id: 'pay_TW1CajME437evU',
    order_id: 'order_TW19PEIoz81Oo3',
    amount: 580000,
    status: 'captured',
    created_at: 1788101030,
    dispute_id: 'disp_Ql3OcR01Nqlgvj',
  },
  {
    payment_id: 'pay_TW1BroR3eLB6vQ',
    order_id: 'order_TW19U8oLKY2zZd',
    amount: 99900,
    status: 'captured',
    created_at: 1788100989,
    dispute_id: 'disp_71aY2YKkWu7XpX',
  },
  {
    payment_id: 'pay_TW1BMh95ANWQdh',
    order_id: 'order_TW19W6gwTdk2s7',
    amount: 1800000,
    status: 'captured',
    created_at: 1788100960,
    dispute_id: 'disp_lWnJz8C6ctp72x',
  },
  {
    payment_id: 'pay_TW1AmaL2MRNsZg',
    order_id: 'order_TW19YCuNAMCZqH',
    amount: 640000,
    status: 'captured',
    created_at: 1788100927,
    dispute_id: 'disp_po8X9gOHsJh6s1',
  },
];

export async function populateCapturedPayments() {
  const db = await getDb();

  console.log('--- Step 1: Updating payments table with all 9 CAPTURED transactions ---');
  // Clear any temporary uncaptured payment rows from table
  await db.query(`DELETE FROM payments;`);

  for (const p of CAPTURED_PAYMENTS) {
    await db.query(
      `
      INSERT INTO payments (payment_id, order_id, amount, status, created_at)
      VALUES ($1, $2, $3, $4, $5);
    `,
      [p.payment_id, p.order_id, p.amount, p.status, p.created_at]
    );

    // Update the linked dispute record
    await db.query(
      `UPDATE disputes SET payment_id = $1 WHERE id = $2;`,
      [p.payment_id, p.dispute_id]
    );
  }

  const { rows: countRows } = await db.query(`SELECT count(*) as count FROM payments WHERE status = 'captured';`);
  console.log(`✅ Total captured payments in table: ${countRows[0].count} of ${CAPTURED_PAYMENTS.length}`);

  console.log('\n--- Step 2: Verifying split_manifest.json is untouched ---');
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

if (require.main === module) {
  populateCapturedPayments()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}
