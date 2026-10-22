'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, Send, ArrowRight, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import { DOC_TYPE_LABELS, formatFileSize } from '@/lib/utils';
import Link from 'next/link';

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS);

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastUploadedAppId, setLastUploadedAppId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: appsData, refetch } = useQuery({
    queryKey: ['institute-applications-upload'],
    queryFn: () => api.get('/institute/applications', { params: { limit: 100 } }).then(r => r.data),
  });

  const draftApps = appsData?.applications?.filter(
    (a: any) => a.status === 'DRAFT' || a.status === 'REQUIRES_CLARIFICATION'
  ) || [];

  const selectedApp = draftApps.find((a: any) => a.id === applicationId);

  const handleFile = (f: File) => {
    const allowedTypes = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
    ];
    if (!allowedTypes.includes(f.type)) {
      toast({ title: 'File type not allowed', description: 'Use PDF, JPEG, PNG, TIFF, WEBP, or DOCX', variant: 'destructive' });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 50MB', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const upload = async () => {
    if (!file || !documentType || !applicationId) {
      toast({ title: 'Missing fields', description: 'Please select a file, document type, and application', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('applicationId', applicationId);
    if (description) formData.append('description', description);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({
        title: '✅ Document uploaded!',
        description: `${file.name} uploaded. AI pipeline is now processing it in the background.`,
        variant: 'success',
      });
      setLastUploadedAppId(applicationId);
      setFile(null);
      setDescription('');
      qc.invalidateQueries({ queryKey: ['institute-applications-upload'] });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.response?.data?.error || 'Please try again', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const submitApplication = async (appId: string) => {
    setSubmitting(true);
    try {
      await api.post(`/institute/applications/${appId}/submit`);
      toast({
        title: '🚀 Application submitted!',
        description: 'Officers can now review your application and all uploaded documents.',
        variant: 'success',
      });
      setLastUploadedAppId(null);
      qc.invalidateQueries({ queryKey: ['institute-applications-upload'] });
      refetch();
    } catch (e: any) {
      toast({ title: 'Submit failed', description: e.response?.data?.error || 'Please try again', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Documents</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Upload supporting documents for your application. All files are processed securely on-premise.
        </p>
      </div>

      {/* Workflow banner */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl">
        <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-indigo-800 dark:text-indigo-300 mb-1">How submission works</p>
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 flex-wrap text-xs">
            <span className="flex items-center gap-1">
              <span className="bg-indigo-200 dark:bg-indigo-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
              Create application
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1">
              <span className="bg-indigo-200 dark:bg-indigo-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
              Upload all documents
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1 font-semibold text-indigo-800 dark:text-indigo-300">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
              Click "Submit Now"
            </span>
          </div>
        </div>
      </div>

      {/* Post-upload: Submit Now banner */}
      {lastUploadedAppId && (
        <div className="flex items-center justify-between gap-4 p-4 bg-green-50 dark:bg-green-950/60 border border-green-300 dark:border-green-700 rounded-xl">
          <div className="flex items-start gap-3 min-w-0">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">Document uploaded!</p>
              <p className="text-green-700 dark:text-green-400 text-xs mt-0.5">
                Officers only see <strong>submitted</strong> applications. Click "Submit Now" when you've uploaded all documents.
              </p>
              <p className="text-green-600 dark:text-green-500 text-xs flex items-center gap-1 mt-1">
                <Brain className="w-3 h-3" /> AI intelligence pipeline processing in background…
              </p>
            </div>
          </div>
          <Button
            onClick={() => submitApplication(lastUploadedAppId)}
            disabled={submitting}
            className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Submitting…' : 'Submit Now'}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 dark:text-white">
            <Upload className="w-4 h-4 text-indigo-600" />
            Document Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Application selector */}
          <div className="space-y-1.5">
            <Label className="dark:text-gray-300">Application <span className="text-red-500">*</span></Label>
            <select
              value={applicationId}
              onChange={e => setApplicationId(e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select an application…</option>
              {draftApps.map((a: any) => (
                <option key={a.id} value={a.id}>{a.title} ({a.applicationNumber})</option>
              ))}
            </select>
            {draftApps.length === 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                No draft applications.{' '}
                <Link href="/institute/applications" className="underline font-medium">Create one first →</Link>
              </p>
            )}
            {selectedApp && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Status: <span className="font-medium capitalize">{selectedApp.status.toLowerCase().replace('_', ' ')}</span>
                {' '}· {selectedApp._count?.documents ?? selectedApp.documents?.length ?? 0} document(s) so far
              </p>
            )}
          </div>

          {/* Document type */}
          <div className="space-y-1.5">
            <Label className="dark:text-gray-300">Document Type <span className="text-red-500">*</span></Label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select document type…</option>
              {DOC_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* File dropzone */}
          <div className="space-y-1.5">
            <Label className="dark:text-gray-300">File <span className="text-red-500">*</span></Label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
                  : file
                  ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700'
                  : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.webp,.docx,.doc"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)} · {file.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, JPEG, PNG, TIFF, WEBP, DOCX · Max 50MB</p>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="dark:text-gray-300">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this document (e.g., 'AICTE approval letter for 2025-26 session')…"
              rows={2}
              className="dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Privacy/AI notice */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800 rounded-xl">
            <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              After upload, the IEI AI pipeline automatically performs OCR, metadata analysis, discrepancy detection,
              and vector similarity search — all locally. No data leaves the system.
            </p>
          </div>

          <Button
            onClick={upload}
            disabled={uploading || !file || !documentType || !applicationId}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload Document
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader><CardTitle className="text-sm text-gray-600 dark:text-gray-400">Upload Guidelines</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            'Ensure documents are clearly legible and complete',
            'PDF format is preferred for text documents',
            'Infrastructure images should be recent and high-resolution',
            'Upload the original file — do not re-scan or re-compress',
            'AI pipeline auto-extracts fields and cross-checks claims across documents',
            'All uploads are hashed (SHA-256) to preserve integrity',
            'Upload ALL documents, then click "Submit Now" to send for officer review',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
              {tip}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
