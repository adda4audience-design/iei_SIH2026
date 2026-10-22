// @ts-nocheck
import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

// GET /api/findings?applicationId=...
export const getFindings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicationId, type, severity, dismissed } = req.query;

    const where: any = {};
    if (applicationId) where.applicationId = applicationId as string;
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (dismissed !== undefined) where.isDismissed = dismissed === 'true';

    const findings = await prisma.finding.findMany({
      where,
      include: {
        document: { select: { originalName: true, documentType: true } },
        claim: { select: { fieldName: true, extractedValue: true, pageNumber: true } },
        application: { include: { institute: { select: { name: true, code: true } } } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(findings);
  } catch (error) {
    logger.error('Get findings error:', error);
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
};

// PATCH /api/findings/:id/dismiss
export const dismissFinding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      res.status(400).json({ error: 'Dismissal reason required' });
      return;
    }

    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: {
        isDismissed: true,
        dismissedReason: reason.trim(),
      },
    });

    await prisma.reviewAction.create({
      data: {
        applicationId: finding.applicationId,
        userId: req.user!.id,
        findingId: finding.id,
        action: 'FINDING_DISMISSED',
        rationale: reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId: finding.applicationId,
        action: 'FINDING_DISMISSED',
        metadata: { findingId: finding.id, reason },
        ipAddress: req.ip,
      },
    });

    res.json(finding);
  } catch (error) {
    logger.error('Dismiss finding error:', error);
    res.status(500).json({ error: 'Failed to dismiss finding' });
  }
};

// POST /api/findings (manually add a finding)
export const addFinding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicationId, documentId, claimId, type, severity, title, description, evidence } = req.body;

    if (!applicationId || !type || !severity || !title || !description) {
      res.status(400).json({ error: 'applicationId, type, severity, title, description are required' });
      return;
    }

    const finding = await prisma.finding.create({
      data: {
        applicationId,
        documentId: documentId || null,
        claimId: claimId || null,
        type,
        severity,
        title,
        description,
        evidence: evidence || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId,
        action: 'FINDING_ADDED',
        metadata: { findingId: finding.id, type, severity },
        ipAddress: req.ip,
      },
    });

    res.status(201).json(finding);
  } catch (error) {
    logger.error('Add finding error:', error);
    res.status(500).json({ error: 'Failed to add finding' });
  }
};

// PATCH /api/findings/:id/note
export const addNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { note } = req.body;
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: { reviewerNote: note },
    });
    res.json(finding);
  } catch (error) {
    logger.error('Add finding note error:', error);
    res.status(500).json({ error: 'Failed to update finding' });
  }
};
