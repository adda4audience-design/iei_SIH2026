'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FileText, Upload, ChevronRight,
  LogOut, FileSearch, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toaster';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const navItems = [
  { href: '/institute/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/institute/applications', icon: FileText, label: 'My Applications' },
  { href: '/institute/upload', icon: Upload, label: 'Upload Documents' },
];

export function InstituteSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { toast } = useToast();

  const logout = () => {
    clearAuth();
    localStorage.removeItem('iei_token');
    toast({ title: 'Logged out', description: 'See you next time!' });
    router.push('/login');
  };

  return (
    <div className="w-64 h-full bg-slate-900 flex flex-col text-white">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
            <FileSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">IEI Platform</p>
            <p className="text-xs text-slate-400">Evidence Intelligence</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-200 truncate">Institution Portal</p>
            <p className="text-xs text-indigo-300/70 truncate">{user?.profile?.name || user?.email}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Navigation</p>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}>
              <item.icon className={cn('w-4 h-4 shrink-0', active ? 'text-white' : 'text-slate-500 group-hover:text-white')} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center justify-between px-1 mb-1">
          <ThemeToggle />
        </div>
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all w-full">
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
