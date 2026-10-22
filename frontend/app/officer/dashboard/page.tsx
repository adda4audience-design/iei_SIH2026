'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDateTime, SEVERITY_COLORS, FINDING_TYPE_LABELS } from '@/lib/utils';
import {
  FileText, AlertTriangle, Clock, CheckCircle, XCircle, Users, TrendingUp, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
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

export default function OfficerDashboard() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['officer-dashboard'],
    queryFn: () => api.get('/officer/dashboard').then(r => r.data),
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="flex items-center gap-3 text-gray-500">
        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
        </svg>
        Loading dashboard…
      </div>
    </div>
  );

  const { stats, recentFindings } = data || { stats: {}, recentFindings: [] };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.profile?.name?.split(' ')[0] || 'Officer'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's your review queue summary for today.</p>
        </div>
        <Link href="/officer/applications"
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition-colors">
          <Eye className="w-4 h-4" />
          View All Applications
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Total Applications" value={stats.totalApplications || 0} icon={FileText} color="bg-blue-50 text-blue-600" />
        <StatCard label="Pending Review" value={stats.pendingReview || 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Under Review" value={stats.underReview || 0} icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Resolved" value={stats.resolved || 0} icon={CheckCircle} color="bg-green-50 text-green-600" />
        <StatCard label="My Assigned" value={stats.myAssigned || 0} icon={Users} color="bg-purple-50 text-purple-600" />
      </div>

      {/* Recent Findings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <CardTitle>Recent Findings Requiring Attention</CardTitle>
            </div>
            <Link href="/officer/findings" className="text-sm text-blue-600 hover:underline font-medium">View all</Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentFindings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
              <p>No active findings — great work!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentFindings.map((f: any) => (
                <div key={f.id} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors">
                  <Badge className={`${SEVERITY_COLORS[f.severity]} shrink-0 mt-0.5`}>{f.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{f.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {f.application?.institute?.name} · {FINDING_TYPE_LABELS[f.type] || f.type}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{formatDateTime(f.createdAt)}</p>
                    <Link href={`/officer/review/${f.applicationId}`}
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
