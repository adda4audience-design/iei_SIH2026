// @ts-nocheck
// Admin routes - manage officers, institutes, system
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

// GET /api/admin/stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalInstitutes,
      verifiedInstitutes,
      totalOfficers,
      totalApplications,
      totalDocuments,
      totalFindings,
      pendingReview,
    ] = await Promise.all([
      prisma.institute.count(),
      prisma.institute.count({ where: { isVerified: true } }),
      prisma.officer.count(),
      prisma.application.count({ where: { status: { not: 'DRAFT' } } }),
      prisma.document.count({ where: { isActive: true } }),
      prisma.finding.count({ where: { isDismissed: false } }),
      prisma.application.count({ where: { status: 'SUBMITTED' } }),
    ]);

    res.json({
      totalInstitutes, verifiedInstitutes, totalOfficers,
      totalApplications, totalDocuments, totalFindings, pendingReview,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/admin/officers - Create officer account
router.post('/officers', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, designation, department, employeeId } = req.body;
    if (!email || !password || !name || !employeeId) {
      res.status(400).json({ error: 'email, password, name, employeeId required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'OFFICER',
        officer: {
          create: {
            name,
            designation: designation || 'Officer',
            department: department || 'Review Division',
            employeeId,
          },
        },
      },
      include: { officer: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'USER_CREATED',
        metadata: { createdUserId: user.id, role: 'OFFICER', employeeId },
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      officer: user.officer,
    });
  } catch (error) {
    logger.error('Create officer error:', error);
    res.status(500).json({ error: 'Failed to create officer' });
  }
});

// GET /api/admin/officers
router.get('/officers', async (_req: AuthRequest, res: Response) => {
  try {
    const officers = await prisma.officer.findMany({
      include: {
        user: { select: { email: true, isActive: true, createdAt: true } },
        _count: { select: { assignedApplications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(officers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
});

// GET /api/admin/institutes
router.get('/institutes', async (_req: AuthRequest, res: Response) => {
  try {
    const institutes = await prisma.institute.findMany({
      include: {
        user: { select: { email: true, isActive: true, createdAt: true } },
        _count: { select: { applications: true, documents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(institutes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch institutes' });
  }
});

// PATCH /api/admin/institutes/:id/verify
router.patch('/institutes/:id/verify', async (req: AuthRequest, res: Response) => {
  try {
    const institute = await prisma.institute.update({
      where: { id: req.params.id },
      data: { isVerified: true },
    });
    res.json(institute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify institute' });
  }
});

// PATCH /api/admin/users/:id/toggle-active
router.patch('/users/:id/toggle-active', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

export default router;
