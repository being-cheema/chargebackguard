import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export interface DatabaseInterface {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  close(): Promise<void>;
  isPGlite: boolean;
}

let dbInstance: DatabaseInterface | null = null;

export async function getDb(): Promise<DatabaseInterface> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const pool = new Pool({ connectionString: databaseUrl });
      // Test connection
      await pool.query('SELECT 1');
      console.log('✅ Connected to external PostgreSQL database via DATABASE_URL');
      
      dbInstance = {
        query: async <T = any>(text: string, params?: any[]) => {
          const res = await pool.query(text, params);
          return { rows: res.rows as T[], rowCount: res.rowCount || 0 };
        },
        close: async () => {
          await pool.end();
        },
        isPGlite: false,
      };
      await initSchema(dbInstance);
      return dbInstance;
    } catch (err: any) {
      console.warn(`⚠️ Failed to connect to DATABASE_URL: ${err.message}. Falling back to embedded PGlite.`);
    }
  }

  // Use embedded PGlite database
  const dataDir = path.resolve(__dirname, '../../data/pglite_db');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = new PGlite(dataDir);
  console.log(`✅ Initialized embedded PostgreSQL (PGlite) at: ${dataDir}`);

  dbInstance = {
    query: async <T = any>(text: string, params?: any[]) => {
      const res = await pglite.query(text, params || []);
      return { rows: res.rows as T[], rowCount: res.rows.length };
    },
    close: async () => {
      await pglite.close();
    },
    isPGlite: true,
  };

  await initSchema(dbInstance);
  return dbInstance;
}

export async function initSchema(db: DatabaseInterface): Promise<void> {
  // Disputes table matching Razorpay schema exactly + metadata
  await db.query(`
    CREATE TABLE IF NOT EXISTS disputes (
      id VARCHAR(64) PRIMARY KEY,
      payment_id VARCHAR(64) NOT NULL,
      amount BIGINT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      reason_code VARCHAR(32) NOT NULL,
      respond_by BIGINT NOT NULL,
      status VARCHAR(64) NOT NULL,
      phase VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL,
      evidence JSONB NOT NULL,
      split VARCHAR(32) NOT NULL,
      days_since_transaction INTEGER NOT NULL,
      customer_dispute_history_count INTEGER NOT NULL,
      ip_matches_billing_country BOOLEAN NOT NULL,
      merchant_response_time_hours DOUBLE PRECISION NOT NULL,
      ground_truth_outcome VARCHAR(32) NOT NULL,
      win_score DOUBLE PRECISION,
      factors JSONB
    );
  `);

  // Payments table for real Razorpay test-mode transactions
  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      payment_id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      amount BIGINT NOT NULL,
      status VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  // Audit log table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      dispute_id VARCHAR(64) NOT NULL,
      action VARCHAR(128) NOT NULL,
      score DOUBLE PRECISION,
      decision TEXT NOT NULL,
      threshold_used DOUBLE PRECISION NOT NULL,
      factors JSONB,
      explanation_letter TEXT,
      reviewer_id VARCHAR(128),
      reviewer_notes TEXT,
      created_at BIGINT NOT NULL
    );
  `);

  // Reviewers table for reviewer JWT authentication
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviewers (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(128) UNIQUE NOT NULL,
      password_hash VARCHAR(256) NOT NULL,
      name VARCHAR(128) NOT NULL,
      role VARCHAR(64) NOT NULL DEFAULT 'risk_analyst',
      created_at BIGINT NOT NULL
    );
  `);

  // Alter existing column types if table already existed in pglite_db
  try {
    await db.query(`ALTER TABLE audit_logs ALTER COLUMN decision TYPE TEXT;`);
    await db.query(`ALTER TABLE audit_logs ALTER COLUMN action TYPE VARCHAR(128);`);
  } catch (_) {
    // ignore if already updated
  }

  // Indexes for high performance
  await db.query(`CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_disputes_split ON disputes(split);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_disputes_reason_code ON disputes(reason_code);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_dispute_id ON audit_logs(dispute_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);`);
}
