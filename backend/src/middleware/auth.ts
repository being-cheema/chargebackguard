import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chargebackguard_dev_secret_key_2026_razorpay';

export interface AuthenticatedRequest extends Request {
  reviewer?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function generateReviewerToken(payload: {
  id: string;
  email: string;
  name: string;
  role: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function requireReviewerAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Bearer authentication token.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    req.reviewer = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Expired or invalid authentication token.',
    });
  }
}
