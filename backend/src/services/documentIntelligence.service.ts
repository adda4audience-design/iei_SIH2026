// @ts-nocheck
/**
 * IEI Document Intelligence Service
 * Privacy-preserving, fully local pipeline:
 * 1. Extract text (pdf-parse for PDFs, XML parse for DOCX, placeholder for images)
 * 2. Extract metadata (EXIF for images, PDF header for PDFs)
 * 3. Generate TF-IDF embedding (no external API)
 * 4. Store vector in DB
 * 5. Find similar historical documents (cosine similarity)
 * 6. Detect field-level discrepancies across application docs
 * 7. Suggest missing fields from institute's historical documents
 * 8. Auto-create Findings for discrepancies and metadata anomalies
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelligenceReport {
  documentId: string;
  processedAt: string;
  extraction: {
    textLength: number;
    textPreview: string;
    method: string;
    confidence: number;
  };
  metadata: {
    fileSize: number;
    mimeType: string;
    anomalies: string[];
    creationDate?: string;
    modificationDate?: string;
    author?: string;
    software?: string;
    hasExif: boolean;
    metadataConsistency: 'CONSISTENT' | 'ANOMALY_DETECTED' | 'UNKNOWN';
  };
  similarDocuments: Array<{
    documentId: string;
    originalName: string;
    documentType: string;
    similarity: number;
    uploadedAt: string;
  }>;
  discrepancies: Array<{
    field: string;
    thisValue: string;
    conflictingValue: string;
    conflictingDocumentId: string;
    conflictingDocumentName: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  suggestions: Array<{
    field: string;
    suggestedValue: string;
    sourceDocumentId: string;
    sourceDocumentName: string;
    confidence: number;
  }>;
  keyTerms: string[];
  processingTimeMs: number;
}

// ─── Stopwords ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'been', 'were', 'they',
  'their', 'which', 'into', 'more', 'also', 'shall', 'under', 'after',
  'before', 'above', 'below', 'between', 'through', 'during', 'about',
  'such', 'each', 'than', 'when', 'where', 'while', 'does', 'thereof',
  'herein', 'hereby', 'thereto', 'said', 'upon', 'further', 'shall',
  'would', 'could', 'should', 'these', 'those', 'then', 'them', 'there',
]);

// ─── Field Patterns ──────────────────────────────────────────────────────────

const FIELD_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
  { field: 'intake_capacity',   pattern: /intake[:\s]+(\d+)/i },
  { field: 'approved_intake',   pattern: /approved[:\s]+(\d+)/i },
  { field: 'programme_name',    pattern: /programme[:\s]+([A-Z][A-Za-z ]+)/i },
  { field: 'academic_year',     pattern: /(\d{4}[-–]\d{2,4})/i },
  { field: 'institution_name',  pattern: /(?:institute|college|university)[:\s]+([A-Z][A-Za-z ]+)/i },
  { field: 'approval_number',   pattern: /(?:approval|ref|reference)[:\s#]+([A-Z0-9\/\-]+)/i },
  { field: 'date',              pattern: /(?:dated?|date)[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i },
  { field: 'total_intake',      pattern: /total[:\s]+(\d+)/i },
  { field: 'course_duration',   pattern: /duration[:\s]+(\d+\s*(?:years?|months?))/i },
];

// ─── Text Extraction ──────────────────────────────────────────────────────────

async function extractText(
  filePath: string,
  mimeType: string
): Promise<{ text: string; method: string; confidence: number }> {
  try {
    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      const text = data.text || '';
      return { text, method: 'pdf-parse', confidence: text.length > 100 ? 0.92 : 0.5 };
    }

    if (mimeType.startsWith('text/')) {
      const text = fs.readFileSync(filePath, 'utf8');
      return { text, method: 'direct-read', confidence: 1.0 };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      // Basic DOCX: unzip and read word/document.xml
      try {
        // Use built-in zlib/buffer approach — no adm-zip dependency needed
        const { execSync } = require('child_process');
        const tmpDir = path.join(path.dirname(filePath), `_tmp_${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        try {
          execSync(`powershell -Command "Expand-Archive -Path '${filePath}' -DestinationPath '${tmpDir}' -Force"`, { timeout: 10000 });
          const xmlPath = path.join(tmpDir, 'word', 'document.xml');
          if (fs.existsSync(xmlPath)) {
            const xml = fs.readFileSync(xmlPath, 'utf8');
            const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return { text, method: 'docx-xml', confidence: 0.75 };
          }
        } finally {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
      } catch {}
      return { text: '', method: 'docx-failed', confidence: 0 };
    }

    if (mimeType.startsWith('image/')) {
      return {
        text: `[Image document: ${path.basename(filePath)}. Full OCR requires tesseract integration.]`,
        method: 'image-placeholder',
        confidence: 0.1,
      };
    }

    return { text: '', method: 'unsupported', confidence: 0 };
  } catch (err) {
    logger.warn('Text extraction failed:', err);
    return { text: '', method: 'error', confidence: 0 };
  }
}

// ─── Metadata Extraction ──────────────────────────────────────────────────────

function extractMetadata(
  filePath: string,
  mimeType: string,
  fileSizeBytes: number
): IntelligenceReport['metadata'] {
  const anomalies: string[] = [];
  let creationDate: string | undefined;
  let modificationDate: string | undefined;
  let author: string | undefined;
  let software: string | undefined;
  let hasExif = false;
  let metadataConsistency: 'CONSISTENT' | 'ANOMALY_DETECTED' | 'UNKNOWN' = 'UNKNOWN';

  try {
    if (mimeType === 'application/pdf') {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(4096);
      fs.readSync(fd, buf, 0, 4096, 0);
      fs.closeSync(fd);
      const header = buf.toString('latin1');

      const creatorMatch  = header.match(/\/Creator\s*\(([^)]+)\)/);
      const producerMatch = header.match(/\/Producer\s*\(([^)]+)\)/);
      const authorMatch   = header.match(/\/Author\s*\(([^)]+)\)/);
      const creationMatch = header.match(/\/CreationDate\s*\(([^)]+)\)/);
      const modMatch      = header.match(/\/ModDate\s*\(([^)]+)\)/);

      software         = creatorMatch?.[1] || producerMatch?.[1];
      author           = authorMatch?.[1];
      creationDate     = creationMatch?.[1];
      modificationDate = modMatch?.[1];

      if (creationDate && modificationDate && creationDate !== modificationDate) {
        anomalies.push('Document was modified after creation — verify if this is an expected amendment');
      }
      if (software?.toLowerCase().includes('ghostscript')) {
        anomalies.push('PDF produced by GhostScript — may indicate re-conversion from another format');
      }
      if (software?.toLowerCase().includes('photoshop')) {
        anomalies.push('PDF produced from Photoshop — unexpected for a government text document');
      }
      metadataConsistency = anomalies.length > 0 ? 'ANOMALY_DETECTED' : 'CONSISTENT';

    } else if (mimeType.startsWith('image/')) {
      try {
        const ExifReader = require('exifreader');
        const buffer = fs.readFileSync(filePath);
        const tags = ExifReader.load(buffer);
        hasExif = true;

        const created  = tags['DateTimeOriginal']?.description || tags['DateTime']?.description;
        const modified = tags['DateTimeDigitized']?.description;
        software       = tags['Software']?.description;
        author         = tags['Artist']?.description;

        if (created)  creationDate     = created;
        if (modified) modificationDate = modified;

        if (tags['GPS Latitude'] || tags['GPSLatitude']) {
          anomalies.push('Image contains GPS coordinates — location metadata embedded');
        }
        if (software?.match(/photoshop|gimp|lightroom/i)) {
          anomalies.push(`Image edited with ${software} — verify authenticity`);
        }
        metadataConsistency = anomalies.length > 0 ? 'ANOMALY_DETECTED' : 'CONSISTENT';
      } catch {
        hasExif = false;
        metadataConsistency = 'UNKNOWN';
      }
    }

    if (fileSizeBytes > 25 * 1024 * 1024) {
      anomalies.push('Unusually large file — verify it has not been padded with hidden data');
    }
  } catch (err) {
    logger.warn('Metadata extraction error:', err);
  }

  return {
    fileSize: fileSizeBytes,
    mimeType,
    anomalies,
    creationDate,
    modificationDate,
    author,
    software,
    hasExif,
    metadataConsistency,
  };
}

// ─── TF-IDF Helpers ───────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

function computeTfIdf(tokens: string[], vocabulary: string[]): number[] {
  const tf: Record<string, number> = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  const total = tokens.length || 1;
  return vocabulary.map(term => (tf[term] || 0) / total);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot  += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function extractKeyTerms(tokens: string[]): string[] {
  const freq: Record<string, number> = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);
}

function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const { field, pattern } of FIELD_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) fields[field] = match[1].trim();
  }
  return fields;
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runIntelligencePipeline(
  documentId: string,
  filePath: string,
  mimeType: string,
  instituteId: string
): Promise<IntelligenceReport> {
  const start = Date.now();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  // 1. Extract text
  const extraction = await extractText(filePath, mimeType);

  // 2. Extract metadata
  const metadata = extractMetadata(filePath, mimeType, doc.fileSizeBytes);

  // 3. Tokenize
  const tokens   = tokenize(extraction.text);
  const keyTerms = extractKeyTerms(tokens);

  // 4. Build vocabulary from institute corpus
  const existingVectors = await prisma.documentVector.findMany({
    where: { instituteId },
    select: { vocabulary: true, documentId: true },
  });

  const allTerms    = existingVectors.flatMap(v => (v.vocabulary as string[]) || []);
  const corpusVocab = Array.from(new Set([...tokens, ...allTerms])).slice(0, 500);
  const embedding   = computeTfIdf(tokens, corpusVocab);

  // 5. Upsert vector
  await prisma.documentVector.upsert({
    where:  { documentId },
    create: { documentId, instituteId, embedding, vocabulary: corpusVocab, textLength: tokens.length },
    update: { embedding, vocabulary: corpusVocab, textLength: tokens.length, processedAt: new Date() },
  });

  // 6. Find similar historical documents
  const similarDocuments: IntelligenceReport['similarDocuments'] = [];
  for (const vec of existingVectors) {
    if (vec.documentId === documentId) continue;
    const otherVocab = (vec.vocabulary as string[]) || [];
    const otherEmb   = computeTfIdf(otherVocab, corpusVocab);
    const sim        = cosineSimilarity(embedding, otherEmb);
    if (sim > 0.08) {
      const relDoc = await prisma.document.findUnique({
        where:  { id: vec.documentId },
        select: { originalName: true, documentType: true, uploadedAt: true },
      });
      if (relDoc) {
        similarDocuments.push({
          documentId: vec.documentId,
          originalName: relDoc.originalName,
          documentType: relDoc.documentType,
          similarity: Math.round(sim * 100) / 100,
          uploadedAt: relDoc.uploadedAt.toISOString(),
        });
      }
    }
  }
  similarDocuments.sort((a, b) => b.similarity - a.similarity);

  // 7. Detect discrepancies within the same application
  const thisFields = extractFields(extraction.text);
  const discrepancies: IntelligenceReport['discrepancies'] = [];

  if (doc.applicationId && Object.keys(thisFields).length > 0) {
    const appDocs = await prisma.document.findMany({
      where: { applicationId: doc.applicationId, isActive: true, id: { not: documentId } },
      select: { id: true, originalName: true, extractedText: true },
    });
    for (const other of appDocs) {
      if (!other.extractedText) continue;
      const otherFields = extractFields(other.extractedText);
      for (const [field, value] of Object.entries(thisFields)) {
        if (otherFields[field] && otherFields[field].toLowerCase() !== value.toLowerCase()) {
          discrepancies.push({
            field,
            thisValue: value,
            conflictingValue: otherFields[field],
            conflictingDocumentId: other.id,
            conflictingDocumentName: other.originalName,
            severity: ['intake_capacity', 'approved_intake', 'approval_number'].includes(field) ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    }
  }

  // 8. Suggest missing fields from historical docs
  const suggestions: IntelligenceReport['suggestions'] = [];
  const missingFields = FIELD_PATTERNS.map(p => p.field).filter(f => !thisFields[f]);

  for (const field of missingFields.slice(0, 5)) {
    for (const vec of existingVectors.slice(0, 15)) {
      const histDoc = await prisma.document.findUnique({
        where:  { id: vec.documentId },
        select: { id: true, originalName: true, extractedText: true },
      });
      if (!histDoc?.extractedText) continue;
      const hf = extractFields(histDoc.extractedText);
      if (hf[field]) {
        suggestions.push({
          field,
          suggestedValue: hf[field],
          sourceDocumentId: histDoc.id,
          sourceDocumentName: histDoc.originalName,
          confidence: 0.6,
        });
        break;
      }
    }
  }

  // 9. Persist text + report to Document
  const report: IntelligenceReport = {
    documentId,
    processedAt: new Date().toISOString(),
    extraction: {
      textLength: extraction.text.length,
      textPreview: extraction.text.slice(0, 600),
      method: extraction.method,
      confidence: extraction.confidence,
    },
    metadata,
    similarDocuments: similarDocuments.slice(0, 5),
    discrepancies,
    suggestions,
    keyTerms,
    processingTimeMs: Date.now() - start,
  };

  await prisma.document.update({
    where: { id: documentId },
    data: {
      extractedText:   extraction.text.slice(0, 50000),
      intelligenceReport: report as any,
      hasEmbeddedText: extraction.text.length > 50,
      ocrConfidence:   extraction.confidence,
    },
  });

  // 10. Auto-create Findings for discrepancies
  if (doc.applicationId) {
    for (const d of discrepancies) {
      const exists = await prisma.finding.findFirst({
        where: { applicationId: doc.applicationId, title: { contains: d.field } },
      });
      if (!exists) {
        await prisma.finding.create({
          data: {
            applicationId: doc.applicationId,
            documentId,
            type: 'CONTRADICTION',
            severity: d.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
            title: `Field discrepancy: ${d.field}`,
            description: `"${d.thisValue}" in this document conflicts with "${d.conflictingValue}" in ${d.conflictingDocumentName}.`,
            evidence: {
              field: d.field,
              thisDocument: { id: documentId, value: d.thisValue },
              conflictingDocument: { id: d.conflictingDocumentId, name: d.conflictingDocumentName, value: d.conflictingValue },
              note: 'Auto-detected by intelligence pipeline. Manual review required.',
            },
          },
        });
      }
    }

    // 11. Auto-create Finding for metadata anomalies
    if (metadata.anomalies.length > 0) {
      const mExists = await prisma.finding.findFirst({
        where: { applicationId: doc.applicationId, documentId, type: 'FORENSIC_SIGNAL' },
      });
      if (!mExists) {
        await prisma.finding.create({
          data: {
            applicationId: doc.applicationId,
            documentId,
            type: 'FORENSIC_SIGNAL',
            severity: 'MEDIUM',
            title: `Metadata anomaly in ${doc.originalName}`,
            description: metadata.anomalies.join('; '),
            evidence: {
              anomalies: metadata.anomalies,
              software: metadata.software,
              author: metadata.author,
            },
          },
        });
      }
    }
  }

  logger.info(`[Intelligence] Completed ${documentId} in ${report.processingTimeMs}ms — ${discrepancies.length} discrepancies, ${metadata.anomalies.length} anomalies`);
  return report;
}
