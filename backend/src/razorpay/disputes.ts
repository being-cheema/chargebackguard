import { razorpayRequest } from './client';
import { RazorpayDisputeEntity, RazorpayDisputeListResponse } from './types';

export async function fetchAllDisputes(count = 100): Promise<RazorpayDisputeEntity[]> {
  const res = await razorpayRequest<RazorpayDisputeListResponse>(
    'GET',
    `/v1/disputes?count=${count}`
  );
  return res.items || [];
}

export async function fetchDisputeById(disputeId: string): Promise<RazorpayDisputeEntity> {
  return razorpayRequest<RazorpayDisputeEntity>(
    'GET',
    `/v1/disputes/${disputeId}?expand[]=payment`
  );
}

export interface ContestDisputePayload {
  action: 'draft' | 'submit';
  summary?: string;
  amount?: number;
  shipping_proof?: string[];
  billing_proof?: string[];
  cancellation_proof?: string[];
  customer_communication?: string[];
  proof_of_service?: string[];
  refund_confirmation?: string[];
  access_activity_log?: string[];
  refund_cancellation_policy?: string[];
  term_and_conditions?: string[];
  others?: Array<{ type: string; document_ids: string[] }>;
}

export async function contestDispute(
  disputeId: string,
  payload: ContestDisputePayload
): Promise<RazorpayDisputeEntity> {
  return razorpayRequest<RazorpayDisputeEntity>(
    'PATCH',
    `/v1/disputes/${disputeId}/contest`,
    payload
  );
}
