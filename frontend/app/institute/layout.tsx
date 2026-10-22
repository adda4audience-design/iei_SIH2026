'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { InstituteSidebar } from '@/components/layout/InstituteSidebar';

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (user?.role === 'OFFICER' || user?.role === 'ADMIN') router.replace('/officer/dashboard');
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated()) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <InstituteSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
