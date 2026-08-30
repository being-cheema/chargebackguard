import type {
  DisputeRecord,
  ScoreResult,
  DraftResult,
  AuditLogRecord,
  MetricEvaluationReport,
  ReasonCodeInfo,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
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

  // Disputes
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

  scoreDispute: async (id: string, threshold: number = 0.75) => {
    return fetchJson<{
      disputeId: string;
      scoreResult: ScoreResult;
    }>(`/disputes/${id}/score`, {
      method: 'POST',
      body: JSON.stringify({ threshold }),
    });
  },

  draftLetter: async (id: string) => {
    return fetchJson<{
      disputeId: string;
      draftResult: DraftResult;
    }>(`/disputes/${id}/draft`, {
      method: 'POST',
    });
  },

  gateDispute: async (id: string, threshold: number = 0.75) => {
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
      body: JSON.stringify({ threshold }),
    });
  },

  batchGateDisputes: async (threshold: number = 0.75) => {
    return fetchJson<{
      message: string;
      totalProcessed: number;
      autoApprovedCount: number;
      reviewCount: number;
      thresholdUsed: number;
      disputes: Array<{ id: string; status: string; score: number; isAutoSubmitted: boolean }>;
    }>('/disputes/batch-gate', {
      method: 'POST',
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

  // Audit
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

  recalculateMetrics: async () => {
    return fetchJson<{
      message: string;
      results: MetricEvaluationReport;
    }>('/metrics/evaluate', {
      method: 'POST',
    });
  },

  // Simulation
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
};
