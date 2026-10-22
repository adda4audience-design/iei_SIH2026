'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Building2, Eye, EyeOff, FileSearch, Lock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

type Portal = 'OFFICER' | 'INSTITUTE';

export default function LoginPage() {
  const [portal, setPortal] = useState<Portal>('OFFICER');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const switchPortal = (p: Portal) => { setPortal(p); reset(); };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { ...data, role: portal });
      const { token, user } = res.data;
      setAuth(token, user);
      localStorage.setItem('iei_token', token);
      toast({ title: 'Welcome back!', description: `Logged in as ${user.profile?.name || user.email}`, variant: 'success' });
      if (user.role === 'OFFICER' || user.role === 'ADMIN') router.push('/officer/dashboard');
      else router.push('/institute/dashboard');
    } catch (err: any) {
      toast({
        title: 'Login failed',
        description: err.response?.data?.error || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl mb-4">
            <FileSearch className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">IEI</h1>
          <p className="text-blue-200 text-sm mt-1 font-medium">Institutional Evidence Intelligence</p>
          <p className="text-slate-400 text-xs mt-1">This Webapp is not fully Finished yet, this is more like a prototype.</p>
        </div>

        {/* Portal Toggle */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-1 mb-6 flex">
          <button
            onClick={() => switchPortal('OFFICER')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
              portal === 'OFFICER'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Officer Portal
          </button>
          <button
            onClick={() => switchPortal('INSTITUTE')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
              portal === 'INSTITUTE'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Institute Portal
          </button>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          {/* Portal Banner */}
          <div className={`flex items-center gap-3 p-3 rounded-xl mb-6 ${
            portal === 'OFFICER' ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-indigo-500/15 border border-indigo-500/30'
          }`}>
            {portal === 'OFFICER' ? (
              <><Shield className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-blue-200 font-semibold text-sm">Review Officer Login</p>
                <p className="text-blue-300/70 text-xs">Access document review queue and forensic analysis</p>
              </div></>
            ) : (
              <><Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <p className="text-indigo-200 font-semibold text-sm">Institution Login</p>
                <p className="text-indigo-300/70 text-xs">Upload documents and track your application status</p>
              </div></>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Email Address</Label>
              <Input
                {...register('email')}
                type="email"
                placeholder={portal === 'OFFICER' ? 'officer@iei.gov.in' : 'admin@yourinstitute.ac.in'}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-blue-400"
                autoComplete="email"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Password</Label>
              <div className="relative">
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-blue-400 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={`w-full h-11 font-semibold text-sm shadow-lg ${
                portal === 'OFFICER'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Sign In as {portal === 'OFFICER' ? 'Officer' : 'Institution'}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </span>
              )}
            </Button>
          </form>

          {portal === 'INSTITUTE' && (
            <p className="text-center text-slate-400 text-sm mt-5">
              New institution?{' '}
              <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2">
                Register here
              </Link>
            </p>
          )}
        </div>

        {/* Demo credentials */}
        <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wide">Demo Credentials</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>
              <p className="text-blue-400 font-medium">Officer</p>
              <p>officer1@iei.gov.in</p>
              <p>officer@IEI2026</p>
            </div>
            <div>
              <p className="text-indigo-400 font-medium">Institute</p>
              <p>admin@techuniversity.ac.in</p>
              <p>institute@IEI2026</p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2026 IEI Platform · SIH Blueprint · All document processing is local & privacy-preserving
        </p>
      </div>
    </div>
  );
}
