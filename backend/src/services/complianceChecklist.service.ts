// @ts-nocheck
/**
 * IEI AICTE Compliance Checklist Service
 *
 * Implements configurable document checklists derived from the
 * AICTE Approval Process Handbook for each application category.
 *
 * Generates a structured Validation Report including:
 *  - Required vs uploaded documents
 *  - Missing / expired document flags
 *  - Cross-document inconsistency summary
 *  - AI findings summary
 *  - Overall compliance score
 *
 * All findings are advisory — final decisions remain with AICTE officers.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// ─── Checklist Definitions ────────────────────────────────────────────────────

export interface ChecklistItem {
  documentType: string;
  label: string;
  required: boolean;
  maxAgeMonths?: number;    // expiry window in months (undefined = never expires)
  notes?: string;
}

type ApplicationType =
  | 'EXTENSION_OF_APPROVAL'
  | 'NEW_INSTITUTION'
  | 'PROGRAMME_ADDITION'
  | 'INTAKE_INCREASE'
  | 'INTAKE_DECREASE'
  | 'CHANGE_OF_SITE'
  | 'CLOSURE_OF_PROGRAMME'
  | 'CONVERSION_OF_PROGRAMME'
  | 'OTHER';

const CHECKLISTS: Record<ApplicationType, ChecklistItem[]> = {
  EXTENSION_OF_APPROVAL: [
    { documentType: 'APPROVAL_LETTER',          label: 'Previous AICTE Approval Letter',           required: true,  maxAgeMonths: 18,  notes: 'Must be from the immediately preceding academic year' },
    { documentType: 'AFFILIATION_CERTIFICATE',  label: 'University Affiliation Certificate',        required: true,  maxAgeMonths: 12,  notes: 'Must be valid for the current academic year' },
    { documentType: 'LAND_DOCUMENT',            label: 'Land / Building Ownership Document',        required: true,               notes: 'Sale deed or long-term lease (min. 30 years)' },
    { documentType: 'BUILDING_PLAN',            label: 'Approved Building Plan',                    required: true,               notes: 'Approved by competent local authority' },
    { documentType: 'FACULTY_LIST',             label: 'Faculty & Staff List',                      required: true,  maxAgeMonths: 6,   notes: 'With qualifications, designation and Aadhaar numbers' },
    { documentType: 'PROGRAMME_DETAILS',        label: 'Programme and Course Details',              required: true,               notes: 'Programme-wise intake, duration, fees' },
    { documentType: 'FINANCIAL_STATEMENT',      label: 'Audited Financial Statements',              required: true,  maxAgeMonths: 18,  notes: 'Last two years, CA-certified' },
    { documentType: 'INTAKE_LETTER',            label: 'Intake Approval Letter',                    required: true,  maxAgeMonths: 24,  notes: 'For all approved programmes' },
    { documentType: 'INFRASTRUCTURE_IMAGE',     label: 'Infrastructure Photographs / Videos',       required: false,              notes: 'Lab, classrooms, library — recommended for review' },
    { documentType: 'AMENDMENT',               label: 'Any Amendment / Corrigendum Letters',       required: false,              notes: 'If any changes were approved mid-year' },
  ],
  NEW_INSTITUTION: [
    { documentType: 'LAND_DOCUMENT',            label: 'Land / Building Ownership Document',        required: true,               notes: 'Minimum area as per AICTE norms' },
    { documentType: 'BUILDING_PLAN',            label: 'Approved Building Plan',                    required: true,               notes: 'From competent local authority' },
    { documentType: 'AFFILIATION_CERTIFICATE',  label: 'Affiliation Approval / NOC from University',required: true,  maxAgeMonths: 6 },
    { documentType: 'FACULTY_LIST',             label: 'Proposed Faculty List',                     required: true },
    { documentType: 'PROGRAMME_DETAILS',        label: 'Proposed Programme Details',                required: true },
    { documentType: 'FINANCIAL_STATEMENT',      label: 'Financial Viability / Bank Statement',      required: true,  maxAgeMonths: 6 },
    { documentType: 'INFRASTRUCTURE_IMAGE',     label: 'Infrastructure Photographs',                required: true,               notes: 'Site readiness evidence' },
  ],
  PROGRAMME_ADDITION: [
    { documentType: 'APPROVAL_LETTER',          label: 'Existing AICTE Approval Letter',            required: true,  maxAgeMonths: 18 },
    { documentType: 'AFFILIATION_CERTIFICATE',  label: 'University Affiliation for New Programme',  required: true,  maxAgeMonths: 12 },
    { documentType: 'FACULTY_LIST',             label: 'Faculty for Proposed Programme',            required: true,  maxAgeMonths: 6 },
    { documentType: 'PROGRAMME_DETAILS',        label: 'New Programme Details',                     required: true },
    { documentType: 'FINANCIAL_STATEMENT',      label: 'Financial Statements',                      required: true,  maxAgeMonths: 18 },
    { documentType: 'INFRASTRUCTURE_IMAGE',     label: 'Dedicated Infrastructure for New Programme', required: false },
  ],
  INTAKE_INCREASE: [
    { documentType: 'APPROVAL_LETTER',          label: 'Current AICTE Approval Letter',             required: true,  maxAgeMonths: 18 },
    { documentType: 'FACULTY_LIST',             label: 'Additional Faculty for Increased Intake',   required: true,  maxAgeMonths: 6 },
    { documentType: 'INFRASTRUCTURE_IMAGE',     label: 'Additional Infrastructure Evidence',        required: true },
    { documentType: 'FINANCIAL_STATEMENT',      label: 'Financial Statements',                      required: true,  maxAgeMonths: 18 },
  ],
  INTAKE_DECREASE: [
    { documentType: 'APPROVAL_LETTER',          label: 'Current AICTE Approval Letter',             required: true,  maxAgeMonths: 18 },
    { documentType: 'PROGRAMME_DETAILS',        label: 'Revised Programme Details',                 required: true },
  ],
  CHANGE_OF_SITE: [
    { documentType: 'APPROVAL_LETTER',          label: 'Current AICTE Approval Letter',             required: true,  maxAgeMonths: 18 },
    { documentType: 'LAND_DOCUMENT',            label: 'New Site Land / Building Document',         required: true },
    { documentType: 'BUILDING_PLAN',            label: 'New Site Building Plan',                    required: true },
    { documentType: 'AFFILIATION_CERTIFICATE',  label: 'Affiliation for New Location',              required: true,  maxAgeMonths: 12 },
    { documentType: 'INFRASTRUCTURE_IMAGE',     label: 'New Site Infrastructure Photos',            required: true },
  ],
  CLOSURE_OF_PROGRAMME: [
    { documentType: 'APPROVAL_LETTER',          label: 'Approval Letter for Programme being closed', required: true },
    { documentType: 'PROGRAMME_DETAILS',        label: 'Programme Closure Details and Reason',      required: true },
    { documentType: 'AFFILIATION_CERTIFICATE',  label: 'University Approval for Closure',           required: false },
  ],
  CONVERSION_OF_PROGRAMME: [
    { documentType: 'APPROVAL_LETTER',          label: 'Current Programme Approval Letter',         required: true,  maxAgeMonths: 18 },
    { documentType: 'PROGRAMME_DETAILS',        label: 'Converted Programme Details',               required: true },
    { documentType: 'AFFILIATION_CERTIFICATE',  label: 'University Affiliation for Converted Programme', required: true, maxAgeMonths: 12 },
    { documentType: 'FACULTY_LIST',             label: 'Faculty for Converted Programme',           required: false },
  ],
  OTHER: [
    { documentType: 'APPROVAL_LETTER',          label: 'Any Relevant Approval Letter',              required: false },
    { documentType: 'OTHER',                    label: 'Supporting Documents',                      required: true,               notes: 'As applicable to the application type' },
  ],
};

// ─── Validation Report ────────────────────────────────────────────────────────

export interface ChecklistStatus {
  documentType: string;
  label: string;
  required: boolean;
  status: 'PRESENT' | 'MISSING' | 'EXPIRED' | 'PRESENT_EXPIRY_UNKNOWN';
  uploadedDocuments: Array<{ id: string; originalName: string; uploadedAt: string }>;
  notes?: string;
  maxAgeMonths?: number;
  expiryNote?: string;
}

export interface ValidationReport {
  applicationId: string;
  applicationType: string;
  generatedAt: string;
  overallStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
  complianceScore: number;          // 0–100
  checklist: ChecklistStatus[];
  summary: {
    required: number;
    present: number;
    missing: number;
    expired: number;
    optional_present: number;
  };
  findings: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    isDismissed: boolean;
  }>;
  verificationSummary: Array<{
    apiName: string;
    status: string;
    isMocked: boolean;
    requestedAt: string;
  }>;
  missingRequiredDocs: string[];
  expiredDocs: string[];
  aiFlags: number;
  disclaimer: string;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function generateValidationReport(applicationId: string): Promise<ValidationReport> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      documents: { where: { isActive: true } },
      findings: { orderBy: [{ severity: 'desc' }] },
      verifications: { orderBy: { requestedAt: 'desc' } },
    },
  });

  if (!application) throw new Error(`Application ${applicationId} not found`);

  const appType = (application.applicationType || 'EXTENSION_OF_APPROVAL') as ApplicationType;
  const checklist = CHECKLISTS[appType] || CHECKLISTS['OTHER'];

  const now = new Date();

  // Map uploaded documents by type
  const uploadedByType: Record<string, Array<{ id: string; originalName: string; uploadedAt: string }>> = {};
  for (const doc of application.documents) {
    const key = doc.documentType;
    if (!uploadedByType[key]) uploadedByType[key] = [];
    uploadedByType[key].push({
      id: doc.id,
      originalName: doc.originalName,
      uploadedAt: doc.uploadedAt.toISOString(),
    });
  }

  // Evaluate each checklist item
  const checklistStatuses: ChecklistStatus[] = [];
  let requiredCount = 0;
  let presentCount = 0;
  let missingCount = 0;
  let expiredCount = 0;
  let optionalPresent = 0;

  for (const item of checklist) {
    const uploaded = uploadedByType[item.documentType] || [];

    if (item.required) requiredCount++;

    if (uploaded.length === 0) {
      if (item.required) {
        missingCount++;
        checklistStatuses.push({
          ...item,
          status: 'MISSING',
          uploadedDocuments: [],
        });
      } else {
        checklistStatuses.push({
          ...item,
          status: 'MISSING',
          uploadedDocuments: [],
        });
      }
      continue;
    }

    // Check expiry
    if (item.maxAgeMonths) {
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - item.maxAgeMonths);

      const latestDoc = uploaded.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      const docAge = new Date(latestDoc.uploadedAt);

      if (docAge < cutoff) {
        if (item.required) expiredCount++;
        checklistStatuses.push({
          ...item,
          status: 'EXPIRED',
          uploadedDocuments: uploaded,
          expiryNote: `Document was uploaded more than ${item.maxAgeMonths} months ago — may be outdated`,
        });
        continue;
      }
    }

    if (item.required) {
      presentCount++;
    } else {
      optionalPresent++;
    }

    checklistStatuses.push({
      ...item,
      status: item.maxAgeMonths ? 'PRESENT' : 'PRESENT_EXPIRY_UNKNOWN',
      uploadedDocuments: uploaded,
    });
  }

  // Compliance score (based on required items only)
  const score = requiredCount === 0
    ? 100
    : Math.round((presentCount / requiredCount) * 100);

  const overallStatus: ValidationReport['overallStatus'] =
    missingCount === 0 && expiredCount === 0 ? 'COMPLIANT'
    : score >= 60 ? 'PARTIAL'
    : 'NON_COMPLIANT';

  const missingRequiredDocs = checklistStatuses
    .filter(c => c.status === 'MISSING' && c.required)
    .map(c => c.label);

  const expiredDocs = checklistStatuses
    .filter(c => c.status === 'EXPIRED')
    .map(c => c.label);

  const aiFlags = application.findings.filter(f => !f.isDismissed).length;

  return {
    applicationId,
    applicationType: appType,
    generatedAt: now.toISOString(),
    overallStatus,
    complianceScore: score,
    checklist: checklistStatuses,
    summary: {
      required: requiredCount,
      present: presentCount,
      missing: missingCount,
      expired: expiredCount,
      optional_present: optionalPresent,
    },
    findings: application.findings.map(f => ({
      id: f.id,
      type: f.type,
      severity: f.severity,
      title: f.title,
      description: f.description,
      isDismissed: f.isDismissed,
    })),
    verificationSummary: application.verifications.map(v => ({
      apiName: v.apiName,
      status: v.status,
      isMocked: v.isMocked,
      requestedAt: v.requestedAt.toISOString(),
    })),
    missingRequiredDocs,
    expiredDocs,
    aiFlags,
    disclaimer:
      'This validation report is auto-generated as a decision-support tool only. ' +
      'All findings are preliminary indicators requiring human verification. ' +
      'Regulatory scrutiny, physical inspections where required, and final decisions ' +
      'remain with the competent AICTE authority.',
  };
}

export function getChecklistForType(applicationType: string): ChecklistItem[] {
  return CHECKLISTS[(applicationType as ApplicationType)] || CHECKLISTS['OTHER'];
}
