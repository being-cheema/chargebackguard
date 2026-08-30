import { EvidenceKey, ReasonCodeConfig } from '../types';

export const REASON_CODE_REGISTRY: Record<string, ReasonCodeConfig> = {
  'RZP01': {
    code: 'RZP01',
    category: 'Product/Service Not Delivered',
    description: 'Goods or services were not provided to the customer.',
    primaryEvidence: ['proof_of_service', 'shipping_proof'],
    secondaryEvidence: ['customer_communication', 'term_and_conditions'],
    baseWinRate: 0.65,
  },
  'RZP04': {
    code: 'RZP04',
    category: 'Refund Not Processed',
    description: 'Customer claims refund was promised or due but not processed.',
    primaryEvidence: ['refund_confirmation', 'billing_proof'],
    secondaryEvidence: ['refund_cancellation_policy', 'customer_communication'],
    baseWinRate: 0.70,
  },
  'RZP05': {
    code: 'RZP05',
    category: 'Account Debited Without Confirmation',
    description: 'Amount debited from customer account without order confirmation.',
    primaryEvidence: ['access_activity_log'],
    secondaryEvidence: ['billing_proof', 'customer_communication'],
    baseWinRate: 0.60,
  },
  'RZP06': {
    code: 'RZP06',
    category: 'Business Unresponsive',
    description: 'Customer claims merchant failed to respond to support inquiries.',
    primaryEvidence: ['customer_communication', 'proof_of_service'],
    secondaryEvidence: ['term_and_conditions'],
    baseWinRate: 0.65,
  },
  'RZP00': {
    code: 'RZP00',
    category: 'General / Unspecified',
    description: 'Catch-all or unspecified dispute reason.',
    primaryEvidence: ['proof_of_service', 'billing_proof'],
    secondaryEvidence: ['refund_confirmation', 'term_and_conditions'],
    baseWinRate: 0.55,
  },
  '1061': {
    code: '1061',
    category: 'Credit Not Processed (Visa/MC)',
    description: 'Credit or refund not processed as agreed upon.',
    primaryEvidence: ['refund_confirmation', 'billing_proof'],
    secondaryEvidence: ['refund_cancellation_policy', 'customer_communication'],
    baseWinRate: 0.68,
  },
  'C02': {
    code: 'C02',
    category: 'Credit Not Processed (RuPay/Amex)',
    description: 'Credit adjustment or refund not received by cardholder.',
    primaryEvidence: ['refund_confirmation', 'billing_proof'],
    secondaryEvidence: ['refund_cancellation_policy', 'customer_communication'],
    baseWinRate: 0.68,
  },
  '1062': {
    code: '1062',
    category: 'Not as Described / Defective',
    description: 'Merchandise or services defective or materially different from description.',
    primaryEvidence: ['others', 'customer_communication'],
    secondaryEvidence: ['term_and_conditions', 'proof_of_service'],
    baseWinRate: 0.58,
  },
  '13.3': {
    code: '13.3',
    category: 'Not as Described / Quality Dispute (Visa)',
    description: 'Goods or services were counterfeit, damaged, or not as described.',
    primaryEvidence: ['others', 'customer_communication'],
    secondaryEvidence: ['term_and_conditions', 'proof_of_service'],
    baseWinRate: 0.58,
  },
  '1064': {
    code: '1064',
    category: 'Merchandise Not Received (Mastercard)',
    description: 'Cardholder claims purchased merchandise was never delivered.',
    primaryEvidence: ['shipping_proof', 'customer_communication'],
    secondaryEvidence: ['term_and_conditions', 'proof_of_service'],
    baseWinRate: 0.62,
  },
  '13.1': {
    code: '13.1',
    category: 'Merchandise Not Received (Visa)',
    description: 'Cardholder claims ordered merchandise/services were not received.',
    primaryEvidence: ['shipping_proof', 'customer_communication'],
    secondaryEvidence: ['term_and_conditions', 'proof_of_service'],
    baseWinRate: 0.62,
  },
  '13.2': {
    code: '13.2',
    category: 'Cancelled Recurring Transaction (Visa)',
    description: 'Cardholder cancelled subscription/recurring billing but was still charged.',
    primaryEvidence: ['cancellation_proof', 'refund_cancellation_policy'],
    secondaryEvidence: ['access_activity_log', 'term_and_conditions'],
    baseWinRate: 0.60,
  },
  '4841': {
    code: '4841',
    category: 'Cancelled Recurring Transaction (Mastercard)',
    description: 'Recurring transaction billed after cancellation request.',
    primaryEvidence: ['cancellation_proof', 'refund_cancellation_policy'],
    secondaryEvidence: ['access_activity_log', 'term_and_conditions'],
    baseWinRate: 0.60,
  },
  'C28': {
    code: 'C28',
    category: 'Recurring Transaction Cancelled (RuPay)',
    description: 'Account debited for recurring billing after cardholder cancelled.',
    primaryEvidence: ['cancellation_proof', 'refund_cancellation_policy'],
    secondaryEvidence: ['access_activity_log', 'term_and_conditions'],
    baseWinRate: 0.60,
  },
};

export function getReasonCodeConfig(reasonCode: string): ReasonCodeConfig {
  const config = REASON_CODE_REGISTRY[reasonCode.trim()];
  if (config) {
    return config;
  }
  // Fallback configuration if an unexpected code is encountered
  return {
    code: reasonCode,
    category: 'Unmapped Dispute Code',
    description: 'Dispute reason under review.',
    primaryEvidence: ['proof_of_service', 'billing_proof'],
    secondaryEvidence: ['customer_communication', 'term_and_conditions'],
    baseWinRate: 0.50,
  };
}
