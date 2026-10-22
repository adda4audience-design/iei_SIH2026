'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, ArrowLeft, Eye, EyeOff, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import Link from 'next/link';

const schema = z.object({
  name: z.string().min(3, 'Institution name required'),
  code: z.string().min(3, 'Institution code required (AICTE/UGC)'),
  type: z.string().min(2, 'Institution type required'),
  address: z.string().min(5, 'Address required'),
  city: z.string().min(2, 'City required'),
  state: z.string().min(2, 'State required'),
  pincode: z.string().length(6, '6-digit pincode required').regex(/^\d+$/, 'Numbers only'),
  contactName: z.string().min(2, 'Contact name required'),
  contactPhone: z.string().length(10, '10-digit phone required').regex(/^\d+$/, 'Numbers only'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    const { confirmPassword, ...payload } = data;
    try {
      const res = await api.post('/auth/register/institute', payload);
      const { token, user } = res.data;
      setAuth(token, user);
      localStorage.setItem('iei_token', token);
      toast({ title: 'Registration successful!', description: 'Welcome to IEI Platform', variant: 'success' });
      router.push('/institute/dashboard');
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.response?.data?.error || 'Please try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', placeholder, error, ...rest }: any) => (
    <div className="space-y-1.5">
      <Label className="text-slate-300 text-sm">{label}</Label>
      <Input type={type} placeholder={placeholder} {...register(name)} {...rest}
        className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-400" />
      {error && <p className="text-red-400 text-xs">{error.message}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-xl mb-4">
            <FileSearch className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Register Institution</h1>
          <p className="text-slate-400 text-sm mt-1">Create your IEI account to submit documents for verification</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <div className="flex items-center gap-2 p-3 rounded-xl mb-6 bg-indigo-500/15 border border-indigo-500/30">
            <Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
            <p className="text-indigo-200 text-sm font-medium">Institution Registration — all fields are required</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Institution Full Name" name="name" placeholder="e.g., National Institute of Technology" error={errors.name} />
              </div>
              <Field label="Institution Code (AICTE/UGC)" name="code" placeholder="e.g., NIT-KAR-001" error={errors.code} />
              <Field label="Institution Type" name="type" placeholder="e.g., Engineering, Medical, Arts" error={errors.type} />
              <div className="md:col-span-2">
                <Field label="Address" name="address" placeholder="Street address" error={errors.address} />
              </div>
              <Field label="City" name="city" placeholder="City" error={errors.city} />
              <Field label="State" name="state" placeholder="State" error={errors.state} />
              <Field label="Pincode" name="pincode" placeholder="6-digit pincode" error={errors.pincode} />
              <Field label="Contact Person Name" name="contactName" placeholder="Full name" error={errors.contactName} />
              <Field label="Contact Phone" name="contactPhone" placeholder="10-digit mobile number" error={errors.contactPhone} />
              <Field label="Login Email" name="email" type="email" placeholder="admin@yourinstitute.ac.in" error={errors.email} />

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Password</Label>
                <div className="relative">
                  <Input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-400 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Confirm Password</Label>
                <Input {...register('confirmPassword')} type="password" placeholder="Repeat password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-400" />
                {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 font-semibold bg-indigo-600 hover:bg-indigo-700 mt-6">
              {loading ? 'Creating Account…' : 'Register Institution'}
            </Button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-4">
            Already registered?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
