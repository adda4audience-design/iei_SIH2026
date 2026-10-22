'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { OfficerSidebar } from '@/components/layout/OfficerSidebar';

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (user?.role === 'INSTITUTE') router.replace('/institute/dashboard');
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated()) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <OfficerSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
