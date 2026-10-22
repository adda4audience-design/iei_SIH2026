'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatDateTime, STATUS_COLORS } from '@/lib/utils';
import { Search, Filter, FileText, ChevronRight, AlertTriangle, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const STATUS_OPTIONS = ['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_CLARIFICATION'];

export default function OfficerApplicationsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['officer-applications', search, status, page],
    queryFn: () => api.get('/officer/applications', { params: { search, status, page, limit: 15 } }).then(r => r.data),
  });

  const { applications = [], pagination } = data || {};

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-gray-500 text-sm mt-1">Review submitted institution applications and evidence</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by institution, title, number…"
            className="pl-9" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="h-10 px-3 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              No applications found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="text-left p-4">Application</th>
                    <th className="text-left p-4">Institution</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Docs / Findings</th>
                    <th className="text-left p-4">Submitted</th>
                    <th className="text-left p-4">Assigned To</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {applications.map((app: any) => (
                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-4">
                        <p className="font-semibold text-gray-900">{app.title}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{app.applicationNumber}</p>
                        {app.applicationType && (
                          <span className="inline-block mt-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                            {app.applicationType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-700">{app.institute?.name}</p>
                            <p className="text-xs text-gray-400">{app.institute?.city}, {app.institute?.state}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={STATUS_COLORS[app.status]}>
                          {app.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-600">{app._count?.documents} docs</span>
                          {app._count?.findings > 0 && (
                            <span className="flex items-center gap-1 text-orange-600 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              {app._count.findings}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                        {app.submittedAt ? formatDate(app.submittedAt) : '—'}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">
                        {app.assignedOfficer?.name || <span className="text-gray-300">Unassigned</span>}
                      </td>
                      <td className="p-4">
                        <Link href={`/officer/review/${app.id}`}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          Review <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <p>Showing {applications.length} of {pagination.total} applications</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-xs font-medium">
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs">Page {page} of {pagination.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-xs font-medium">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
