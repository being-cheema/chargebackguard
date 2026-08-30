import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { runEvaluation } from '../metrics/evaluate';
import { requireReviewerAuth } from '../middleware/auth';

export const metricsRouter = Router();

// GET /api/metrics - return latest held-out evaluation report and sensitivity curve (Public read-only)
metricsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const reportPath = path.resolve(__dirname, '../../../../data/metrics_report.json');
    if (fs.existsSync(reportPath)) {
      const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      res.json(data);
    } else {
      const results = runEvaluation();
      res.json(results);
    }
  } catch (err: any) {
    console.error('Fetch metrics error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/metrics/evaluate - re-run held-out evaluation and regenerate reports (Requires Reviewer Auth)
metricsRouter.post('/evaluate', requireReviewerAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const results = runEvaluation();
    res.json({
      message: 'Evaluation re-executed against held-out test split.',
      results,
    });
  } catch (err: any) {
    console.error('Run evaluation error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});
