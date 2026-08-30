import { Router, Request, Response } from 'express';
import { getAuditLogsForDispute, getRecentAuditLogs } from '../audit/auditService';

export const auditRouter = Router();

// GET /api/audit/:dispute_id - get audit logs for specific dispute
auditRouter.get('/:dispute_id', async (req: Request, res: Response): Promise<void> => {
  try {
    const disputeId = String(req.params.dispute_id);
    const logs = await getAuditLogsForDispute(disputeId);
    res.json({
      disputeId,
      totalEntries: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error('Fetch dispute audit log error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/audit - get recent audit logs across entire system
auditRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit || 50);
    const logs = await getRecentAuditLogs(limit);
    res.json({
      total: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error('Fetch system audit logs error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});
