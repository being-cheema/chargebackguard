export interface RazorpayDisputeEntity {
  id: string;
  entity: 'dispute';
  payment_id: string;
  amount: number;
  currency: string;
  reason_code?: string | null;
  respond_by?: number | null;
  status: string;
  phase?: string | null;
  created_at: number;
  evidence?: Record<string, unknown>;
}

export interface RazorpayDisputeListResponse {
  entity: string;
  count: number;
  items: RazorpayDisputeEntity[];
}

export interface RazorpayDocumentResponse {
  id: string;
  entity: string;
  purpose: string;
  created_at: number;
}

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: { entity: Record<string, unknown> };
    dispute?: { entity: RazorpayDisputeEntity };
  };
  created_at: number;
}
