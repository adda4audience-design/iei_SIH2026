'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, STATUS_COLORS } from '@/lib/utils';
import { FileText, Plus, Send, Loader2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';

export default function InstituteApplicationsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [applicationType, setApplicationType] = useState('EXTENSION_OF_APPROVAL');
  const [description, setDescription] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();

  const APP_TYPES = [
    { value: 'EXTENSION_OF_APPROVAL',   label: 'Extension of Approval (EoA)' },
    { value: 'NEW_INSTITUTION',          label: 'New Institution' },
    { value: 'PROGRAMME_ADDITION',       label: 'Programme Addition' },
    { value: 'INTAKE_INCREASE',          label: 'Intake Increase' },
    { value: 'INTAKE_DECREASE',          label: 'Intake Decrease' },
    { value: 'CHANGE_OF_SITE',           label: 'Change of Site' },
    { value: 'CLOSURE_OF_PROGRAMME',     label: 'Closure of Programme' },
    { value: 'CONVERSION_OF_PROGRAMME',  label: 'Conversion of Programme' },
    { value: 'OTHER',                    label: 'Other' },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['institute-applications'],
    queryFn: () => api.get('/institute/applications').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/institute/applications', { title, description, applicationType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['institute-applications'] });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setApplicationType('EXTENSION_OF_APPROVAL');
      toast({ title: 'Application created!', description: 'Add documents and submit when ready.', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/institute/applications/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['institute-applications'] });
      toast({ title: 'Application submitted!', description: 'Officers will review your application.', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'destructive' }),
  });

  const { applications = [] } = data || {};

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and track your document submissions</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" />
          New Application
        </Button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Create New Application</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Application Type <span className="text-red-500">*</span></Label>
                <select
                  value={applicationType}
                  onChange={e => setApplicationType(e.target.value)}
                  className="h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {APP_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">This determines the AICTE checklist of required documents.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Application Title <span className="text-red-500">*</span></Label>
                <Input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., EoA 2026-27 — Tech University" />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of the application purpose…" rows={3} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title.trim()}
                className="bg-indigo-600 hover:bg-indigo-700">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Applications list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p>No applications yet.</p>
              <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-3" size="sm">
                <Plus className="w-4 h-4" /> Create First Application
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {applications.map((app: any) => (
                <div key={app.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{app.title}</h3>
                        <Badge className={STATUS_COLORS[app.status]}>{app.status.replace(/_/g, ' ')}</Badge>
                        {app.applicationType && (
                          <Badge className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {app.applicationType.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{app.applicationNumber}</p>
                      {app.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{app.description}</p>}

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{app._count?.documents || 0} documents</span>
                        {app._count?.findings > 0 && (
                          <span className="text-orange-600 font-medium">⚠ {app._count.findings} findings</span>
                        )}
                        {app.submittedAt && <span>Submitted {formatDate(app.submittedAt)}</span>}
                        {app.assignedOfficer && <span>Officer: {app.assignedOfficer.name}</span>}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {(app.status === 'DRAFT' || app.status === 'REQUIRES_CLARIFICATION') && (
                        <Button size="sm" variant="outline"
                          onClick={() => submitMutation.mutate(app.id)}
                          disabled={submitMutation.isPending}
                          className="text-indigo-600 border-indigo-300 hover:bg-indigo-50">
                          {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Submit</>}
                        </Button>
                      )}
                      <Link href={`/institute/applications/${app.id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          View <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
