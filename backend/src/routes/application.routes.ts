// @ts-nocheck
// Evidence graph + general application routes
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// GET /api/applications/:id/evidence-graph
router.get('/:id/evidence-graph', async (req: AuthRequest, res: Response) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        institute: { select: { id: true, name: true, code: true } },
        documents: {
          where: { isActive: true },
          include: {
            claims: true,
          },
        },
        findings: {
          include: {
            claim: true,
            document: { select: { id: true, originalName: true, documentType: true } },
          },
        },
        verifications: { select: { id: true, apiName: true, status: true, requestedAt: true } },
      },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    // Build graph structure
    const nodes: any[] = [];
    const edges: any[] = [];

    // Institute node
    nodes.push({
      id: `inst-${application.institute.id}`,
      type: 'institution',
      label: application.institute.name,
      data: application.institute,
    });

    // Application node
    nodes.push({
      id: `app-${application.id}`,
      type: 'application',
      label: application.title,
      data: { id: application.id, status: application.status, applicationNumber: application.applicationNumber },
    });

    edges.push({
      id: `e-inst-app`,
      source: `inst-${application.institute.id}`,
      target: `app-${application.id}`,
      label: 'SUBMITTED',
    });

    // Document nodes
    for (const doc of application.documents) {
      nodes.push({
        id: `doc-${doc.id}`,
        type: 'document',
        label: doc.originalName,
        data: { id: doc.id, type: doc.documentType, claimCount: doc.claims.length },
      });

      edges.push({
        id: `e-app-doc-${doc.id}`,
        source: `app-${application.id}`,
        target: `doc-${doc.id}`,
        label: 'CONTAINS',
      });

      // Claim nodes (limit to 5 per doc for readability)
      for (const claim of doc.claims.slice(0, 5)) {
        nodes.push({
          id: `claim-${claim.id}`,
          type: 'claim',
          label: `${claim.fieldName}: ${claim.extractedValue}`,
          data: claim,
        });

        edges.push({
          id: `e-doc-claim-${claim.id}`,
          source: `doc-${doc.id}`,
          target: `claim-${claim.id}`,
          label: 'CONTAINS_CLAIM',
        });
      }
    }

    // Finding nodes
    for (const finding of application.findings) {
      nodes.push({
        id: `finding-${finding.id}`,
        type: 'finding',
        label: finding.title,
        data: { id: finding.id, type: finding.type, severity: finding.severity, isDismissed: finding.isDismissed },
      });

      if (finding.document) {
        edges.push({
          id: `e-doc-finding-${finding.id}`,
          source: `doc-${finding.document.id}`,
          target: `finding-${finding.id}`,
          label: finding.type === 'CONTRADICTION' ? 'CONFLICTS_WITH' : 'FOUND_IN',
        });
      } else {
        edges.push({
          id: `e-app-finding-${finding.id}`,
          source: `app-${application.id}`,
          target: `finding-${finding.id}`,
          label: 'HAS_FINDING',
        });
      }
    }

    // Verification nodes
    for (const v of application.verifications) {
      nodes.push({
        id: `ver-${v.id}`,
        type: 'verification',
        label: `${v.apiName}: ${v.status}`,
        data: v,
      });

      edges.push({
        id: `e-app-ver-${v.id}`,
        source: `app-${application.id}`,
        target: `ver-${v.id}`,
        label: 'VERIFIED_BY',
      });
    }

    res.json({ nodes, edges, application: { id: application.id, title: application.title } });
  } catch (error) {
    logger.error('Evidence graph error:', error);
    res.status(500).json({ error: 'Failed to build evidence graph' });
  }
});

export default router;
