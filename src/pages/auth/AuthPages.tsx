import React, { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye } from 'lucide-react';
import {
  loginWithGoogleSupabase,
  formatAuthError,
} from '../../services/auth/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useToastStore } from '../../stores/useToastStore';
import { GoogleIcon } from '../../components/common/BrandIcons';

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
  const { enterGuestMode } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setServerError('');
    setLoading(true);
    try {
      await loginWithGoogleSupabase();
      // Browser will redirect to Google → Supabase callback → /dashboard
      // No need to navigate here; the redirect handles it
    } catch (err) {
      setServerError(formatAuthError(err));
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
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] text-[#20212B] dark:text-[#F4F5FA] text-sm font-medium transition-colors shadow-sm disabled:opacity-60"
        >
          <GoogleIcon className="w-5 h-5 shrink-0" />
          <span>{loading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
        </button>

        <button
          type="button"
          onClick={handlePreview}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4 text-[#635BFF]" />
          <span>Explore Interactive Preview</span>
        </button>

        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300"
          >
            {serverError}
          </div>
        )}

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
  const { enterGuestMode } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setServerError('');
    setLoading(true);
    try {
      await loginWithGoogleSupabase();
      // Browser will redirect to Google → Supabase callback → /dashboard
    } catch (err) {
      setServerError(formatAuthError(err));
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
      title="Create your TaskFlow account"
      subtitle="Start organizing projects, assignments, and team sprints in minutes."
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void handleGoogleSignUp()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] text-[#20212B] dark:text-[#F4F5FA] text-sm font-medium transition-colors shadow-sm disabled:opacity-60"
        >
          <GoogleIcon className="w-5 h-5 shrink-0" />
          <span>{loading ? 'Redirecting to Google...' : 'Sign up with Google'}</span>
        </button>

        <button
          type="button"
          onClick={handlePreview}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4 text-[#635BFF]" />
          <span>Explore Interactive Preview</span>
        </button>

        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300"
          >
            {serverError}
          </div>
        )}

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
  return (
    <AuthShell
      title="Need help signing in?"
      subtitle="TaskFlow uses Google Sign-In. Try signing in again with your Google account."
    >
      <div className="space-y-4">
        <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8]">
          Since TaskFlow uses Google for authentication, you don't need a separate password. Just
          click "Continue with Google" on the sign-in page to access your account.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5249E8] text-white text-sm font-medium transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </AuthShell>
  );
}
