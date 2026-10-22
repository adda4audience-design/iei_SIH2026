'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { SEVERITY_COLORS, FINDING_TYPE_LABELS, formatDateTime } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function FindingsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['all-findings'],
    queryFn: () => api.get('/findings', { params: { dismissed: false } }).then(r => r.data),
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Findings</h1>
        <p className="text-gray-500 text-sm mt-1">Active, non-dismissed findings across all applications</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              No active findings
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.map((f: any) => (
                <div key={f.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                  <Badge className={`${SEVERITY_COLORS[f.severity]} shrink-0 mt-0.5`}>{f.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{FINDING_TYPE_LABELS[f.type]}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-600 font-medium">{f.application?.institute?.name}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{formatDateTime(f.createdAt)}</p>
                    <Link href={`/officer/review/${f.applicationId}?tab=findings`}
                      className="text-xs text-blue-600 hover:underline font-medium mt-0.5 block">
                      Review →
                    </Link>
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
