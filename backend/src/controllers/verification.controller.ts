import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const MOCK_DELAY_MS = parseInt(process.env.MOCK_GOV_API_DELAY_MS || '800', 10);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock government API registry
const GOV_API_REGISTRY: Record<string, { name: string; description: string; requiredFields: string[] }> = {
  AICTE_APPROVAL_API: {
    name: 'AICTE Approval Verification',
    description: 'Verify AICTE approval letter details for technical institutions',
    requiredFields: ['institutionCode', 'approvalYear'],
  },
  UGC_AFFILIATION_API: {
    name: 'UGC Affiliation Verification',
    description: 'Verify UGC affiliation and recognition status',
    requiredFields: ['institutionCode', 'affiliatingUniversity'],
  },
  DTE_INTAKE_API: {
    name: 'DTE Intake Verification',
    description: 'Verify sanctioned intake capacity per programme',
    requiredFields: ['institutionCode', 'programmeCode', 'academicYear'],
  },
};

// Generate mock response based on API type
function generateMockResponse(apiName: string, payload: any, institutionCode: string) {
  const isVerified = Math.random() > 0.25; // 75% verified for demo

  if (apiName === 'AICTE_APPROVAL_API') {
    return {
      status: isVerified ? 'VERIFIED' : 'MISMATCH',
      referenceId: `AICTE-REF-${Date.now()}`,
      institutionCode,
      approvalStatus: isVerified ? 'ACTIVE' : 'DISCREPANCY_FOUND',
      approvedIntake: isVerified ? payload.claimedIntake : Math.floor(Math.random() * 60) + 60,
      approvalYear: payload.approvalYear || '2024-25',
      validUntil: '2026-12-31',
      isMocked: true,
      disclaimer: '[MOCK] This is a simulated API response for demonstration purposes only. Not an official government verification.',
    };
  }

  if (apiName === 'UGC_AFFILIATION_API') {
    return {
      status: isVerified ? 'VERIFIED' : 'UNAVAILABLE',
      referenceId: `UGC-REF-${Date.now()}`,
      institutionCode,
      affiliationStatus: isVerified ? 'AFFILIATED' : 'NO_RECORD_FOUND',
      recognizedProgrammes: isVerified ? ['B.Tech', 'M.Tech', 'MBA'] : [],
      isMocked: true,
      disclaimer: '[MOCK] This is a simulated API response for demonstration purposes only.',
    };
  }

  if (apiName === 'DTE_INTAKE_API') {
    const sanctionedIntake = isVerified ? payload.claimedIntake : payload.claimedIntake - 30;
    return {
      status: isVerified ? 'VERIFIED' : 'MISMATCH',
      referenceId: `DTE-REF-${Date.now()}`,
      institutionCode,
      programmeCode: payload.programmeCode,
      academicYear: payload.academicYear || '2026-27',
      sanctionedIntake,
      claimedIntake: payload.claimedIntake,
      discrepancy: !isVerified ? `Claimed: ${payload.claimedIntake}, Sanctioned: ${sanctionedIntake}` : null,
      isMocked: true,
      disclaimer: '[MOCK] This is a simulated API response for demonstration purposes only.',
    };
  }

  return {
    status: 'UNAVAILABLE',
    message: 'API not configured',
    isMocked: true,
  };
}

// POST /api/verifications/run
export const runVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicationId, documentId, apiName, payload } = req.body;

    if (!applicationId || !apiName) {
      res.status(400).json({ error: 'applicationId and apiName are required' });
      return;
    }

    if (!GOV_API_REGISTRY[apiName]) {
      res.status(400).json({
        error: `Unknown API: ${apiName}`,
        availableApis: Object.keys(GOV_API_REGISTRY),
      });
      return;
    }

    // Get institution code
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { institute: true },
    });

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    // Simulate API delay
    await sleep(MOCK_DELAY_MS);

    const mockResponse = generateMockResponse(apiName, payload || {}, application.institute.code);
    const status = mockResponse.status as any;

    const verification = await prisma.issuerVerification.create({
      data: {
        applicationId,
        documentId: documentId || null,
        apiName,
        requestPayload: { ...payload, institutionCode: application.institute.code },
        responsePayload: mockResponse,
        status,
        isMocked: true,
        respondedAt: new Date(),
        referenceId: (mockResponse as any).referenceId,
        notes: '[MOCK] All verification responses are simulated for demonstration. Real government API integration requires authorized access.',
      },
    });

    // Auto-create finding if mismatch
    if (status === 'MISMATCH') {
      await prisma.finding.create({
        data: {
          applicationId,
          documentId: documentId || null,
          type: 'ISSUER_MISMATCH',
          severity: 'HIGH',
          title: `Issuer Mismatch: ${GOV_API_REGISTRY[apiName].name}`,
          description: `The mock ${GOV_API_REGISTRY[apiName].name} returned a mismatch for the submitted details. ${(mockResponse as any).discrepancy || 'See verification details.'}`,
          evidence: {
            apiName,
            verificationId: verification.id,
            response: mockResponse,
            isMocked: true,
          },
        },
      });
    }

    res.json(verification);
  } catch (error) {
    logger.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// GET /api/verifications?applicationId=...
export const getVerifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicationId } = req.query;
    const where: any = {};
    if (applicationId) where.applicationId = applicationId as string;

    const verifications = await prisma.issuerVerification.findMany({
      where,
      include: {
        document: { select: { originalName: true, documentType: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });

    res.json(verifications);
  } catch (error) {
    logger.error('Get verifications error:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
};

// GET /api/verifications/apis - List available APIs
export const listApis = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    apis: GOV_API_REGISTRY,
    disclaimer: 'All APIs are mocked for demonstration. Real integration requires government authorization.',
  });
};
