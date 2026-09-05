import crypto from 'crypto';
import { getDb } from '../db';
import { AuditAction, AuditLogRecord } from '../types';

export async function createAuditLogEntry(entry: {
  dispute_id: string;
  action: AuditAction;
  score: number | null;
  decision: string;
  threshold_used: number;
  factors: { positive: string[]; negative: string[] } | null;
  explanation_letter?: string | null;
  reviewer_id?: string | null;
  reviewer_notes?: string | null;
}): Promise<AuditLogRecord> {
  const db = await getDb();
  const id = 'aud_' + crypto.randomBytes(8).toString('hex');
  const createdAt = Math.floor(Date.now() / 1000);

  const record: AuditLogRecord = {
    id,
    dispute_id: entry.dispute_id,
    action: entry.action,
    score: entry.score,
    decision: entry.decision,
    threshold_used: entry.threshold_used,
    factors: entry.factors,
    explanation_letter: entry.explanation_letter || null,
    reviewer_id: entry.reviewer_id || null,
    reviewer_notes: entry.reviewer_notes || null,
    created_at: createdAt,
  };

  await db.query(
    `
    INSERT INTO audit_logs (
      id, dispute_id, action, score, decision, threshold_used,
      factors, explanation_letter, reviewer_id, reviewer_notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `,
    [
      record.id,
      record.dispute_id,
      record.action,
      record.score,
      record.decision,
      record.threshold_used,
      record.factors ? JSON.stringify(record.factors) : null,
      record.explanation_letter,
      record.reviewer_id,
      record.reviewer_notes,
      record.created_at,
    ]
  );

  return record;
}

export async function getAuditLogsForDispute(disputeId: string): Promise<AuditLogRecord[]> {
  const db = await getDb();
  const result = await db.query<AuditLogRecord>(
    `SELECT * FROM audit_logs WHERE dispute_id = $1 ORDER BY created_at DESC`,
    [disputeId]
  );
  return result.rows.map((row: any) => ({
    ...row,
    factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors,
  }));
}

export async function getRecentAuditLogs(limit: number = 50): Promise<AuditLogRecord[]> {
  const db = await getDb();
  const result = await db.query<AuditLogRecord>(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map((row: any) => ({
    ...row,
    factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors,
  }));
}
