// @ts-nocheck
import { Response } from 'express';
import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { DocumentType } from '@prisma/client';
import { runIntelligencePipeline } from '../services/documentIntelligence.service';

const computeFileHash = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
};

// POST /api/documents/upload
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { applicationId, documentType, description } = req.body;

    if (!documentType || !Object.values(DocumentType).includes(documentType as DocumentType)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Valid document type required', validTypes: Object.values(DocumentType) });
      return;
    }

    let instituteId: string | null = null;
    if (req.user!.role === 'INSTITUTE') {
      const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
      if (!institute) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ error: 'Institute not found' });
        return;
      }
      instituteId = institute.id;
    } else {
      if (!req.body.instituteId) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'instituteId required for officer uploads' });
        return;
      }
      instituteId = req.body.instituteId as string;
    }

    if (applicationId) {
      const app = await prisma.application.findFirst({
        where: { id: applicationId as string, instituteId: instituteId! },
      });
      if (!app) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ error: 'Application not found' });
        return;
      }
    }

    const fileHash = computeFileHash(req.file.path);

    const document = await prisma.document.create({
      data: {
        applicationId: (applicationId as string) || null,
        instituteId: instituteId!,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileHash,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
        documentType: documentType as DocumentType,
        description: description?.trim(),
      },
    });

    if (applicationId) {
      detectContradictions(applicationId as string).catch(err =>
        logger.error('Contradiction detection error:', err)
      );
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId: (applicationId as string) || null,
        action: 'UPLOAD_DOCUMENT',
        metadata: { documentId: document.id, fileName: req.file.originalname, documentType },
        ipAddress: req.ip ?? null,
      },
    });

    // Fire intelligence pipeline asynchronously — non-blocking
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      runIntelligencePipeline(document.id, req.file.path, document.mimeType, instituteId!)
        .catch(err => logger.error('Intelligence pipeline error:', err));
    }

    res.status(201).json(document);
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    logger.error('Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

// GET /api/documents/:id
export const getDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        claims: true,
        forensicReports: true,
        institute: { select: { name: true, code: true } },
      },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (req.user!.role === 'INSTITUTE') {
      const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
      if (!institute || document.instituteId !== institute.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    res.json(document);
  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

// DELETE /api/documents/:id
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (req.user!.role === 'INSTITUTE') {
      const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
      if (!institute || document.instituteId !== institute.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      if (document.applicationId) {
        const app = await prisma.application.findUnique({ where: { id: document.applicationId } });
        if (app?.status !== 'DRAFT' && app?.status !== 'REQUIRES_CLARIFICATION') {
          res.status(400).json({ error: 'Cannot delete document after application is submitted' });
          return;
        }
      }
    }

    await prisma.document.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        applicationId: document.applicationId ?? null,
        action: 'DOCUMENT_DELETED',
        metadata: { documentId: document.id, fileName: document.originalName },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// POST /api/documents/:id/forensics
export const runForensicAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const mockForensics = generateMockForensicReport(document.mimeType, document.originalName);

    // Delete existing report if any, then create new one
    await prisma.forensicReport.deleteMany({ where: { documentId: document.id } });
    const report = await prisma.forensicReport.create({
      data: {
        documentId: document.id,
        metadataAnalysis: mockForensics.metadataAnalysis as any,
        typographySignals: mockForensics.typographySignals as any,
        pixelAnalysis: mockForensics.pixelAnalysis as any,
        pdfStructure: mockForensics.pdfStructure as any,
        duplicateCheck: mockForensics.duplicateCheck as any,
        aiEditIndicator: mockForensics.aiEditIndicator as any,
        overallRiskLevel: mockForensics.overallRiskLevel as any,
        summary: mockForensics.summary,
        limitations: mockForensics.limitations,
      },
    });

    res.json(report);
  } catch (error) {
    logger.error('Forensic analysis error:', error);
    res.status(500).json({ error: 'Failed to run forensic analysis' });
  }
};

// ─── Helpers ──────────────────────────────────────────────────

// GET /api/documents/:id/intelligence
export const getDocumentIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      select: { id: true, intelligenceReport: true, instituteId: true },
    });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (req.user!.role === 'INSTITUTE') {
      const institute = await prisma.institute.findUnique({ where: { userId: req.user!.id } });
      if (!institute || document.instituteId !== institute.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }
    if (!document.intelligenceReport) {
      res.status(202).json({ message: 'Intelligence report not yet available. Pipeline may still be processing.' });
      return;
    }
    res.json(document.intelligenceReport);
  } catch (error) {
    logger.error('Get intelligence error:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence report' });
  }
};

