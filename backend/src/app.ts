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
import { getDb } from './db';

dotenv.config();

export const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible API usage
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS configuration
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Body parsers with bounded payload limit (prevents memory exhaustion)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Rate Limiter (Defense-in-depth against DoS and brute force)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please retry after 15 minutes.',
  },
});

app.use('/api', globalLimiter);

// 5. Health Check Endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query('SELECT COUNT(*) as count FROM disputes');
    res.json({
      status: 'healthy',
      service: 'ChargebackGuard Backend',
      environment: process.env.NODE_ENV || 'development',
      database: db.isPGlite ? 'Embedded PGlite (PostgreSQL WASM)' : 'External PostgreSQL',
      totalDisputesInDb: Number(result.rows[0]?.count || 0),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
});

// 6. API Route mounting
app.use('/api/auth', authRouter);
app.use('/api/disputes', disputeRouter);
app.use('/api/audit', auditRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/simulate', simulateRouter);

// 7. 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.url} does not exist.`,
  });
});

// 8. Centralized Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});
