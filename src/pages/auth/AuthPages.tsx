import React, { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, Lock, User as UserIcon, Eye } from 'lucide-react';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  sendResetPassword,
  formatAuthError,
} from '../../services/auth/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useToastStore } from '../../stores/useToastStore';
import { validateEmail } from '../../utils/kanban';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F7F8FC] dark:bg-[#0D0E14]">
      {/* Left Brand / Value Panel */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-12 bg-[#20212B] text-white">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[#635BFF] text-white font-display font-bold text-base flex items-center justify-center">
            TF
          </span>
          <span className="font-display font-bold text-xl tracking-tight">TaskFlow</span>
        </div>

        <div className="space-y-6 max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight">
            Ship collaborative projects with clarity and calm precision.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Organize sprints, academic milestones, client deliverables, and personal goals across
            real-time Kanban boards, calendars, and analytics.
          </p>
          <ul className="space-y-3 pt-2 text-sm text-slate-200">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span>Drag-and-drop Kanban lanes with database persistence</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span>Role-based workspaces (Owner, Admin, Member, Viewer)</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span>Live analytics, deadline calendar, and instant team sync</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-400">TaskFlow Collaborative Project Management</p>
      </div>

      {/* Right Form Container */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-2xl p-8">
          <div className="flex items-center gap-2.5 mb-6 lg:hidden">
            <span className="w-8 h-8 rounded-lg bg-[#635BFF] text-white font-display font-bold text-sm flex items-center justify-center">
              TF
            </span>
            <span className="font-display font-bold text-lg text-[#20212B] dark:text-[#F4F5FA]">
              TaskFlow
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1.5 mb-6">{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession, enterGuestMode } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setServerError('');
    setLoading(true);
    try {
      const { user, profile } = await loginWithGoogle();
      setSession(user, profile);
      addToast({
        title: 'Signed in',
        message: `Welcome back, ${profile?.fullName || user.displayName || 'there'}.`,
        variant: 'success',
      });
      navigate('/dashboard');
    } catch (err) {
      setServerError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Email address is required.';
    else if (!validateEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setServerError('');
    setLoading(true);
    try {
      const { user, profile } = await loginWithEmail(email, password);
      setSession(user, profile);
      navigate('/dashboard');
    } catch (err) {
      setServerError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    enterGuestMode();
    addToast({
      title: 'Interactive Preview Active',
      message: 'Explore workspaces, drag-and-drop boards, analytics, and calendar.',
      variant: 'info',
    });
    navigate('/dashboard');
  };

  return (
    <AuthShell
      title="Sign in to TaskFlow"
      subtitle="Access your workspaces, Kanban boards, and real-time team updates."
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5249E8] text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          <span>Continue with Google</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handlePreview}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4 text-[#635BFF]" />
          <span>Explore Interactive Preview</span>
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-[#E6E8F0] dark:border-[#262A3D]" />
          <span className="shrink mx-3 text-xs text-[#9295A5]">or sign in with email</span>
          <div className="flex-grow border-t border-[#E6E8F0] dark:border-[#262A3D]" />
        </div>

        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9295A5] absolute left-3.5 top-3" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="you@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>
            {errors.email && <p className="text-xs text-[#EF4444] mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA]"
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-[#635BFF] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9295A5] absolute left-3.5 top-3" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="Enter your password"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>
            {errors.password && <p className="text-xs text-[#EF4444] mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-[#20212B] dark:bg-[#262A3D] hover:bg-[#2E3040] text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-[#6B7085] dark:text-[#9EA3B8] pt-2">
          New to TaskFlow?{' '}
          <Link to="/register" className="text-[#635BFF] font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setServerError('');
    setLoading(true);
    try {
      const { user, profile } = await loginWithGoogle();
      setSession(user, profile);
      navigate('/dashboard');
    } catch (err) {
      setServerError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!email.trim()) nextErrors.email = 'Email address is required.';
    else if (!validateEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!password || password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setServerError('');
    setLoading(true);
    try {
      const { user, profile } = await registerWithEmail({ fullName, email, password });
      setSession(user, profile);
      addToast({
        title: 'Account created',
        message: 'Check your inbox to verify your email address for cloud sync.',
        variant: 'success',
      });
      navigate('/dashboard');
    } catch (err) {
      setServerError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your TaskFlow account"
      subtitle="Start organizing projects, assignments, and team sprints in minutes."
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void handleGoogleSignUp()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5249E8] text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          <span>Sign up with Google</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-[#E6E8F0] dark:border-[#262A3D]" />
          <span className="shrink mx-3 text-xs text-[#9295A5]">or register with email</span>
          <div className="flex-grow border-t border-[#E6E8F0] dark:border-[#262A3D]" />
        </div>

        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="reg-name"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[#9295A5] absolute left-3.5 top-3" />
              <input
                id="reg-name"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
                }}
                placeholder="Nadia Kusuma"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>
            {errors.fullName && <p className="text-xs text-[#EF4444] mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9295A5] absolute left-3.5 top-3" />
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="you@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>
            {errors.email && <p className="text-xs text-[#EF4444] mt-1">{errors.email}</p>}
          </div>

          <div>
            <label
              htmlFor="reg-password"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9295A5] absolute left-3.5 top-3" />
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="Minimum 6 characters"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>
            {errors.password && <p className="text-xs text-[#EF4444] mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-[#20212B] dark:bg-[#262A3D] hover:bg-[#2E3040] text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-[#6B7085] dark:text-[#9EA3B8] pt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-[#635BFF] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendResetPassword(email);
      setSent(true);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email address and we will send you a password reset link."
    >
      {sent ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-sm text-emerald-800 dark:text-emerald-300">
            Password reset instructions were sent to <strong>{email}</strong>. Check your inbox and
            spam folder.
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5249E8] text-white text-sm font-medium transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="reset-email"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9295A5] absolute left-3.5 top-3" />
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="you@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5249E8] text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Sending reset link...' : 'Send Reset Link'}
          </button>

          <p className="text-center text-xs text-[#6B7085] dark:text-[#9EA3B8] pt-2">
            Remembered your password?{' '}
            <Link to="/login" className="text-[#635BFF] font-medium hover:underline">
              Back to Sign In
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
