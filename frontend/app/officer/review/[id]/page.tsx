'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  formatDate, formatDateTime, formatFileSize,
  STATUS_COLORS, SEVERITY_COLORS, FINDING_TYPE_LABELS, DOC_TYPE_LABELS
} from '@/lib/utils';
import {
  ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle,
  Shield, Activity, Eye, Microscope, Network, ClipboardList,
  ChevronRight, Download, Loader2, Clock, Building2, Brain, ListChecks
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Lazy load the evidence graph
const EvidenceGraph = dynamic(() => import('@/components/shared/EvidenceGraph'), { ssr: false });

type Tab = 'overview' | 'documents' | 'findings' | 'verification' | 'graph' | 'audit' | 'intelligence' | 'validation';

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [decisionModal, setDecisionModal] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [dismissModal, setDismissModal] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [forensicsLoading, setForensicsLoading] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const { data: application, isLoading } = useQuery({
    queryKey: ['officer-application', id],
    queryFn: () => api.get(`/officer/applications/${id}`).then(r => r.data),
  });

  const { data: validationReport, isLoading: vrLoading } = useQuery({
    queryKey: ['validation-report', id],
    queryFn: () => api.get(`/officer/applications/${id}/validation-report`).then(r => r.data),
    enabled: !!id,
    staleTime: 30000,
  });

  const assignMutation = useMutation({
    mutationFn: () => api.patch(`/officer/applications/${id}/assign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer-application', id] });
      toast({ title: 'Application assigned to you', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'destructive' }),
  });

  const decisionMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/officer/applications/${id}/decision`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer-application', id] });
      setDecisionModal(null);
      setDecisionReason('');
      toast({ title: 'Decision recorded successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'destructive' }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ findingId, reason }: { findingId: string; reason: string }) =>
      api.patch(`/findings/${findingId}/dismiss`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer-application', id] });
      setDismissModal(null);
      setDismissReason('');
      toast({ title: 'Finding dismissed', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'destructive' }),
  });

  const runForensics = async (docId: string) => {
    setForensicsLoading(docId);
    try {
      await api.post(`/documents/${docId}/forensics`);
      qc.invalidateQueries({ queryKey: ['officer-application', id] });
      toast({ title: 'Forensic analysis complete', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Forensics failed', description: e.response?.data?.error, variant: 'destructive' });
    } finally {
      setForensicsLoading(null);
    }
  };

  const runVerification = async (apiName: string, payload: any) => {
    setVerifyLoading(true);
    try {
      await api.post('/verifications/run', { applicationId: id, apiName, payload });
      qc.invalidateQueries({ queryKey: ['officer-application', id] });
      toast({ title: 'Mock verification complete', description: '[MOCK] Results labelled accordingly', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e.response?.data?.error, variant: 'destructive' });
    } finally {
      setVerifyLoading(false);
    }
  };

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="flex items-center gap-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        Loading application…
      </div>
    </div>
  );

  if (!application) return (
    <div className="p-8 text-center text-gray-400">Application not found.</div>
  );

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'validation', label: 'Validation', icon: ListChecks },
    { key: 'documents', label: 'Documents', icon: FileText, count: application.documents?.length },
    { key: 'findings', label: 'Findings', icon: AlertTriangle, count: application.findings?.filter((f: any) => !f.isDismissed).length },
    { key: 'intelligence', label: 'Intelligence', icon: Brain },
    { key: 'verification', label: 'Verification', icon: Shield, count: application.verifications?.length },
    { key: 'graph', label: 'Evidence Graph', icon: Network },
    { key: 'audit', label: 'Audit Trail', icon: ClipboardList },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{application.title}</h1>
            <Badge className={STATUS_COLORS[application.status]}>{application.status.replace(/_/g, ' ')}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span className="font-mono text-xs">{application.applicationNumber}</span>
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{application.institute?.name}</span>
            {application.submittedAt && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Submitted {formatDate(application.submittedAt)}</span>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 shrink-0">
          {application.status === 'SUBMITTED' && (
            <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending} size="sm" variant="outline">
              {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign to Me'}
            </Button>
          )}
          {application.status === 'UNDER_REVIEW' && (
            <>
              <Button onClick={() => setDecisionModal('APPROVED')} size="sm" className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4" /> Approve
              </Button>
              <Button onClick={() => setDecisionModal('REQUIRES_CLARIFICATION')} size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50">
                Needs Clarification
              </Button>
              <Button onClick={() => setDecisionModal('REJECTED')} size="sm" variant="destructive">
                <XCircle className="w-4 h-4" /> Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  t.key === 'findings' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Application Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Row label="Description" value={application.description || '—'} />
                <Row label="Institution" value={`${application.institute?.name} (${application.institute?.code})`} />
                <Row label="Location" value={`${application.institute?.city}, ${application.institute?.state}`} />
                <Row label="Contact" value={application.institute?.contactName} />
                <Row label="Submitted" value={application.submittedAt ? formatDateTime(application.submittedAt) : '—'} />
                <Row label="Assigned Officer" value={application.assignedOfficer?.name || 'Unassigned'} />
                {application.officerNotes && <Row label="Officer Notes" value={application.officerNotes} />}
                {application.rejectionReason && <Row label="Rejection Reason" value={application.rejectionReason} className="text-red-600" />}
              </CardContent>
            </Card>

            {application.reviewActions?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Review Timeline</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {application.reviewActions.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        <div>
                          <span className="font-medium text-gray-700">{a.action.replace(/_/g, ' ')}</span>
                          {a.rationale && <span className="text-gray-500"> — {a.rationale}</span>}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.createdAt)} · {a.user?.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <StatRow icon={FileText} label="Documents" value={application.documents?.length || 0} color="text-blue-600" />
                <StatRow icon={AlertTriangle} label="Open Findings" value={application.findings?.filter((f: any) => !f.isDismissed).length || 0} color="text-orange-600" />
                <StatRow icon={Shield} label="Verifications Run" value={application.verifications?.length || 0} color="text-purple-600" />
              </CardContent>
            </Card>

            {/* Critical findings preview */}
            {application.findings?.filter((f: any) => !f.isDismissed && ['HIGH', 'CRITICAL'].includes(f.severity)).length > 0 && (
              <Card className="border-orange-200">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <CardTitle className="text-base text-orange-700">High-Priority Findings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {application.findings.filter((f: any) => !f.isDismissed && ['HIGH', 'CRITICAL'].includes(f.severity)).map((f: any) => (
                    <div key={f.id} className="p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                      <p className="text-xs font-semibold text-orange-800">{f.title}</p>
                      <p className="text-xs text-orange-600 mt-0.5 line-clamp-2">{f.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── DOCUMENTS ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          {application.documents?.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-gray-400">No documents uploaded.</CardContent></Card>
          ) : application.documents?.map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{doc.originalName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {DOC_TYPE_LABELS[doc.documentType]} · {formatFileSize(doc.fileSizeBytes)} · {doc.mimeType}
                      </p>
                      {doc.description && <p className="text-xs text-gray-500 mt-1">{doc.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">SHA-256: <span className="font-mono">{doc.fileHash?.substring(0, 24)}…</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/uploads/${doc.storedName}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> View
                    </a>
                    <Button size="sm" variant="outline"
                      onClick={() => runForensics(doc.id)}
                      disabled={forensicsLoading === doc.id}>
                      {forensicsLoading === doc.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
                      ) : (
                        <><Microscope className="w-3.5 h-3.5" /> Forensics</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Forensic report */}
                {doc.forensicReports?.[0] && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Microscope className="w-4 h-4 text-purple-600" />
                      <p className="text-sm font-semibold text-gray-700">Forensic Analysis</p>
                      <Badge className={SEVERITY_COLORS[doc.forensicReports[0].overallRiskLevel]}>
                        {doc.forensicReports[0].overallRiskLevel} RISK
                      </Badge>
                      <span className="text-xs text-orange-600 font-medium">
                        [MOCK — demonstration only]
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{doc.forensicReports[0].summary}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {doc.forensicReports[0].metadataAnalysis && (
                        <ForensicCard title="Metadata" data={doc.forensicReports[0].metadataAnalysis} />
                      )}
                      {doc.forensicReports[0].typographySignals && (
                        <ForensicCard title="Typography" data={doc.forensicReports[0].typographySignals} />
                      )}
                      {doc.forensicReports[0].pdfStructure && (
                        <ForensicCard title="PDF Structure" data={doc.forensicReports[0].pdfStructure} />
                      )}
                      {doc.forensicReports[0].pixelAnalysis && (
                        <ForensicCard title="Pixel Analysis" data={doc.forensicReports[0].pixelAnalysis} />
                      )}
                      {doc.forensicReports[0].duplicateCheck && (
                        <ForensicCard title="Duplicate Check" data={doc.forensicReports[0].duplicateCheck} />
                      )}
                      {doc.forensicReports[0].aiEditIndicator && (
                        <ForensicCard title="AI-Edit Indicator" data={doc.forensicReports[0].aiEditIndicator} />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">{doc.forensicReports[0].limitations}</p>
                  </div>
                )}

                {/* Claims */}
                {doc.claims?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Extracted Claims ({doc.claims.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {doc.claims.map((c: any) => (
                        <div key={c.id} className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                          <span className="text-gray-500">{c.fieldName}:</span>{' '}
                          <span className="font-semibold text-gray-800">{c.extractedValue}</span>
                          {c.pageNumber && <span className="text-gray-400 ml-1">(p.{c.pageNumber})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── FINDINGS ── */}
      {tab === 'findings' && (
        <div className="space-y-4">
          {application.findings?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
                No findings detected
              </CardContent>
            </Card>
          ) : application.findings?.map((f: any) => (
            <Card key={f.id} className={f.isDismissed ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={SEVERITY_COLORS[f.severity]}>{f.severity}</Badge>
                      <Badge variant="outline" className="text-xs">{FINDING_TYPE_LABELS[f.type] || f.type}</Badge>
                      {f.isDismissed && <Badge className="bg-gray-100 text-gray-500">DISMISSED</Badge>}
                    </div>
                    <p className="font-semibold text-gray-900">{f.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{f.description}</p>
                    {f.document && (
                      <p className="text-xs text-gray-400 mt-1">Source: {f.document.originalName} ({DOC_TYPE_LABELS[f.document.documentType]})</p>
                    )}
                    {f.claim && (
                      <p className="text-xs text-gray-400">Claim: {f.claim.fieldName} = "{f.claim.extractedValue}" (p.{f.claim.pageNumber})</p>
                    )}

                    {/* Evidence */}
                    {f.evidence && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Evidence Details:</p>
                        {f.evidence.values?.map((v: any, i: number) => (
                          <div key={i} className="text-xs flex items-center gap-2">
                            <span className="text-gray-400">•</span>
                            <span className="font-mono text-blue-700">{v.value}</span>
                            <span className="text-gray-400">in</span>
                            <span className="text-gray-700">{v.document}</span>
                          </div>
                        ))}
                        {f.evidence.note && <p className="text-xs text-orange-600 italic mt-1">{f.evidence.note}</p>}
                        {f.evidence.isMocked && <p className="text-xs text-gray-400 mt-1">[MOCK verification data]</p>}
                      </div>
                    )}
                  </div>

                  {!f.isDismissed && (
                    <Button size="sm" variant="outline" onClick={() => setDismissModal(f.id)}
                      className="shrink-0 text-gray-600 hover:text-red-600 hover:border-red-300">
                      Dismiss
                    </Button>
                  )}
                  {f.isDismissed && f.dismissedReason && (
                    <div className="text-xs text-gray-400 italic shrink-0 max-w-[180px]">
                      Dismissed: {f.dismissedReason}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── VERIFICATION ── */}
      {tab === 'verification' && (
        <div className="space-y-6">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                [MOCK] Government API Verification — For Demonstration Only
              </p>
              <p className="text-xs text-orange-700 mt-1">
                All verification responses below are simulated. Real integration requires authorized government API access.
                API Setu and similar gateways require separate credentials and approval.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'AICTE_APPROVAL_API', label: 'AICTE Approval', desc: 'Verify approval letter details', payload: { claimedIntake: 120, approvalYear: '2026-27' } },
              { name: 'UGC_AFFILIATION_API', label: 'UGC Affiliation', desc: 'Verify affiliation status', payload: {} },
              { name: 'DTE_INTAKE_API', label: 'DTE Intake', desc: 'Verify sanctioned intake capacity', payload: { claimedIntake: 120, programmeCode: 'CSE', academicYear: '2026-27' } },
            ].map(api_item => (
              <Card key={api_item.name}>
                <CardContent className="p-5">
                  <p className="font-semibold text-gray-900">{api_item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-3">{api_item.desc}</p>
                  <Button size="sm" onClick={() => runVerification(api_item.name, api_item.payload)}
                    disabled={verifyLoading} variant="outline" className="w-full">
                    {verifyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Shield className="w-3.5 h-3.5" /> Run Mock Check</>}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {application.verifications?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700">Verification Results</h3>
              {application.verifications.map((v: any) => (
                <Card key={v.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{v.apiName.replace(/_/g, ' ')}</p>
                        <Badge className={
                          v.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                          v.status === 'MISMATCH' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }>{v.status}</Badge>
                        <Badge className="bg-orange-100 text-orange-700 text-xs">MOCK</Badge>
                      </div>
                      <p className="text-xs text-gray-400">{formatDateTime(v.requestedAt)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 font-medium mb-1">Request Payload</p>
                        <pre className="bg-gray-50 rounded p-2 text-gray-700 overflow-auto text-xs">
                          {JSON.stringify(v.requestPayload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium mb-1">Response</p>
                        <pre className="bg-gray-50 rounded p-2 text-gray-700 overflow-auto text-xs">
                          {JSON.stringify(v.responsePayload, null, 2)}
                        </pre>
                      </div>
                    </div>
                    {v.notes && <p className="text-xs text-gray-400 mt-2 italic">{v.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EVIDENCE GRAPH ── */}
      {tab === 'graph' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-600" />
              <CardTitle>Evidence Graph</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0" style={{ height: 500 }}>
            <EvidenceGraph applicationId={id} />
          </CardContent>
        </Card>
      )}

      {/* ── AUDIT ── */}
      {tab === 'audit' && (
        <Card>
          <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
          <CardContent>
            {application.reviewActions?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No review actions recorded yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-100" />
                <div className="space-y-4 pl-8">
                  {application.reviewActions?.map((a: any) => (
                    <div key={a.id} className="relative">
                      <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-blue-400 border-2 border-white" />
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{a.action.replace(/_/g, ' ')}</p>
                            {a.rationale && <p className="text-sm text-gray-600 mt-0.5">{a.rationale}</p>}
                            <p className="text-xs text-gray-400 mt-1">{a.user?.email} · {a.user?.role}</p>
                          </div>
                          <p className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(a.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── VALIDATION REPORT ── */}
      {tab === 'validation' && (
        <div className="space-y-6">
          {vrLoading ? (
            <div className="flex items-center gap-3 p-8 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Generating validation report…
            </div>
          ) : validationReport ? (
            <>
              {/* Score banner */}
              <div className={`p-5 rounded-2xl border-2 flex items-start justify-between gap-4 ${
                validationReport.overallStatus === 'COMPLIANT' ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700' :
                validationReport.overallStatus === 'PARTIAL'   ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700' :
                'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700'
              }`}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-gray-900 dark:text-white">
                    {validationReport.overallStatus === 'COMPLIANT' ? '✅ Documents Compliant' :
                     validationReport.overallStatus === 'PARTIAL'   ? '⚠️ Partial Compliance' : '❌ Non-Compliant'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Category: <strong>{validationReport.applicationType?.replace(/_/g, ' ')}</strong>
                    {' · '}Generated {new Date(validationReport.generatedAt).toLocaleString()}
                  </p>
                  {validationReport.missingRequiredDocs?.length > 0 && (
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1 font-medium">
                      Missing: {validationReport.missingRequiredDocs.join(', ')}
                    </p>
                  )}
                  {validationReport.expiredDocs?.length > 0 && (
                    <p className="text-sm text-orange-700 dark:text-orange-400 mt-1 font-medium">
                      Possibly Expired: {validationReport.expiredDocs.join(', ')}
                    </p>
                  )}
                  <div className="flex gap-6 mt-3 text-sm">
                    <span className="text-green-700 dark:text-green-400 font-medium">{validationReport.summary?.present} present</span>
                    <span className="text-red-700 dark:text-red-400 font-medium">{validationReport.summary?.missing} missing</span>
                    <span className="text-orange-700 dark:text-orange-400 font-medium">{validationReport.summary?.expired} expired</span>
                    <span className="text-blue-700 dark:text-blue-400 font-medium">{validationReport.aiFlags} AI flags</span>
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <div className={`text-5xl font-black ${
                    validationReport.complianceScore >= 80 ? 'text-green-600' :
                    validationReport.complianceScore >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>{validationReport.complianceScore}%</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compliance Score</p>
                  <p className="text-xs text-gray-400">{validationReport.summary?.present}/{validationReport.summary?.required} required docs</p>
                </div>
              </div>

              {/* Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-600" /> AICTE Document Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {validationReport.checklist?.map((item: any, i: number) => (
                      <div key={i} className={`flex items-start gap-4 p-4 ${
                        item.status === 'MISSING' && item.required ? 'bg-red-50/60 dark:bg-red-950/20' :
                        item.status === 'EXPIRED' ? 'bg-orange-50/60 dark:bg-orange-950/20' : ''
                      }`}>
                        <div className="mt-0.5 shrink-0">
                          {item.status === 'PRESENT' || item.status === 'PRESENT_EXPIRY_UNKNOWN'
                            ? <CheckCircle className="w-5 h-5 text-green-500" />
                            : item.status === 'EXPIRED'
                            ? <AlertTriangle className="w-5 h-5 text-orange-500" />
                            : item.required
                            ? <XCircle className="w-5 h-5 text-red-500" />
                            : <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{item.label}</span>
                            {item.required && <Badge className="text-xs bg-blue-100 text-blue-700 border-0">Required</Badge>}
                            {item.status === 'EXPIRED' && <Badge className="text-xs bg-orange-100 text-orange-700 border-0">Possibly Expired</Badge>}
                            {item.status === 'MISSING' && item.required && <Badge className="text-xs bg-red-100 text-red-700 border-0">MISSING</Badge>}
                          </div>
                          {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.notes}</p>}
                          {item.expiryNote && <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">⚠ {item.expiryNote}</p>}
                          {item.maxAgeMonths && item.status !== 'MISSING' && (
                            <p className="text-xs text-gray-400 mt-0.5">Valid window: {item.maxAgeMonths} months</p>
                          )}
                          {item.uploadedDocuments?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.uploadedDocuments.map((d: any) => (
                                <span key={d.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                  <FileText className="w-3 h-3" />{d.originalName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                          item.status === 'PRESENT' || item.status === 'PRESENT_EXPIRY_UNKNOWN' ? 'bg-green-100 text-green-700' :
                          item.status === 'EXPIRED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                        }`}>{item.status.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Findings summary */}
              {validationReport.findings?.filter((f: any) => !f.isDismissed).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      AI-Detected Findings
                      <Badge className="bg-orange-100 text-orange-700 border-0 text-xs ml-1">
                        {validationReport.findings.filter((f: any) => !f.isDismissed).length} active
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {validationReport.findings.filter((f: any) => !f.isDismissed).map((f: any) => (
                      <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-800">
                        <Badge className={`text-xs shrink-0 ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{f.description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{FINDING_TYPE_LABELS[f.type as keyof typeof FINDING_TYPE_LABELS]}</p>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Go to the Findings tab to review and dismiss individual findings.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Verification summary */}
              {validationReport.verificationSummary?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-blue-600" /> Issuer Verification Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {validationReport.verificationSummary.map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{v.apiName.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-2">
                            {v.isMocked && <Badge className="text-xs bg-gray-100 text-gray-500 border-0">[MOCK]</Badge>}
                            <Badge className={`text-xs border-0 ${v.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : v.status === 'MISMATCH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                              {v.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
                <Shield className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Advisory Only — </strong>{validationReport.disclaimer}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">Could not load validation report.</div>
          )}
        </div>
      )}

      {/* ── INTELLIGENCE ── */}
      {tab === 'intelligence' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
            <Brain className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              The intelligence pipeline runs automatically after each upload — OCR text extraction, metadata anomaly detection,
              TF-IDF vector similarity search, and field-level discrepancy detection. All processing is local and privacy-preserving.
            </p>
          </div>
          {application.documents?.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-4">
              {application.documents?.map((doc: any) => (
                <IntelligenceDocCard key={doc.id} docId={doc.id} docName={doc.originalName} docType={doc.documentType} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DECISION MODAL ── */}
      {decisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg text-gray-900 mb-1">
              {decisionModal === 'APPROVED' ? '✅ Approve Application' :
               decisionModal === 'REJECTED' ? '❌ Reject Application' :
               '⚠️ Request Clarification'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {decisionModal === 'APPROVED' ? 'Confirm that all documents have been reviewed and meet the requirements.' :
               decisionModal === 'REJECTED' ? 'Provide a reason for rejection. This will be visible to the institution.' :
               'Specify what additional information or clarification is needed.'}
            </p>
            <Textarea
              value={decisionReason}
              onChange={e => setDecisionReason(e.target.value)}
              placeholder={decisionModal === 'APPROVED' ? 'Optional notes for this approval…' : 'Enter reason (required)…'}
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setDecisionModal(null); setDecisionReason(''); }}>Cancel</Button>
              <Button
                onClick={() => decisionMutation.mutate({ decision: decisionModal, reason: decisionReason, notes: decisionReason })}
                disabled={decisionMutation.isPending || (['REJECTED', 'REQUIRES_CLARIFICATION'].includes(decisionModal) && !decisionReason.trim())}
                className={decisionModal === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : decisionModal === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
              >
                {decisionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── DISMISS MODAL ── */}
      {dismissModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg text-gray-900 mb-1">Dismiss Finding</h3>
            <p className="text-sm text-gray-500 mb-4">
              Provide a rationale for dismissing this finding. This action is logged in the audit trail.
            </p>
            <Textarea
              value={dismissReason}
              onChange={e => setDismissReason(e.target.value)}
              placeholder="Enter reason for dismissal (e.g., 'Amendment document explains intake change')…"
              rows={3}
              className="mb-4"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setDismissModal(null); setDismissReason(''); }}>Cancel</Button>
              <Button
                onClick={() => dismissMutation.mutate({ findingId: dismissModal, reason: dismissReason })}
                disabled={dismissMutation.isPending || !dismissReason.trim()}
                variant="secondary"
              >
                {dismissMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dismiss Finding'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-gray-500 font-medium w-36 shrink-0">{label}</span>
      <span className={`text-gray-900 ${className || ''}`}>{value}</span>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Icon className={`w-4 h-4 ${color}`} />
        {label}
      </div>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}

function ForensicCard({ title, data }: { title: string; data: any }) {
  const hasIssue = JSON.stringify(data).toLowerCase().includes('anomaly') ||
    JSON.stringify(data).toLowerCase().includes('detected') ||
    JSON.stringify(data).toLowerCase().includes('inconsistency');

  return (
    <div className={`rounded-lg p-3 border text-xs ${hasIssue ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className={`font-semibold mb-1 ${hasIssue ? 'text-orange-700' : 'text-gray-700'}`}>{title}</p>
      <p className="text-gray-600 line-clamp-3">{data.notes || data.note || JSON.stringify(data).substring(0, 80) + '…'}</p>
      {data.result && <p className="mt-1 font-medium text-gray-700">{data.result}</p>}
    </div>
  );
}

// ── Intelligence per-document card ──────────────────────────────────────────
function IntelligenceDocCard({ docId, docName, docType }: { docId: string; docName: string; docType: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['doc-intelligence', docId],
    queryFn: () => api.get(`/documents/${docId}/intelligence`).then(r => r.data),
    retry: false,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
          <div className="min-w-0">
            <CardTitle className="text-sm truncate">{docName}</CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{docType.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading intelligence report…</div>
        )}
        {isError || (data && data.message) ? (
          <div className="text-sm text-gray-400 py-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            {data?.message || 'Intelligence pipeline still processing — refresh in a moment.'}
          </div>
        ) : data && (
          <div className="space-y-4">
            {/* Text extraction */}
            <div className="text-xs space-y-1">
              <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                📄 Text Extraction
                <Badge className="ml-2 text-xs border-0 bg-gray-100 text-gray-600">
                  {data.extraction?.method} · {Math.round((data.extraction?.confidence || 0) * 100)}% confidence
                </Badge>
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-h-24 overflow-y-auto whitespace-pre-wrap border border-gray-200 dark:border-gray-700">
                {data.extraction?.textLength === 0
                  ? '[No extractable text — image or unsupported format]'
                  : data.extraction?.textPreview || '[No preview available]'}
              </div>
            </div>

            {/* Key terms */}
            {data.keyTerms?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">🔑 Key Terms</p>
                <div className="flex flex-wrap gap-1">
                  {data.keyTerms.slice(0, 12).map((term: string) => (
                    <span key={term} className="text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">{term}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                🔍 Metadata Analysis
                <Badge className={`ml-2 text-xs border-0 ${data.metadata?.metadataConsistency === 'ANOMALY_DETECTED' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {data.metadata?.metadataConsistency?.replace(/_/g, ' ') || 'UNKNOWN'}
                </Badge>
              </p>
              {data.metadata?.anomalies?.length > 0 ? (
                <div className="space-y-1">
                  {data.metadata.anomalies.map((a: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 rounded p-2">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> No metadata anomalies detected
                </p>
              )}
              {data.metadata?.software && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Software: {data.metadata.software}</p>
              )}
            </div>

            {/* Discrepancies */}
            {data.discrepancies?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">⚡ Field Discrepancies ({data.discrepancies.length})</p>
                <div className="space-y-2">
                  {data.discrepancies.map((d: any, i: number) => (
                    <div key={i} className="text-xs border border-red-200 dark:border-red-800 rounded-lg p-2.5 bg-red-50 dark:bg-red-950/30">
                      <p className="font-semibold text-red-800 dark:text-red-300">{d.field.replace(/_/g, ' ')}</p>
                      <div className="mt-1 space-y-0.5 text-gray-700 dark:text-gray-300">
                        <p>This doc: <strong>"{d.thisValue}"</strong></p>
                        <p>Conflicts with <span className="text-red-600 dark:text-red-400">{d.conflictingDocumentName}</span>: <strong>"{d.conflictingValue}"</strong></p>
                      </div>
                      <Badge className={`mt-1 text-xs border-0 ${d.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{d.severity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar documents */}
            {data.similarDocuments?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">📎 Similar Historical Documents</p>
                <div className="space-y-1">
                  {data.similarDocuments.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{s.originalName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-400">{s.documentType.replace(/_/g, ' ')}</span>
                        <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">{Math.round(s.similarity * 100)}% match</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {data.suggestions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5">💡 AI Field Suggestions (from historical docs)</p>
                <div className="space-y-1.5">
                  {data.suggestions.map((s: any, i: number) => (
                    <div key={i} className="text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800 rounded p-2">
                      <span className="font-semibold text-blue-800 dark:text-blue-300">{s.field.replace(/_/g, ' ')}:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-400">"{s.suggestedValue}"</span>
                      <span className="ml-2 text-blue-400">from {s.sourceDocumentName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Processed in {data.processingTimeMs}ms · {new Date(data.processedAt).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