function generateMockForensicReport(mimeType: string, fileName: string) {
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');
  const riskSignals = Math.random() > 0.6 ? 1 : 0;

  return {
    metadataAnalysis: {
      producer: isPdf ? 'Adobe Acrobat 2023' : null,
      creationDate: '2026-09-15T10:30:00Z',
      modificationDate: riskSignals ? '2026-10-18T22:47:00Z' : '2026-09-15T10:30:00Z',
      author: 'Institutional Records System',
      hasExifData: isImage,
      metadataConsistency: riskSignals ? 'ANOMALY_DETECTED' : 'CONSISTENT',
      notes: riskSignals
        ? 'Modification date is significantly later than creation date'
        : 'No anomalies detected',
    },
    typographySignals: isPdf ? {
      fontsFound: ['Arial', 'Times New Roman'],
      inconsistentFonts: riskSignals ? ['Courier (single field, unexpected)'] : [],
      baselineAlignment: riskSignals ? 'MINOR_DEVIATION_DETECTED' : 'CONSISTENT',
      flaggedRegions: riskSignals
        ? [{ page: 1, region: 'Date field', note: 'Character height deviation ~15%' }]
        : [],
      notes: riskSignals
        ? 'Minor typography inconsistency in date field (page 1). Could indicate amendment or edit.'
        : 'No typography inconsistencies found',
    } : null,
    pixelAnalysis: isImage ? {
      compressionConsistency: riskSignals ? 'JPEG_BLOCK_INCONSISTENCY' : 'CONSISTENT',
      noiseProfile: 'UNIFORM',
      edgeArtifacts: riskSignals ? 'DETECTED_AROUND_SEAL_REGION' : 'NONE',
      elaNote: 'ELA is a visualization aid only. Results depend on compression history.',
      flaggedRegions: riskSignals
        ? [{ region: 'Bottom-right seal area', note: 'Compression artifacts inconsistent with surrounding region' }]
        : [],
    } : null,
    pdfStructure: isPdf ? {
      hasIncrementalRevisions: riskSignals === 1,
      signatureValidated: false,
      overlaysDetected: riskSignals === 1,
      formFieldsPresent: false,
      notes: riskSignals
        ? 'Incremental revision detected. Original bytes preserved. Signature not validated.'
        : 'Standard PDF structure, no revisions.',
    } : null,
    duplicateCheck: {
      sha256: createHash('sha256').update(fileName).digest('hex'),
      perceptualHashMatches: [],
      exactDuplicateFound: false,
      nearDuplicateFound: false,
      notes: 'No duplicate documents found in the system for this institution.',
    },
    aiEditIndicator: {
      modelName: 'ForensicLite-v1 (mock)',
      score: riskSignals ? 0.42 : 0.08,
      threshold: 0.5,
      result: riskSignals ? 'INCONCLUSIVE' : 'LIKELY_AUTHENTIC',
      limitations: 'This is a mocked indicator. In production, use a locally hosted, calibrated model.',
      note: 'Do not use this score as proof of fraud. Manual review is required for any flagged signal.',
    },
    overallRiskLevel: riskSignals ? 'MEDIUM' : 'INFO',
    summary: riskSignals
      ? '1 forensic signal detected requiring reviewer attention. No automatic fraud determination — manual review recommended.'
      : 'No significant forensic signals detected. Document appears consistent.',
    limitations: 'All forensic results are mocked/simulated for demonstration purposes.',
  };
}

async function detectContradictions(applicationId: string): Promise<void> {
  const documents = await prisma.document.findMany({
    where: { applicationId, isActive: true },
    include: { claims: true },
  });

  if (documents.length < 2) return;

  const claimsByField: Record<string, Array<{ docId: string; docName: string; value: string; claimId: string }>> = {};

  for (const doc of documents) {
    for (const claim of doc.claims) {
      const key = claim.normalizedField;
      if (!claimsByField[key]) claimsByField[key] = [];
      claimsByField[key].push({
        docId: doc.id,
        docName: doc.originalName,
        value: claim.normalizedValue || claim.extractedValue,
        claimId: claim.id,
      });
    }
  }

  for (const [field, claims] of Object.entries(claimsByField)) {
    if (claims.length < 2) continue;
    const uniqueValues = new Set(claims.map(c => c.value.toLowerCase().trim()));
    if (uniqueValues.size === 1) continue;

    const existingFinding = await prisma.finding.findFirst({
      where: { applicationId, type: 'CONTRADICTION' },
    });

    if (!existingFinding) {
      await prisma.finding.create({
        data: {
          applicationId,
          type: 'CONTRADICTION',
          severity: 'HIGH',
          title: `Contradiction detected: ${field}`,
          description: `Different values found for "${field}" across submitted documents. This requires review.`,
          evidence: {
            field,
            values: claims.map(c => ({
              document: c.docName,
              documentId: c.docId,
              value: c.value,
            })),
            note: 'Values may reflect an amendment or legitimate update. Verify with authorized sources.',
          },
        },
      });
    }
  }
}
