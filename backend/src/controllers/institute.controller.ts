// @ts-nocheck
import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

// GET /api/institute/dashboard
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
    if (!institute) {
      res.status(404).json({ error: 'Institute not found' });
      return;
    }

    const [
      totalApplications,
      drafts,
      submitted,
      underReview,
      approved,
      rejected,
      totalDocuments,
      recentApplications,
    ] = await Promise.all([
      prisma.application.count({ where: { instituteId: institute.id } }),
      prisma.application.count({ where: { instituteId: institute.id, status: 'DRAFT' } }),
      prisma.application.count({ where: { instituteId: institute.id, status: 'SUBMITTED' } }),
      prisma.application.count({ where: { instituteId: institute.id, status: 'UNDER_REVIEW' } }),
      prisma.application.count({ where: { instituteId: institute.id, status: 'APPROVED' } }),
      prisma.application.count({ where: { instituteId: institute.id, status: 'REJECTED' } }),
      prisma.document.count({ where: { instituteId: institute.id, isActive: true } }),
      prisma.application.findMany({
        where: { instituteId: institute.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          _count: { select: { documents: true, findings: true } },
        },
      }),
    ]);

    res.json({
      institute,
      stats: { totalApplications, drafts, submitted, underReview, approved, rejected, totalDocuments },
      recentApplications,
    });
  } catch (error) {
    logger.error('Institute dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// GET /api/institute/applications
export const getMyApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
    if (!institute) {
      res.status(404).json({ error: 'Institute not found' });
      return;
    }

    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { instituteId: institute.id };
    if (status) where.status = status;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          _count: { select: { documents: true, findings: true } },
          assignedOfficer: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      applications,
      pagination: {
        total, page: pageNum, limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get institute applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// GET /api/institute/applications/:id
export const getApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
    if (!institute) {
      res.status(404).json({ error: 'Institute not found' });
      return;
    }

    const application = await prisma.application.findFirst({
      where: { id: req.params.id, instituteId: institute.id },
      include: {
        documents: {
          where: { isActive: true },
          select: {
            id: true, originalName: true, documentType: true,
            fileSizeBytes: true, uploadedAt: true, description: true, mimeType: true,
          },
        },
        findings: {
          where: { isDismissed: false },
          select: {
            id: true, type: true, severity: true, title: true, description: true, createdAt: true,
          },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        },
        assignedOfficer: { select: { name: true, designation: true } },
        reviewActions: {
          select: { action: true, rationale: true, createdAt: true },
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

// POST /api/institute/applications
export const createApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
    if (!institute) {
      res.status(404).json({ error: 'Institute not found' });
      return;
    }

    const { title, description, applicationType } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ error: 'Application title is required' });
      return;
    }

    const application = await prisma.application.create({
      data: {
        instituteId: institute.id,
        title: title.trim(),
        description: description?.trim(),
        applicationType: applicationType || 'EXTENSION_OF_APPROVAL',
        status: 'DRAFT',
      },
    });

    res.status(201).json(application);
  } catch (error) {
    logger.error('Create application error:', error);
    res.status(500).json({ error: 'Failed to create application' });
  }
};

// PATCH /api/institute/applications/:id/submit
export const submitApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
    if (!institute) {
      res.status(404).json({ error: 'Institute not found' });
      return;
    }

    const application = await prisma.application.findFirst({
      where: { id: req.params.id, instituteId: institute.id },
      include: { _count: { select: { documents: true } } },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    if (application.status !== 'DRAFT' && application.status !== 'REQUIRES_CLARIFICATION') {
      res.status(400).json({ error: 'Application cannot be submitted in its current state' });
      return;
    }

    if (application._count.documents === 0) {
      res.status(400).json({ error: 'Please upload at least one document before submitting' });
      return;
    }

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId: application.id,
        action: 'SUBMIT_APPLICATION',
        ipAddress: req.ip,
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Submit application error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};

// GET /api/institute/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const institute = await prisma.institute.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { email: true, createdAt: true } } },
    });

    if (!institute) {
      res.status(404).json({ error: 'Institute not found' });
      return;
    }

    res.json(institute);
  } catch (error) {
    logger.error('Get institute profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};
