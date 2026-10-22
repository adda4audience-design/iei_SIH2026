import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  REQUIRES_CLARIFICATION: 'bg-orange-100 text-orange-700',
};

export const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'bg-gray-100 text-gray-700',
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export const FINDING_TYPE_LABELS: Record<string, string> = {
  CONTRADICTION: 'Contradiction',
  EXPIRED_DOCUMENT: 'Expired Document',
  MISSING_FIELD: 'Missing Field',
  FORENSIC_SIGNAL: 'Forensic Signal',
  ISSUER_MISMATCH: 'Issuer Mismatch',
  ISSUER_CONFIRMED: 'Issuer Confirmed',
  POLICY_VIOLATION: 'Policy Violation',
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  APPROVAL_LETTER: 'Approval Letter',
  AFFILIATION_CERTIFICATE: 'Affiliation Certificate',
  LAND_DOCUMENT: 'Land Document',
  BUILDING_PLAN: 'Building Plan',
  FACULTY_LIST: 'Faculty List',
  PROGRAMME_DETAILS: 'Programme Details',
  FINANCIAL_STATEMENT: 'Financial Statement',
  INTAKE_LETTER: 'Intake Letter',
  AMENDMENT: 'Amendment',
  INFRASTRUCTURE_IMAGE: 'Infrastructure Image',
  OTHER: 'Other',
};
