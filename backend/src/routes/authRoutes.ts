import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { generateReviewerToken, requireReviewerAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, loginSchema } from '../middleware/validation';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const db = await getDb();

    const result = await db.query(
      `SELECT id, email, password_hash, name, role FROM reviewers WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'No reviewer account found matching this email address.',
      });
      return;
    }

    const reviewer = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, reviewer.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'The password provided is incorrect.',
      });
      return;
    }

    const token = generateReviewerToken({
      id: reviewer.id,
      email: reviewer.email,
      name: reviewer.name,
      role: reviewer.role,
    });

    res.json({
      message: 'Login successful',
      token,
      reviewer: {
        id: reviewer.id,
        email: reviewer.email,
        name: reviewer.name,
        role: reviewer.role,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to process login.' });
  }
});

authRouter.get('/me', requireReviewerAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ reviewer: req.reviewer });
});
