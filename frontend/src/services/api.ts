import type {
  DisputeRecord,
  ScoreResult,
  DraftResult,
  AuditLogRecord,
  MetricEvaluationReport,
  ReasonCodeInfo,
  RazorpayPaymentRecord,
  WebhookEventRecord,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP error ${res.status}`);
  }
  return data as T;
}

export const api = {
  // Health
  checkHealth: async () => {
    const res = await fetch('/health');
    return res.json();
  },

  // Auth
  login: async (email: string, password: string) => {
    return fetchJson<{
      token: string;
      reviewer: { id: string; email: string; name: string; role: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Disputes (Public Read-Only)
  getDisputes: async (params: {
    status?: string;
    reason_code?: string;
    phase?: string;
    split?: string;
    search?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });
    return fetchJson<{
      total: number;
      limit: number;
      offset: number;
      statusCounts: Record<string, number>;
      disputes: DisputeRecord[];
    }>(`/disputes?${query.toString()}`);
  },

  getDispute: async (id: string) => {
    return fetchJson<{
      dispute: DisputeRecord;
      scoreResult: ScoreResult;
    }>(`/disputes/${id}`);
  },

  // State-Mutating Operations (Require Reviewer Auth Token)
  scoreDispute: async (id: string, threshold: number = 0.75, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      disputeId: string;
      scoreResult: ScoreResult;
    }>(`/disputes/${id}/score`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threshold }),
    });
  },

  draftLetter: async (id: string, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      disputeId: string;
      draftResult: DraftResult;
    }>(`/disputes/${id}/draft`, {
      method: 'POST',
      headers,
    });
  },

  gateDispute: async (id: string, threshold: number = 0.75, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      message: string;
      gateResult: {
        dispute: DisputeRecord;
        scoreResult: ScoreResult;
        status: string;
        explanationLetter: string;
        auditLogId: string;
        isAutoSubmitted: boolean;
      };
    }>(`/disputes/${id}/gate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threshold }),
    });
  },

  batchGateDisputes: async (threshold: number = 0.75, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      message: string;
      totalProcessed: number;
      autoApprovedCount: number;
      reviewCount: number;
      thresholdUsed: number;
      disputes: Array<{ id: string; status: string; score: number; isAutoSubmitted: boolean }>;
    }>('/disputes/batch-gate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ threshold }),
    });
  },

  reviewDispute: async (
    id: string,
    payload: {
      action: 'APPROVE_SUBMISSION' | 'OVERRIDE_STATUS' | 'UPDATE_LETTER';
      status?: string;
      reviewer_notes: string;
      explanation_letter?: string;
    },
    token: string
  ) => {
    return fetchJson<{
      message: string;
      status: string;
      evidence: any;
      auditLogId: string;
    }>(`/disputes/${id}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  },

  // Audit (Public Read-Only)
  getDisputeAuditLogs: async (disputeId: string) => {
    return fetchJson<{
      disputeId: string;
      totalEntries: number;
      logs: AuditLogRecord[];
    }>(`/audit/${disputeId}`);
  },

  getSystemAuditLogs: async (limit: number = 50) => {
    return fetchJson<{
      total: number;
      logs: AuditLogRecord[];
    }>(`/audit?limit=${limit}`);
  },

  // Metrics
  getMetrics: async () => {
    return fetchJson<MetricEvaluationReport>('/metrics');
  },

  recalculateMetrics: async (token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      message: string;
      results: MetricEvaluationReport;
    }>('/metrics/evaluate', {
      method: 'POST',
      headers,
    });
  },

  // Simulation Sandbox (Intentionally Public for live judge interaction)
  getReasonCodes: async () => {
    return fetchJson<{
      reasonCodes: ReasonCodeInfo[];
    }>('/simulate/reason-codes');
  },

  simulate: async (payload: any) => {
    return fetchJson<{
      dispute: DisputeRecord;
      scoreResult: ScoreResult;
      draftResult: DraftResult;
      thresholdUsed: number;
      isAutoSubmitted: boolean;
    }>('/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Razorpay Integration (Public status/read, auth for mutating actions)
  getRazorpayStatus: async () => {
    return fetchJson<{
      configured: boolean;
      contestMode: 'submit' | 'draft_only';
      capturedPaymentsCount: number;
      docsUrl: string;
    }>('/razorpay/status');
  },

  getRazorpayPayments: async () => {
    return fetchJson<{
      payments: RazorpayPaymentRecord[];
      source: 'database' | 'hardcoded_fallback';
      total?: number;
      note?: string;
    }>('/razorpay/payments');
  },

  syncRazorpayDisputes: async (token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      message: string;
      synced: Array<{ id: string; status: string }>;
    }>('/razorpay/sync', {
      method: 'POST',
      headers,
    });
  },

  contestRazorpayDispute: async (id: string, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      message: string;
      contestResult: { mode: 'submit' | 'draft_only'; documentIds: string[]; usedSampleEvidence: boolean };
      auditLogId: string;
      dispute: DisputeRecord;
    }>(`/razorpay/disputes/${id}/contest`, {
      method: 'POST',
      headers,
    });
  },

  getRazorpayWebhookEvents: async (limit: number = 20) => {
    return fetchJson<{
      total: number;
      events: WebhookEventRecord[];
    }>(`/razorpay/webhook-events?limit=${limit}`);
  },

  getWebhookStatus: async () => {
    return fetchJson<{
      webhookEndpoint: string;
      simulateEndpoint: string;
      razorpayConfigured: boolean;
      contestMode: 'submit' | 'draft_only';
      note: string;
    }>('/webhooks/status');
  },

  simulateWebhook: async (
    payload: { payment_id?: string; amount?: number; reason_code?: string; status?: string },
    token?: string | null
  ) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchJson<{
      message: string;
      event: string;
      signature: string;
    }>('/webhooks/simulate', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  },
};
