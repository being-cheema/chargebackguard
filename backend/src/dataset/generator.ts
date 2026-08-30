import crypto from 'crypto';
import { DisputeRecord, EvidenceObject, EvidenceKey } from '../types';
import { REASON_CODE_REGISTRY, getReasonCodeConfig } from '../config/reasonCodes';

// Seeded pseudo-random number generator (Mulberry32) for reproducible synthetic dataset
class SeededRandom {
  private s: number;
  constructor(seed: number = 20260830) {
    this.s = Math.floor(seed);
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  boolean(prob: number = 0.5): boolean {
    return this.next() < prob;
  }
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

const RNG = new SeededRandom(42949);

const EVIDENCE_KEYS: EvidenceKey[] = [
  'shipping_proof',
  'billing_proof',
  'cancellation_proof',
  'customer_communication',
  'proof_of_service',
  'explanation_letter',
  'refund_confirmation',
  'access_activity_log',
  'refund_cancellation_policy',
  'term_and_conditions',
  'others',
];

function generateId(prefix: string, length: number = 14): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let res = prefix + '_';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(RNG.next() * chars.length));
  }
  return res;
}

const REASON_CODES = Object.keys(REASON_CODE_REGISTRY);

export function generateSyntheticDisputes(count: number = 450): DisputeRecord[] {
  const records: DisputeRecord[] = [];
  const now = Math.floor(Date.now() / 1000);

  // 70% train, 30% held-out
  const trainCount = Math.floor(count * 0.7);

  for (let i = 0; i < count; i++) {
    const reasonCode = RNG.choice(REASON_CODES);
    const config = getReasonCodeConfig(reasonCode);

    const disputeId = generateId('disp');
    const paymentId = generateId('pay');
    
    // Amount between ₹499 (49900 paise) and ₹1,20,000 (12000000 paise)
    const amountTiers = [
      RNG.rangeInt(49900, 250000),      // Low: ₹499 - ₹2,500
      RNG.rangeInt(250000, 1500000),    // Mid: ₹2,500 - ₹15,000
      RNG.rangeInt(1500000, 6000000),   // High: ₹15,000 - ₹60,000
      RNG.rangeInt(6000000, 12000000),  // Very High: ₹60,000 - ₹120,000
    ];
    const amount = RNG.choice(amountTiers);

    const daysSinceTx = RNG.rangeInt(2, 85);
    const createdAt = now - daysSinceTx * 86400 + RNG.rangeInt(0, 3600);
    // Respond by deadline is usually 7-14 days after dispute creation
    const respondBy = createdAt + RNG.rangeInt(7, 14) * 86400;

    const customerDisputeHistoryCount = RNG.choice([0, 0, 0, 1, 1, 2, 3, 5]);
    const ipMatchesBilling = RNG.boolean(0.85);
    const merchantResponseTimeHours = Math.round(RNG.range(2, 96) * 10) / 10;

    // Determine evidence presence based on merchant diligence profile
    const diligenceScore = RNG.next(); // 0 (careless) to 1 (meticulous)
    const evidence: EvidenceObject = {
      shipping_proof: null,
      billing_proof: null,
      cancellation_proof: null,
      customer_communication: null,
      proof_of_service: null,
      explanation_letter: null,
      refund_confirmation: null,
      access_activity_log: null,
      refund_cancellation_policy: null,
      term_and_conditions: null,
      others: null,
    };

    // Primary evidence presence depends heavily on diligence
    for (const key of config.primaryEvidence) {
      if (RNG.boolean(diligenceScore * 0.9 + 0.1)) {
        evidence[key] = `https://cdn.razorpay.com/evidence/${disputeId}/${key}.pdf`;
      }
    }

    // Secondary evidence presence
    for (const key of config.secondaryEvidence) {
      if (RNG.boolean(diligenceScore * 0.7 + 0.15)) {
        evidence[key] = `https://cdn.razorpay.com/evidence/${disputeId}/${key}.pdf`;
      }
    }

    // Other optional evidence randomly available
    for (const key of EVIDENCE_KEYS) {
      if (
        !config.primaryEvidence.includes(key) &&
        !config.secondaryEvidence.includes(key) &&
        key !== 'explanation_letter'
      ) {
        if (RNG.boolean(0.25)) {
          evidence[key] = `https://cdn.razorpay.com/evidence/${disputeId}/${key}.pdf`;
        }
      }
    }

    // Compute ground truth probability based on domain rules
    let winProb = config.baseWinRate;

    // Check primary evidence
    const primaryPresent = config.primaryEvidence.filter((k) => !!evidence[k]).length;
    const primaryRatio = primaryPresent / Math.max(1, config.primaryEvidence.length);
    if (primaryRatio >= 1.0) {
      winProb += 0.32;
    } else if (primaryRatio > 0) {
      winProb += 0.10;
    } else {
      winProb -= 0.45;
    }

    // Check secondary evidence
    const secondaryPresent = config.secondaryEvidence.filter((k) => !!evidence[k]).length;
    const secondaryRatio = secondaryPresent / Math.max(1, config.secondaryEvidence.length);
    winProb += secondaryRatio * 0.12;

    // Timing penalties
    if (daysSinceTx > 60) {
      winProb -= 0.18;
    }
    if (merchantResponseTimeHours > 48) {
      winProb -= 0.12;
    } else if (merchantResponseTimeHours <= 12) {
      winProb += 0.06;
    }

    // Fraud history / customer dispute pattern
    if (customerDisputeHistoryCount >= 3) {
      // Habitual disputer - banks often side with merchant if solid proof provided
      if (primaryRatio >= 1.0) {
        winProb += 0.10;
      } else {
        winProb -= 0.15;
      }
    }

    // IP billing match
    if (ipMatchesBilling) {
      winProb += 0.05;
    } else {
      winProb -= 0.10;
    }

    // Add 12% realistic random noise
    const noise = (RNG.next() - 0.5) * 0.24;
    const finalWinProb = Math.max(0.02, Math.min(0.98, winProb + noise));

    const groundTruthOutcome: 'won' | 'lost' = RNG.next() < finalWinProb ? 'won' : 'lost';

    // Split assignment (index based to ensure exact 70/30 distribution)
    const split: 'train' | 'held_out' = i < trainCount ? 'train' : 'held_out';

    const phases: ('chargeback' | 'pre_arbitration' | 'arbitration')[] = [
      'chargeback',
      'chargeback',
      'chargeback',
      'pre_arbitration',
      'arbitration',
    ];
    const phase = RNG.choice(phases);

    records.push({
      id: disputeId,
      payment_id: paymentId,
      amount,
      currency: 'INR',
      reason_code: reasonCode,
      respond_by: respondBy,
      status: 'open',
      phase,
      created_at: createdAt,
      evidence,
      split,
      days_since_transaction: daysSinceTx,
      customer_dispute_history_count: customerDisputeHistoryCount,
      ip_matches_billing_country: ipMatchesBilling,
      merchant_response_time_hours: merchantResponseTimeHours,
      ground_truth_outcome: groundTruthOutcome,
    });
  }

  return records;
}
