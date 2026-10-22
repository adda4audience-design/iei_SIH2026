'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, STATUS_COLORS } from '@/lib/utils';
import { FileText, Upload, CheckCircle, Clock, AlertTriangle, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InstituteDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['institute-dashboard'],
    queryFn: () => api.get('/institute/dashboard').then(r => r.data),
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="flex items-center gap-3 text-gray-500">
        <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
        </svg>
        Loading…
      </div>
    </div>
  );

  const { stats = {}, recentApplications = [], institute } = data || {};

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {institute?.contactName?.split(' ')[0] || 'Institution'}</h1>
          <p className="text-gray-500 text-sm mt-1">{institute?.name} · {institute?.code}</p>
          {!institute?.isVerified && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 w-fit">
              <AlertTriangle className="w-3.5 h-3.5" />
              Your institution is pending officer verification
            </div>
          )}
        </div>
        <Link href="/institute/upload">
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Upload className="w-4 h-4" />
            Upload Documents
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={stats.totalApplications || 0} icon={FileText} color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Under Review" value={stats.underReview || 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Approved" value={stats.approved || 0} icon={CheckCircle} color="bg-green-50 text-green-600" />
        <StatCard label="Documents Uploaded" value={stats.totalDocuments || 0} icon={Upload} color="bg-cyan-50 text-cyan-600" />
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Applications</CardTitle>
            <Link href="/institute/applications" className="text-sm text-indigo-600 hover:underline font-medium">View all</Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p>No applications yet.</p>
              <Link href="/institute/applications">
                <Button variant="outline" className="mt-3" size="sm">Start New Application</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app: any) => (
                <div key={app.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{app.title}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{app.applicationNumber}</p>
                  </div>
                  <Badge className={STATUS_COLORS[app.status]}>{app.status.replace(/_/g, ' ')}</Badge>
                  <div className="text-right text-xs text-gray-400">
                    <p>{app._count?.documents} docs · {app._count?.findings} findings</p>
                    {app.submittedAt && <p>Submitted {formatDate(app.submittedAt)}</p>}
                  </div>
                  <Link href={`/institute/applications/${app.id}`}
                    className="text-xs text-indigo-600 font-medium hover:underline whitespace-nowrap">
                    View →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
