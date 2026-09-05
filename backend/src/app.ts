import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authRouter } from './routes/authRoutes';
import { disputeRouter } from './routes/disputeRoutes';
import { auditRouter } from './routes/auditRoutes';
import { metricsRouter } from './routes/metricsRoutes';
import { simulateRouter } from './routes/simulateRoutes';
import { webhookRouter } from './routes/webhookRoutes';
import { razorpayRouter } from './routes/razorpayRoutes';
import { getDb } from './db';
import { getDecisionGateThreshold } from './config/settings';

dotenv.config();

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature'],
  })
);

// Razorpay webhooks need raw body for signature verification
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please retry after 15 minutes.',
  },
});

app.use('/api', globalLimiter);

app.get('/health', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query('SELECT COUNT(*) as count FROM disputes');
    const payments = await db.query(`SELECT COUNT(*) as count FROM payments`);
    res.json({
      status: 'healthy',
      service: 'ChargebackGuard Backend',
      environment: process.env.NODE_ENV || 'development',
      database: db.isPGlite ? 'Embedded PGlite (PostgreSQL WASM)' : 'External PostgreSQL',
      totalDisputesInDb: Number(result.rows[0]?.count || 0),
      totalPaymentsInDb: Number(payments.rows[0]?.count || 0),
      decisionGateThreshold: getDecisionGateThreshold(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(503).json({
      status: 'unhealthy',
      error: message,
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/disputes', disputeRouter);
app.use('/api/audit', auditRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/razorpay', razorpayRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.url} does not exist.`,
  });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const e = err as { status?: number; name?: string; message?: string };
  res.status(e.status || 500).json({
    error: e.name || 'Internal Server Error',
    message: e.message || 'An unexpected error occurred.',
  });
});
