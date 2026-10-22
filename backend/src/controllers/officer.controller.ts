// @ts-nocheck
import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { ApplicationStatus } from '@prisma/client';
import { generateValidationReport, getChecklistForType } from '../services/complianceChecklist.service';

// GET /api/officer/dashboard
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const officerId = (await prisma.officer.findUnique({ where: { userId: req.user!.id } }))?.id;

    const [
      totalApplications,
      pendingReview,
      underReview,
      resolved,
      myAssigned,
      recentFindings,
    ] = await Promise.all([
      prisma.application.count({ where: { status: { not: 'DRAFT' } } }),
      prisma.application.count({ where: { status: 'SUBMITTED' } }),
      prisma.application.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.application.count({ where: { status: { in: ['APPROVED', 'REJECTED'] } } }),
      officerId ? prisma.application.count({
        where: { assignedOfficerId: officerId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }
      }) : 0,
      prisma.finding.findMany({
        where: { isDismissed: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          application: { include: { institute: true } },
          document: { select: { originalName: true, documentType: true } },
        },
      }),
    ]);

    res.json({
      stats: {
        totalApplications,
        pendingReview,
        underReview,
        resolved,
        myAssigned,
      },
      recentFindings,
    });
  } catch (error) {
    logger.error('Officer dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// GET /api/officer/applications
export const getApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = '1', limit = '20', search } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      status: { not: 'DRAFT' as ApplicationStatus },
    };

    if (status) where.status = status as ApplicationStatus;
    if (search) {
      where.OR = [
        { applicationNumber: { contains: search as string, mode: 'insensitive' } },
        { title: { contains: search as string, mode: 'insensitive' } },
        { institute: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          institute: { select: { name: true, code: true, city: true, state: true } },
          assignedOfficer: { select: { name: true } },
          _count: { select: { documents: true, findings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      applications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// GET /api/officer/applications/:id
export const getApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        institute: true,
        assignedOfficer: { include: { user: { select: { email: true } } } },
        documents: {
          where: { isActive: true },
          include: {
            claims: true,
            forensicReports: true,
          },
        },
        findings: {
          include: {
            document: { select: { originalName: true, documentType: true } },
            claim: true,
          },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        },
        verifications: { orderBy: { requestedAt: 'desc' } },
        reviewActions: {
          include: { user: { select: { email: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    res.json(application);
  } catch (error) {
    logger.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

// PATCH /api/officer/applications/:id/assign
export const assignApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const officer = await prisma.officer.findUnique({ where: { userId: req.user!.id } });
    if (!officer) {
      res.status(404).json({ error: 'Officer profile not found' });
      return;
    }

    const application = await prisma.application.update({
      where: { id },
      data: {
        assignedOfficerId: officer.id,
        status: 'UNDER_REVIEW',
        reviewStartedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId: id,
        action: 'REVIEW_STARTED',
        ipAddress: req.ip,
      },
    });

    res.json(application);
  } catch (error) {
    logger.error('Assign application error:', error);
    res.status(500).json({ error: 'Failed to assign application' });
  }
};

// PATCH /api/officer/applications/:id/decision
export const makeDecision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { decision, reason, notes } = req.body;

    if (!['APPROVED', 'REJECTED', 'REQUIRES_CLARIFICATION'].includes(decision)) {
      res.status(400).json({ error: 'Invalid decision' });
      return;
    }

    const updateData: any = {
      status: decision as ApplicationStatus,
      resolvedAt: decision !== 'REQUIRES_CLARIFICATION' ? new Date() : undefined,
      officerNotes: notes,
    };
    if (decision === 'REJECTED') updateData.rejectionReason = reason;

    const application = await prisma.application.update({
      where: { id },
      data: updateData,
    });

    await prisma.reviewAction.create({
      data: {
        applicationId: id,
        userId: req.user!.id,
        action: decision,
        rationale: reason || notes,
      },
    });

    const actionMap: any = {
      APPROVED: 'APPLICATION_APPROVED',
      REJECTED: 'APPLICATION_REJECTED',
      REQUIRES_CLARIFICATION: 'APPLICATION_CLARIFICATION_REQUESTED',
    };

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId: id,
        action: actionMap[decision],
        metadata: { reason, notes },
        ipAddress: req.ip,
      },
    });

    res.json(application);
  } catch (error) {
    logger.error('Decision error:', error);
    res.status(500).json({ error: 'Failed to record decision' });
  }
};

// GET /api/officer/applications/:id/validation-report
export const getValidationReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await generateValidationReport(req.params.id);
    res.json(report);
  } catch (error) {
    logger.error('Validation report error:', error);
    res.status(500).json({ error: 'Failed to generate validation report' });
  }
};

// GET /api/officer/checklists/:type
export const getChecklist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const checklist = getChecklistForType(req.params.type);
    res.json({ applicationType: req.params.type, checklist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
};

// GET /api/officer/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const officer = await prisma.officer.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: { select: { email: true, createdAt: true } },
        _count: { select: { assignedApplications: true } },
      },
    });

    if (!officer) {
      res.status(404).json({ error: 'Officer profile not found' });
      return;
    }

    res.json(officer);
  } catch (error) {
    logger.error('Get officer profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};
