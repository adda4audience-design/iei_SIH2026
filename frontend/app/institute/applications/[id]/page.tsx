'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, formatDateTime, formatFileSize, STATUS_COLORS, SEVERITY_COLORS, FINDING_TYPE_LABELS, DOC_TYPE_LABELS } from '@/lib/utils';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Clock, Building2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function InstituteApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: application, isLoading } = useQuery({
    queryKey: ['institute-application', id],
    queryFn: () => api.get(`/institute/applications/${id}`).then(r => r.data),
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="flex items-center gap-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        Loading application…
      </div>
    </div>
  );

  if (!application) return <div className="p-8 text-center text-gray-400">Application not found.</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{application.title}</h1>
            <Badge className={STATUS_COLORS[application.status]}>{application.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{application.applicationNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Documents" value={application.documents?.length || 0} icon={FileText} color="text-indigo-600 bg-indigo-50" />
        <StatCard label="Open Findings" value={application.findings?.filter((f: any) => !f.isDismissed).length || 0} icon={AlertTriangle} color="text-orange-600 bg-orange-50" />
        <StatCard label="Status" value={application.status.replace(/_/g, ' ')} icon={CheckCircle} color="text-green-600 bg-green-50" isText />
      </div>

      {/* Status message */}
      {application.status === 'APPROVED' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold">Application Approved</p>
            {application.officerNotes && <p className="text-green-700 mt-0.5">{application.officerNotes}</p>}
          </div>
        </div>
      )}
      {application.status === 'REJECTED' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <p className="font-semibold">Application Rejected</p>
          {application.rejectionReason && <p className="text-red-700 mt-0.5">{application.rejectionReason}</p>}
        </div>
      )}
      {application.status === 'REQUIRES_CLARIFICATION' && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 text-sm">
          <p className="font-semibold">Clarification Required</p>
          {application.officerNotes && <p className="text-orange-700 mt-0.5">{application.officerNotes}</p>}
          <p className="text-orange-600 text-xs mt-1">Please upload additional documents and resubmit.</p>
        </div>
      )}

      {/* Documents */}
      <Card>
        <CardHeader><CardTitle className="text-base">Submitted Documents ({application.documents?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {application.documents?.length === 0 ? (
            <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
          ) : application.documents?.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</p>
                <p className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.documentType]} · {formatFileSize(doc.fileSizeBytes)}</p>
              </div>
              <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(doc.uploadedAt)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Findings (limited view) */}
      {application.findings?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <CardTitle className="text-base">Review Findings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">These are the findings raised by the reviewing officer. Dismissed findings are shown in grey.</p>
            {application.findings.map((f: any) => (
              <div key={f.id} className={`p-3 rounded-xl border ${f.isDismissed ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-orange-100 bg-orange-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={SEVERITY_COLORS[f.severity]}>{f.severity}</Badge>
                  <span className="text-xs text-gray-500">{FINDING_TYPE_LABELS[f.type]}</span>
                  {f.isDismissed && <Badge className="bg-gray-100 text-gray-500 text-xs">Dismissed</Badge>}
                </div>
                <p className="text-sm font-medium text-gray-900">{f.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{f.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Review Timeline */}
      {application.reviewActions?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Review Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {application.reviewActions.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700">{a.action.replace(/_/g, ' ')}</span>
                    {a.rationale && <span className="text-gray-500"> — {a.rationale}</span>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, isText = false }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`${isText ? 'text-base mt-1' : 'text-2xl'} font-bold text-gray-900 mt-1`}>{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
