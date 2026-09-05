import { DisputeRecord } from '../types';

export type PublicDisputeRecord = Omit<DisputeRecord, 'ground_truth_outcome' | 'split'> & {
  label_source?: string;
  razorpay_status?: string | null;
  razorpay_contested_at?: number | null;
  ingestion_source?: string | null;
};

export function parseDisputeRow(row: Record<string, unknown>): DisputeRecord {
  return {
    ...(row as unknown as DisputeRecord),
    amount: Number(row.amount),
    respond_by: Number(row.respond_by),
    created_at: Number(row.created_at),
    days_since_transaction: Number(row.days_since_transaction),
    customer_dispute_history_count: Number(row.customer_dispute_history_count),
    merchant_response_time_hours: Number(row.merchant_response_time_hours),
    win_score: row.win_score != null ? Number(row.win_score) : undefined,
    evidence:
      typeof row.evidence === 'string' ? JSON.parse(row.evidence) : (row.evidence as DisputeRecord['evidence']),
    factors:
      typeof row.factors === 'string' ? JSON.parse(row.factors) : (row.factors as DisputeRecord['factors']),
  };
}

export function toPublicDispute(row: Record<string, unknown>): PublicDisputeRecord {
  const dispute = parseDisputeRow(row);
  const { ground_truth_outcome: _gt, split: _split, ...publicFields } = dispute;

  return {
    ...publicFields,
    label_source: (row.label_source as string) || 'synthetic',
    razorpay_status: (row.razorpay_status as string) || null,
    razorpay_contested_at: row.razorpay_contested_at != null ? Number(row.razorpay_contested_at) : null,
    ingestion_source: (row.ingestion_source as string) || null,
  };
}
