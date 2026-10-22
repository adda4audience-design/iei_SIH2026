'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => api.get('/audit', { params: { page, limit: 30 } }).then(r => r.data),
  });
  const { logs = [], pagination } = data || {};

  const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-100 text-blue-700',
    LOGOUT: 'bg-gray-100 text-gray-600',
    UPLOAD_DOCUMENT: 'bg-cyan-100 text-cyan-700',
    SUBMIT_APPLICATION: 'bg-purple-100 text-purple-700',
    REVIEW_STARTED: 'bg-yellow-100 text-yellow-700',
    FINDING_ADDED: 'bg-orange-100 text-orange-700',
    FINDING_DISMISSED: 'bg-gray-100 text-gray-600',
    ISSUER_VERIFICATION_RUN: 'bg-indigo-100 text-indigo-700',
    APPLICATION_APPROVED: 'bg-green-100 text-green-700',
    APPLICATION_REJECTED: 'bg-red-100 text-red-700',
    APPLICATION_CLARIFICATION_REQUESTED: 'bg-orange-100 text-orange-700',
    USER_CREATED: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-gray-500 text-sm mt-1">Complete log of all system actions and review events</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading audit log…</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              No audit events found
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log: any) => (
                <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{log.user?.email || 'System'}</span>
                      {log.application && <span className="text-gray-400"> → {log.application.applicationNumber}</span>}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {JSON.stringify(log.metadata).substring(0, 120)}
                      </p>
                    )}
                    {log.ipAddress && <p className="text-xs text-gray-300 mt-0.5">IP: {log.ipAddress}</p>}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">{formatDateTime(log.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <p>Showing {logs.length} of {pagination.total} events</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-xs">Previous</button>
            <span className="px-3 py-1.5 text-xs">Page {page} of {pagination.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-xs">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
