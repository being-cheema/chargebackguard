import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export const gateDisputeSchema = z.object({
  threshold: z.number().min(0.1).max(0.99).optional().default(0.75),
});

export const reviewDisputeSchema = z.object({
  action: z.enum(['APPROVE_SUBMISSION', 'OVERRIDE_STATUS', 'UPDATE_LETTER']),
  status: z.enum(['ready_to_submit', 'needs_human_review', 'under_review', 'won', 'lost']).optional(),
  reviewer_notes: z.string().min(3, 'Reviewer notes are required for audit logging.'),
  explanation_letter: z.string().max(1000, 'Explanation letter must not exceed 1000 characters.').optional(),
});

export const simulateDisputeSchema = z.object({
  reason_code: z.string().min(1, 'Reason code is required.'),
  amount: z.number().min(100, 'Amount must be at least 100 paise (INR 1.00).'),
  days_since_transaction: z.number().min(0).max(365),
  customer_dispute_history_count: z.number().min(0).max(20),
  ip_matches_billing_country: z.boolean(),
  merchant_response_time_hours: z.number().min(0).max(500),
  evidence: z.object({
    shipping_proof: z.string().nullable().optional(),
    billing_proof: z.string().nullable().optional(),
    cancellation_proof: z.string().nullable().optional(),
    customer_communication: z.string().nullable().optional(),
    proof_of_service: z.string().nullable().optional(),
    explanation_letter: z.string().nullable().optional(),
    refund_confirmation: z.string().nullable().optional(),
    access_activity_log: z.string().nullable().optional(),
    refund_cancellation_policy: z.string().nullable().optional(),
    term_and_conditions: z.string().nullable().optional(),
    others: z.string().nullable().optional(),
  }),
  threshold: z.number().min(0.1).max(0.99).optional().default(0.75),
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: err.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({ error: 'Invalid request body.' });
    }
  };
}
