// @ts-nocheck
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate, authorize('OFFICER', 'ADMIN'));

// GET /api/audit?applicationId=... 
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId, userId, action, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where: any = {};
    if (applicationId) where.applicationId = applicationId as string;
    if (userId) where.userId = userId as string;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { email: true, role: true } },
          application: { select: { applicationNumber: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        total, page: pageNum, limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
